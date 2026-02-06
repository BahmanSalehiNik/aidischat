
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { kafkaWrapper } from './kafka-client';
import { UserCreatedListener, UserUpdatedListener, UserDeletedListener } from "./events/listeners/user/userListener";
import { ProfileCreatedListener, ProfileUpdatedListener, ProfileDeletedListener } from "./events/listeners/user/profileListener";
import { PostCreatedListener, PostUpdatedListener, PostDeletedListener } from "./events/listeners/post/postListener";
import { CommentCreatedListener, CommentDeletedListener } from "./events/listeners/comment/commentListener";
import { ReactionCreatedListener, ReactionDeletedListener } from "./events/listeners/reaction/reactionListener";
import { FriendshipAcceptedListener, 
    FriendshipUpdatedListener, 
    FriendshipRequestedListener } from "./events/listeners/friendship/friendshipListener";
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdProfileCreated, GroupIdProfileUpdated, GroupIdPostCreated, GroupIdPostUpdated, GroupIdPostDeleted, GroupIdCommentCreated, GroupIdCommentDeleted, GroupIdReactionCreated, GroupIdReactionDeleted, GroupIdFreindshipAccepted, GroupIdFreindshipRequested, GroupIdFreindshipUpdated, GroupIdAgentFeedAnswerReceived } from "./events/queGroupNames";
import { AgentFeedAnswerReceivedListener } from "./events/listeners/agentFeedAnswerReceived/agentFeedAnswerReceivedListener";
import { AgentIngestedListener } from "./events/listeners/agent/agentIngestedListener";
import { trendingWorker } from "./modules/trending/trendingWorker";
import { agentFeedScannerWorker } from "./workers/agent-feed-scanner";
import { retryWithBackoff } from "./utils/connection-retry";


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

// Azure Storage credentials are optional - feed service can work without them
// but signed URL generation for media will be disabled if not provided
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    console.log("Azure Storage credentials found - signed URL generation enabled");
} else {
    console.log("Azure Storage credentials not found - signed URL generation disabled");
}

// Start HTTP server FIRST so startup probe passes immediately
app.listen(3000, '0.0.0.0', () => {
    console.log("✅ Feed service HTTP server listening on port 3000");
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
    // Each listener uses its own consumer group to avoid partition assignment conflicts
    // User listeners - each with separate consumer group
    new UserCreatedListener(kafkaWrapper.consumer(GroupIdUserCreated)).listen();
    new UserUpdatedListener(kafkaWrapper.consumer(GroupIdUserUpdated)).listen();
    new UserDeletedListener(kafkaWrapper.consumer("feed-user-deleted")).listen();

    // Profile listeners - each with separate consumer group
    new ProfileCreatedListener(kafkaWrapper.consumer(GroupIdProfileCreated)).listen();
    new ProfileUpdatedListener(kafkaWrapper.consumer(GroupIdProfileUpdated)).listen();
    new ProfileDeletedListener(kafkaWrapper.consumer("feed-profile-deleted")).listen();

    // Post listeners - each with separate consumer group
    new PostCreatedListener(kafkaWrapper.consumer(GroupIdPostCreated)).listen();
    new PostUpdatedListener(kafkaWrapper.consumer(GroupIdPostUpdated)).listen();
    new PostDeletedListener(kafkaWrapper.consumer(GroupIdPostDeleted)).listen();

    // Comment listeners - each with separate consumer group
    new CommentCreatedListener(kafkaWrapper.consumer(GroupIdCommentCreated)).listen();
    new CommentDeletedListener(kafkaWrapper.consumer(GroupIdCommentDeleted)).listen();

    // Reaction listeners - each with separate consumer group
    new ReactionCreatedListener(kafkaWrapper.consumer(GroupIdReactionCreated)).listen();
    new ReactionDeletedListener(kafkaWrapper.consumer(GroupIdReactionDeleted)).listen();

    // Friendship listeners - each with separate consumer group
    new FriendshipRequestedListener(kafkaWrapper.consumer(GroupIdFreindshipRequested)).listen();
    new FriendshipAcceptedListener(kafkaWrapper.consumer(GroupIdFreindshipAccepted)).listen();
    new FriendshipUpdatedListener(kafkaWrapper.consumer(GroupIdFreindshipUpdated)).listen();

    // Agent feed answer received listener - marks feed entries as seen after processing
    new AgentFeedAnswerReceivedListener(kafkaWrapper.consumer(GroupIdAgentFeedAnswerReceived)).listen();

    // Agent ingested listener - caches agent displayName so feeds don't show raw agentId
    new AgentIngestedListener(kafkaWrapper.consumer('feed-agent-ingested')).listen();

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

        // Start background workers
        trendingWorker.start();
        agentFeedScannerWorker.start();

        console.log("✅ Feed service fully initialized");
    } catch (err) {
        console.error("❌ Error initializing feed service:", err);
        // Don't exit - service can still handle HTTP requests
        // Connections will retry in background
    }
})();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - let the error handler deal with it
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately - log and let error handler try to handle it
});