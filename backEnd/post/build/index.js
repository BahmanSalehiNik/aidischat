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
const friendshipListener_1 = require("./events/listeners/friendship/friendshipListener");
const mediaListener_1 = require("./events/listeners/media/mediaListener");
const agentDraftPostApprovedListener_1 = require("./events/listeners/agentDraft/agentDraftPostApprovedListener");
const queGroupNames_1 = require("./events/queGroupNames");
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
    // Azure Storage credentials are optional - post service can work without them
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
        // ------------- Kafka ------------
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
        // Profile listeners - each with separate consumer group
        new profileListener_1.ProfileCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdProfileCreated)).listen();
        new profileListener_1.ProfileUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdProfileUpdated)).listen();
        // Friendship listeners - each with separate consumer group
        new friendshipListener_1.FriendshipAcceptedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipAccepted)).listen();
        new friendshipListener_1.FriendshipRequestedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipRequested)).listen();
        new friendshipListener_1.FriendshipUpdatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdFreindshipUpdated)).listen();
        // Media listeners - each with separate consumer group
        new mediaListener_1.MediaCreatedListener(kafka_client_1.kafkaWrapper.consumer(queGroupNames_1.GroupIdMediaCreated)).listen();
        // Agent Draft listeners
        new agentDraftPostApprovedListener_1.AgentDraftPostApprovedListener(kafka_client_1.kafkaWrapper.consumer('post-service-agent-draft-post-approved')).listen();
        console.log("All Kafka listeners started successfully");
        app_1.app.listen(3000, '0.0.0.0', () => {
            console.log("app listening on port 3000! post service");
        });
    }
    catch (err) {
        console.error("Error starting service:", err);
        process.exit(1);
    }
});
startMongoose();
