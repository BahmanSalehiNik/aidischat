"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const kafka_client_1 = require("./kafka-client");
const userListener_1 = require("./events/listeners/user/userListener");
const profileListener_1 = require("./events/listeners/user/profileListener");
const postListener_1 = require("./events/listeners/post/postListener");
const commentListener_1 = require("./events/listeners/comment/commentListener");
const reactionListener_1 = require("./events/listeners/reaction/reactionListener");
const friendshipListener_1 = require("./events/listeners/friendship/friendshipListener");
const queGroupNames_1 = require("./events/queGroupNames");
const agentFeedAnswerReceivedListener_1 = require("./events/listeners/agentFeedAnswerReceived/agentFeedAnswerReceivedListener");
const trendingWorker_1 = require("./modules/trending/trendingWorker");
const agent_feed_scanner_1 = require("./workers/agent-feed-scanner");
const startMongoose = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!process.env.JWT_DEV) {
        throw new Error("JWT_DEV must be defined!");
    }
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    if (!process.env.KAFKA_CLIENT_ID) {
        throw new Error("KAFKA_CLIENT_ID must be defined!");
    }
    if (!process.env.KAFKA_BROKER_URL) {
        throw new Error("KAFKA_BROKER_URL must be defined!");
    }
    // Azure Storage credentials are optional - feed service can work without them
    // but signed URL generation for media will be disabled if not provided
    if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
        console.log("Azure Storage credentials found - signed URL generation enabled");
    }
    else {
        console.log("Azure Storage credentials not found - signed URL generation disabled");
    }
    try {
        // ------------ Mongoose ----------
        yield mongoose_1.default.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
        // ------------ Kafka ------------
        console.log("Connecting to Kafka at:", process.env.KAFKA_BROKER_URL);
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];
        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKERS is not defined or is empty.');
        }
        yield kafka_client_1.kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
        console.log("Kafka connected successfully");
        // ------------- Event Listeners ------------
        // Each listener uses its own consumer group to avoid partition assignment conflicts
        // User listeners - each with separate consumer group
        new userListener_1.UserCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdUserCreated)).listen();
        new userListener_1.UserUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdUserUpdated)).listen();
        new userListener_1.UserDeletedListener(kafka_client_1.kafkaWrapper.consumer("feed-user-deleted")).listen();
        // Profile listeners - each with separate consumer group
        new profileListener_1.ProfileCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdProfileCreated)).listen();
        new profileListener_1.ProfileUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdProfileUpdated)).listen();
        new profileListener_1.ProfileDeletedListener(kafka_client_1.kafkaWrapper.consumer("feed-profile-deleted")).listen();
        // Post listeners - each with separate consumer group
        new postListener_1.PostCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdPostCreated)).listen();
        new postListener_1.PostUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdPostUpdated)).listen();
        new postListener_1.PostDeletedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdPostDeleted)).listen();
        // Comment listeners - each with separate consumer group
        new commentListener_1.CommentCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdCommentCreated)).listen();
        new commentListener_1.CommentDeletedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdCommentDeleted)).listen();
        // Reaction listeners - each with separate consumer group
        new reactionListener_1.ReactionCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdReactionCreated)).listen();
        new reactionListener_1.ReactionDeletedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdReactionDeleted)).listen();
        // Friendship listeners - each with separate consumer group
        new friendshipListener_1.FriendshipRequestedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipRequested)).listen();
        new friendshipListener_1.FriendshipAcceptedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipAccepted)).listen();
        new friendshipListener_1.FriendshipUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipUpdated)).listen();
        // Agent feed answer received listener - marks feed entries as seen after processing
        new agentFeedAnswerReceivedListener_1.AgentFeedAnswerReceivedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdAgentFeedAnswerReceived)).listen();
        console.log("All Kafka listeners started successfully");
        trendingWorker_1.trendingWorker.start();
        agent_feed_scanner_1.agentFeedScannerWorker.start();
        app_1.app.listen(3000, () => {
            console.log("app listening on port 3000! feed service");
        });
    }
    catch (err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - let the error handler deal with it
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately - log and let error handler try to handle it
});
startMongoose();
