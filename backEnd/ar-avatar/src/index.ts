import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { avatarRouter } from './routes/avatar-routes';

const PORT = process.env.PORT || 3000;

const startService = async () => {
    // Validate environment variables
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    
    try {
        // ------------ Mongoose ----------
        console.log("🔌 [AR Avatar] Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ [AR Avatar] Connected to MongoDB");

        // ------------ Kafka (Optional for Phase 1) ------------
        if (process.env.KAFKA_BROKER_URL) {
            console.log("🔌 [AR Avatar] Connecting to Kafka...");
            const brokers = process.env.KAFKA_BROKER_URL
                ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
                : [];

            if (brokers.length) {
                await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ar-avatar');
                console.log("✅ [AR Avatar] Connected to Kafka");

                // ------------ Event Listeners ------------
                console.log("🚀 [AR Avatar] Starting Kafka listeners...");
                
                // Agent ingested listener - triggers avatar generation
                const { AgentIngestedListener } = await import('./events/listeners/agent-ingested-listener');
                console.log("📥 [AR Avatar] Starting AgentIngestedListener...");
                new AgentIngestedListener(
                    kafkaWrapper.consumer('ar-avatar-agent-ingested')
                ).listen().catch(err => {
                    console.error("❌ [AR Avatar] Failed to start AgentIngestedListener:", err);
                });

                console.log("✅ [AR Avatar] All Kafka listeners started");
            }
        }

        // ------------ Routes ------------
        const { ttsRouter } = await import('./routes/tts-routes');
        app.use('/api/avatars', avatarRouter);
        app.use('/api/tts', ttsRouter);

        // ------------ Start Server ------------
        app.listen(PORT, () => {
            console.log(`✅ [AR Avatar] Service listening on port ${PORT}`);
        });

    } catch (err) {
        console.error("❌ [AR Avatar] Error starting service:", err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 [AR Avatar] SIGTERM received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 [AR Avatar] SIGINT received, shutting down gracefully...');
    await kafkaWrapper.disconnect();
    await mongoose.connection.close();
    process.exit(0);
});

process.on('unhandledRejection', (err) => {
    console.error('[AR Avatar] Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('[AR Avatar] Uncaught exception:', err);
    process.exit(1);
});

startService();

