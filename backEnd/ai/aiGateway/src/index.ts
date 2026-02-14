// src/index.ts
import mongoose from 'mongoose';
import { kafkaWrapper } from './kafka-client';
import { app } from './app';
import { AiMessageCreatedListener } from './events/listeners/ai-message-created-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { AgentIngestedListener } from './events/listeners/agent-ingested-listener';
import { AgentFeedScannedListener } from './events/listeners/agent-feed-scanned-listener';
import { ARMessageRequestListener } from './events/listeners/ar-message-request-listener';
import { AgentReplyMessageCreatedListener } from './events/listeners/agent-reply-message-created-listener';
import { AgentDraftRevisionRequestListener } from './events/listeners/agent-feed-scanned-listener';
import { costAlertMonitoringJob } from './jobs/cost-alert-monitoring-job';

const startService = async () => {
  // Validate environment variables
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined!');
  }
  if (!process.env.KAFKA_CLIENT_ID) {
    throw new Error('KAFKA_CLIENT_ID must be defined!');
  }
  if (!process.env.KAFKA_BROKER_URL) {
    throw new Error('KAFKA_BROKER_URL must be defined!');
  }

  try {
    // ------------ Mongoose ----------
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // ------------ HTTP -------------
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
      console.log(`✅ AI Gateway HTTP server listening on port ${port}`);
    });

    // ------------ Jobs -------------
    costAlertMonitoringJob.start();

    // ------------ Kafka ------------
    console.log('Connecting to Kafka at:', process.env.KAFKA_BROKER_URL);
    const brokers = process.env.KAFKA_BROKER_URL
      ? process.env.KAFKA_BROKER_URL.split(',').map((host) => host.trim())
      : [];

    if (!brokers.length) {
      throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
    }

    await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
    console.log('✅ Kafka connected successfully');

    // ------------- Event Listeners ------------
    // AI message created listener - processes incoming AI message requests
    const aiMessageCreatedListener = new AiMessageCreatedListener(
      kafkaWrapper.consumer('ai-gateway-ai-message-created')
    );
    await aiMessageCreatedListener.listen();

    // Agent ingested listener - provisions provider agents
    const agentIngestedListener = new AgentIngestedListener(
      kafkaWrapper.consumer('ai-gateway-agent-ingested')
    );
    await agentIngestedListener.listen();

    // Agent updated listener - keeps agent profile cache in sync
    const agentUpdatedListener = new AgentUpdatedListener(
      kafkaWrapper.consumer('ai-gateway-agent-updated')
    );
    await agentUpdatedListener.listen();

    // Agent feed scanned listener - processes agent feed scans
    const agentFeedScannedListener = new AgentFeedScannedListener(
      kafkaWrapper.consumer('ai-gateway-agent-feed-scanned')
    );
    await agentFeedScannedListener.listen();

    // AR message request listener - processes AR conversation streaming requests
    const arMessageRequestListener = new ARMessageRequestListener(
      kafkaWrapper.consumer('ai-gateway-ar-message-request')
    );
    await arMessageRequestListener.listen();

    // MVP: agent replies are triggered directly from `message.created` (reply metadata),
    // not via feedback.* events / feedback service.
    const agentReplyMessageCreatedListener = new AgentReplyMessageCreatedListener(
      kafkaWrapper.consumer('ai-gateway-agent-reply-message-created')
    );
    await agentReplyMessageCreatedListener.listen();

    // Draft revision request listener - consumes AgentDraftUpdated events with revisionRequest payload
    const draftRevisionRequestListener = new AgentDraftRevisionRequestListener(
      kafkaWrapper.consumer('ai-gateway-agent-draft-updated-revision')
    );
    await draftRevisionRequestListener.listen();

    console.log('✅ All Kafka listeners started successfully');
    console.log('🤖 AI Gateway service is ready!');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await kafkaWrapper.disconnect();
      await mongoose.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await kafkaWrapper.disconnect();
      await mongoose.disconnect();
      process.exit(0);
    });
  } catch (err) {
    console.error('❌ Error starting AI Gateway service:', err);
    process.exit(1);
  }
};

startService();

