import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { retryWithBackoff } from './utils/connection-retry';
import { avatarRouter } from './routes/avatar-routes';
import { NotFoundError, errorHandler } from "@aichatwar/shared";

const PORT = parseInt(process.env.PORT || '3000', 10);

const startService = async () => {
    // Validate environment variables
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    
    try {
        // ------------ Mongoose ----------
        console.log("🔌 [AR Avatar] Connecting to MongoDB...");
        await retryWithBackoff(
            async () => {
                await mongoose.connect(process.env.MONGO_URI!);
                console.log("✅ [AR Avatar] Connected to MongoDB");
            },
            { maxRetries: 30, initialDelayMs: 2000 },
            "MongoDB"
        );

        // ------------ Kafka (Optional for Phase 1) ------------
        if (process.env.KAFKA_BROKER_URL) {
            console.log("🔌 [AR Avatar] Connecting to Kafka...");
            const brokers = process.env.KAFKA_BROKER_URL
                ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
                : [];

            if (brokers.length) {
                await retryWithBackoff(
                    async () => {
                        await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ar-avatar');
                        console.log("✅ [AR Avatar] Connected to Kafka");
                    },
                    { maxRetries: 30, initialDelayMs: 2000 },
                    "Kafka"
                );

                // ------------ Event Listeners ------------
                console.log("🚀 [AR Avatar] Starting Kafka listeners...");
                
                // Agent ingested listener - triggers avatar generation
                // Use retry logic for listener setup
                await retryWithBackoff(
                    async () => {
                        const { AgentIngestedListener } = await import('./events/listeners/agent-ingested-listener');
                        console.log("📥 [AR Avatar] Starting AgentIngestedListener...");
                        const listener = new AgentIngestedListener(
                            kafkaWrapper.consumer('ar-avatar-agent-ingested')
                        );
                        await listener.listen();
                        console.log("✅ [AR Avatar] AgentIngestedListener started successfully");
                    },
                    { maxRetries: 10, initialDelayMs: 3000 },
                    "AgentIngestedListener"
                );

                console.log("✅ [AR Avatar] All Kafka listeners started");
            }
        }

        // ------------ Routes ------------
        const { ttsRouter } = await import('./routes/tts-routes');
        app.use('/api/avatars', avatarRouter);
        app.use('/api/tts', ttsRouter);

        // ------------ Catch-all route (must be after all routes) ------------
        const { NotFoundError } = await import('@aichatwar/shared');
        const { errorHandler } = await import('@aichatwar/shared');
        app.all('*', async () => {
            throw new NotFoundError();
        });
        app.use(errorHandler);

        // ------------ Start Server ------------
        app.listen(PORT, '0.0.0.0', () => {
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

