import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { ChatRecommendationRequestedListener } from './events/listeners/chat-recommendation-requested-listener';
import { AgentIngestedListener } from './events/listeners/agent-ingested-listener';
import { AgentCreatedListener } from './events/listeners/agent-created-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { AgentCreationFailedListener } from './events/listeners/agent-creation-failed-listener';
import { AgentDeletedListener } from './events/listeners/agent-deleted-listener';
import { UserCreatedListener } from './events/listeners/user-created-listener';

const startService = async () => {
    // Validate environment variables
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    if (!process.env.KAFKA_BROKER_URL) {
        throw new Error("KAFKA_BROKER_URL must be defined!");
    }
    
    try {
        // ------------ Mongoose ----------
        console.log("🔌 [Recommendation] Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ [Recommendation] Connected to MongoDB");

        // ------------ Kafka ------------
        console.log("🔌 [Recommendation] Connecting to Kafka...");
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'recommendation');
        console.log("✅ [Recommendation] Connected to Kafka");

        // ------------- Event Listeners ------------
        console.log("🚀 [Recommendation] Starting Kafka listeners...");
        
        // Chat recommendation requested listener - main listener
        console.log("📥 [Recommendation] Starting ChatRecommendationRequestedListener...");
        new ChatRecommendationRequestedListener(
            kafkaWrapper.consumer('recommendation-chat-recommendation-requested')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start ChatRecommendationRequestedListener:", err);
        });

        // Agent ingested listener - builds agent feature projections (has full profile data)
        // Note: AgentIngestedEvent has full character/profile data, but is only published on creation
        // We keep this for initial creation with full data
        console.log("📥 [Recommendation] Starting AgentIngestedListener...");
        new AgentIngestedListener(
            kafkaWrapper.consumer('recommendation-agent-ingested')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentIngestedListener:", err);
        });

        // Agent created listener - handles AgentCreatedEvent (published after provisioning)
        // Note: AgentCreatedEvent doesn't have profile data, so we create minimal entry
        console.log("📥 [Recommendation] Starting AgentCreatedListener...");
        new AgentCreatedListener(
            kafkaWrapper.consumer('recommendation-agent-created')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentCreatedListener:", err);
        });

        // Agent updated listener - handles AgentUpdatedEvent (published on updates)
        // Note: AgentUpdatedEvent doesn't have profile data, so we rely on AgentIngestedEvent
        // TODO: Consider enhancing AgentUpdatedEvent to include profile data
        console.log("📥 [Recommendation] Starting AgentUpdatedListener...");
        new AgentUpdatedListener(
            kafkaWrapper.consumer('recommendation-agent-updated')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentUpdatedListener:", err);
        });

        // Agent creation failed listener - marks agent as inactive when provisioning fails
        // CRITICAL: Prevents recommending agents that failed to be created
        console.log("📥 [Recommendation] Starting AgentCreationFailedListener...");
        new AgentCreationFailedListener(
            kafkaWrapper.consumer('recommendation-agent-creation-failed')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentCreationFailedListener:", err);
        });

        // Agent deleted listener - marks agent as inactive when deleted
        // CRITICAL: Prevents recommending deleted agents
        console.log("📥 [Recommendation] Starting AgentDeletedListener...");
        new AgentDeletedListener(
            kafkaWrapper.consumer('recommendation-agent-deleted')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentDeletedListener:", err);
        });

        // User created listener - initializes user feature projections
        console.log("📥 [Recommendation] Starting UserCreatedListener...");
        new UserCreatedListener(
            kafkaWrapper.consumer('recommendation-user-created')
        ).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start UserCreatedListener:", err);
        });

        console.log("✅ [Recommendation] All Kafka listeners started");

        // Start HTTP server (for health checks)
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`✅ [Recommendation] Service listening on port ${PORT}`);
        });
        
    } catch (err) {
        console.error("❌ [Recommendation] Error starting service:", err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 [Recommendation] SIGTERM received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await mongoose.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 [Recommendation] SIGINT received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await mongoose.disconnect();
    process.exit(0);
});

startService();

// Error handlers
app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error('[Recommendation] Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

