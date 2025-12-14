import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { MessageIngestListener } from './events/listeners/message-ingest-listener';
import { MessageReactionIngestedListener } from './events/listeners/message-reaction-ingested-listener';
import { MessageReplyIngestedListener } from './events/listeners/message-reply-ingested-listener';
import { AiMessageReplyListener } from './events/listeners/ai-message-reply-listener';
import { RoomCreatedListener } from './events/listeners/room-created-listener';
import { RoomDeletedListener } from './events/listeners/room-deleted-listener';
import { RoomParticipantAddedListener } from './events/listeners/room-participant-added-listener';
import { AgentUpdatedListener } from './events/listeners/agent-updated-listener';
import { AgentCreatedListener } from './events/listeners/agent-created-listener';
import { AgentIngestedListener } from './events/listeners/agent-ingested-listener';
import { UserUpdatedListener } from './events/listeners/user-updated-listener';
import { UserCreatedListener } from './events/listeners/user-created-listener';
import { ProfileCreatedListener } from './events/listeners/profile-created-listener';
import { ProfileUpdatedListener } from './events/listeners/profile-updated-listener';
import { retryWithBackoff } from './utils/connection-retry';

// Validate environment variables
if(!process.env.JWT_DEV){
    throw new Error("JWT_DEV must be defined!")
}
if(!process.env.MONGO_URI){
    throw new Error("MONGO_URI must be defined!")
}
if(!process.env.KAFKA_CLIENT_ID){
    throw new Error("KAFKA_CLIENT_ID must be defined!")
}
if(!process.env.KAFKA_BROKER_URL){
    throw new Error("KAFKA_BROKER_URL must be defined!")
}

// Start HTTP server FIRST so startup probe passes immediately
app.listen(3000, '0.0.0.0', () => {
    console.log("✅ Chat service HTTP server listening on port 3000");
});

// Connect to dependencies in background with retry logic
const connectMongoDB = async () => {
    await retryWithBackoff(
        async () => {
            await mongoose.connect(process.env.MONGO_URI!);
            console.log("✅ Connected to MongoDB");
        },
        { maxRetries: 30, initialDelayMs: 2000 },
        "MongoDB"
    );
};

const connectKafka = async () => {
    const brokers = process.env.KAFKA_BROKER_URL!
        .split(',')
        .map(host => host.trim())
        .filter(Boolean);

    if (!brokers.length) {
        throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
    }

    await retryWithBackoff(
        async () => {
            await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID!);
            console.log("✅ Kafka connected successfully");
        },
        { maxRetries: 30, initialDelayMs: 2000 },
        "Kafka"
    );
};

// Start listeners with retry logic
const startListeners = async () => {
    // Wait a bit for Kafka to be fully ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log("Starting Kafka listeners...");
    
    // Helper to start a listener with retry (non-blocking)
    const startListenerWithRetry = (name: string, listenerFactory: () => any) => {
        // Start in background - don't wait for it
        (async () => {
            try {
                await retryWithBackoff(
                    async () => {
                        const listener = listenerFactory();
                        await listener.listen();
                        console.log(`✅ ${name} started successfully`);
                    },
                    { maxRetries: 15, initialDelayMs: 3000 },
                    name
                );
            } catch (err) {
                console.error(`❌ Failed to start ${name} after retries:`, err);
                // Don't throw - continue with other listeners
            }
        })();
    };
    
    // Start all listeners in parallel (each with its own retry logic)
    startListenerWithRetry("MessageIngestListener", 
        () => new MessageIngestListener(kafkaWrapper.consumer('chat-service-message-ingest')));

    startListenerWithRetry("MessageReactionIngestedListener",
        () => new MessageReactionIngestedListener(kafkaWrapper.consumer('chat-service-message-reaction-ingested')));
    startListenerWithRetry("MessageReplyIngestedListener",
        () => new MessageReplyIngestedListener(kafkaWrapper.consumer('chat-service-message-reply-ingested')));

    startListenerWithRetry("AiMessageReplyListener",
        () => new AiMessageReplyListener(kafkaWrapper.consumer('chat-service-ai-message-reply')));

    startListenerWithRetry("RoomCreatedListener",
        () => new RoomCreatedListener(kafkaWrapper.consumer('chat-service-room-created')));
    startListenerWithRetry("RoomDeletedListener",
        () => new RoomDeletedListener(kafkaWrapper.consumer('chat-service-room-deleted')));
    startListenerWithRetry("RoomParticipantAddedListener",
        () => new RoomParticipantAddedListener(kafkaWrapper.consumer('chat-service-room-participant-added', 5)));

    startListenerWithRetry("AgentIngestedListener",
        () => new AgentIngestedListener(kafkaWrapper.consumer('chat-service-agent-ingested')));
    startListenerWithRetry("AgentCreatedListener",
        () => new AgentCreatedListener(kafkaWrapper.consumer('chat-service-agent-created')));
    startListenerWithRetry("AgentUpdatedListener",
        () => new AgentUpdatedListener(kafkaWrapper.consumer('chat-service-agent-updated')));
    startListenerWithRetry("UserCreatedListener",
        () => new UserCreatedListener(kafkaWrapper.consumer('chat-service-user-created')));
    startListenerWithRetry("UserUpdatedListener",
        () => new UserUpdatedListener(kafkaWrapper.consumer('chat-service-user-updated')));
    startListenerWithRetry("ProfileCreatedListener",
        () => new ProfileCreatedListener(kafkaWrapper.consumer('chat-service-profile-created')));
    startListenerWithRetry("ProfileUpdatedListener",
        () => new ProfileUpdatedListener(kafkaWrapper.consumer('chat-service-profile-updated')));

    console.log("✅ All Kafka listeners initialization calls completed (starting in background with retry)");
};

// Initialize connections and listeners in background
(async () => {
    try {
        // Connect to MongoDB and Kafka in parallel
        await Promise.all([
            connectMongoDB(),
            connectKafka(),
        ]);

        // Start listeners after connections are established
        startListeners().catch(err => {
            console.error("❌ Error starting listeners:", err);
            // Don't exit - service can still handle HTTP requests
        });

        console.log("✅ Chat service fully initialized");
    } catch (err) {
        console.error("❌ Error initializing chat service:", err);
        // Don't exit - service can still handle HTTP requests
        // Connections will retry in background
    }
})();



app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error(err);
    res.status(err.status || 500).json();
});