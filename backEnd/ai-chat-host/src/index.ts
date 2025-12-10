import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { redisWrapper } from './redis-client';
import { MessageCreatedListener } from './events/listeners/message-created-listener';
import { AgentIngestedListener } from './events/listeners/agent-ingested-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { RoomParticipantAddedListener } from './events/listeners/room-participant-added-listener';

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
        console.log("🔌 [AI Chat Host] Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ [AI Chat Host] Connected to MongoDB");

        // ------------ Redis ------------
        console.log("🔌 [AI Chat Host] Connecting to Redis...");
        await redisWrapper.connect();
        console.log("✅ [AI Chat Host] Connected to Redis");

        // ------------ Kafka ------------
        console.log("🔌 [AI Chat Host] Connecting to Kafka...");
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];

        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
        }

        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ai-chat-host');
        console.log("✅ [AI Chat Host] Connected to Kafka");

        // ------------- Event Listeners ------------
        console.log("🚀 [AI Chat Host] Starting Kafka listeners...");
        
        // Message created listener - main listener for triggering analysis
        console.log("📥 [AI Chat Host] Starting MessageCreatedListener...");
        new MessageCreatedListener(kafkaWrapper.consumer('ai-chat-host-message-created')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start MessageCreatedListener:", err);
        });

        // Agent ingested listener - builds agent projections for matching
        console.log("📥 [AI Chat Host] Starting AgentIngestedListener...");
        new AgentIngestedListener(kafkaWrapper.consumer('ai-chat-host-agent-ingested')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start AgentIngestedListener:", err);
        });

        // Agent updated listener - updates agent projections
        console.log("📥 [AI Chat Host] Starting AgentUpdatedListener...");
        new AgentUpdatedListener(kafkaWrapper.consumer('ai-chat-host-agent-updated')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start AgentUpdatedListener:", err);
        });

        // Room participant added listener - tracks agent joins
        console.log("📥 [AI Chat Host] Starting RoomParticipantAddedListener...");
        new RoomParticipantAddedListener(kafkaWrapper.consumer('ai-chat-host-room-participant-added')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start RoomParticipantAddedListener:", err);
        });

        console.log("✅ [AI Chat Host] All Kafka listeners started");

        // Start HTTP server (for health checks)
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`✅ [AI Chat Host] Service listening on port ${PORT}`);
        });
        
    } catch (err) {
        console.error("❌ [AI Chat Host] Error starting service:", err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 [AI Chat Host] SIGTERM received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await redisWrapper.disconnect();
    await mongoose.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 [AI Chat Host] SIGINT received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await redisWrapper.disconnect();
    await mongoose.disconnect();
    process.exit(0);
});

startService();

// Error handlers
app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error('[AI Chat Host] Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

