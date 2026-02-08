import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener, UserDeletedListener } from './events/listeners/userListeners';
import { FriendshipAcceptedListener, FriendshipRequestedListener, FriendshipUpdatedListener } from './events/listeners/friendshipListeners';
import {
    GroupIdUserCreated,
    GroupIdUserUpdated,
    GroupIdUserDeleted,
    GroupIdAgentCreationReplySuccess,
    GroupIdAgentCreationReplyFailed,
    GroupIdFriendshipAccepted,
    GroupIdFriendshipRequested,
    GroupIdFriendshipUpdated
} from './events/listeners/queGroupNames';
import { AgentCreationReplySuccessListener, AgentCreationReplyFailedListener } from './events/listeners/agentProvisionListeners';
import { eventRetryWorker } from './workers/event-retry-worker';
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
    console.log("✅ Agents service HTTP server listening on port 3000");
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

const startListeners = () => {
    // Start event listeners
    new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
    new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();
    new UserDeletedListener(kafkaWrapper.consumer(GroupIdUserDeleted)).listen();
    new AgentCreationReplySuccessListener(kafkaWrapper.consumer(GroupIdAgentCreationReplySuccess)).listen();
    new AgentCreationReplyFailedListener(kafkaWrapper.consumer(GroupIdAgentCreationReplyFailed)).listen();
    new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFriendshipRequested)).listen();
    new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFriendshipAccepted)).listen();
    new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFriendshipUpdated)).listen();
    console.log("✅ All Kafka listeners started successfully");
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
        startListeners();

        // Start background worker to retry publishing events for agents created during Kafka outages
        eventRetryWorker.start();

        console.log("✅ Agents service fully initialized");
    } catch (err) {
        console.error("❌ Error initializing agents service:", err);
        // Don't exit - service can still handle HTTP requests
        // Connections will retry in background
    }
})();