import { app } from "./app";
import express from "express";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { retryWithBackoff } from './utils/connection-retry';
import {
    FriendshipAcceptedListener,
    FriendshipRequestedListener,
    FriendshipUpdatedListener,
} from './events/listeners/friendship/friendshipListeners';
import {
    GroupIdFriendshipAccepted,
    GroupIdFriendshipRequested,
    GroupIdFriendshipUpdated,
} from './events/queGroupNames';

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
    console.log("✅ User service HTTP server listening on port 3000");
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

// Initialize connections in background
(async () => {
    try {
        // Connect to MongoDB and Kafka in parallel
        await Promise.all([
            connectMongoDB(),
            connectKafka(),
        ]);

        // Start Kafka listeners (read models / projections)
        try {
            new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFriendshipRequested)).listen();
            new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFriendshipAccepted)).listen();
            new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFriendshipUpdated)).listen();
            console.log("✅ User service Kafka listeners started");
        } catch (err) {
            console.error("❌ Failed to start user service Kafka listeners:", err);
        }

        console.log("✅ User service fully initialized");
    } catch (err) {
        console.error("❌ Error initializing user service:", err);
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