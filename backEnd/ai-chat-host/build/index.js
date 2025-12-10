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
const app_1 = require("./app");
const mongoose_1 = __importDefault(require("mongoose"));
const kafka_client_1 = require("./kafka-client");
const redis_client_1 = require("./redis-client");
const message_created_listener_1 = require("./events/listeners/message-created-listener");
const agent_ingested_listener_1 = require("./events/listeners/agent-ingested-listener");
const agent_updated_listener_1 = require("./events/listeners/agent-updated-listener");
const room_participant_added_listener_1 = require("./events/listeners/room-participant-added-listener");
const startService = () => __awaiter(void 0, void 0, void 0, function* () {
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
        yield mongoose_1.default.connect(process.env.MONGO_URI);
        console.log("✅ [AI Chat Host] Connected to MongoDB");
        // ------------ Redis ------------
        console.log("🔌 [AI Chat Host] Connecting to Redis...");
        yield redis_client_1.redisWrapper.connect();
        console.log("✅ [AI Chat Host] Connected to Redis");
        // ------------ Kafka ------------
        console.log("🔌 [AI Chat Host] Connecting to Kafka...");
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];
        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
        }
        yield kafka_client_1.kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ai-chat-host');
        console.log("✅ [AI Chat Host] Connected to Kafka");
        // ------------- Event Listeners ------------
        console.log("🚀 [AI Chat Host] Starting Kafka listeners...");
        // Message created listener - main listener for triggering analysis
        console.log("📥 [AI Chat Host] Starting MessageCreatedListener...");
        new message_created_listener_1.MessageCreatedListener(kafka_client_1.kafkaWrapper.consumer('ai-chat-host-message-created')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start MessageCreatedListener:", err);
        });
        // Agent ingested listener - builds agent projections for matching
        console.log("📥 [AI Chat Host] Starting AgentIngestedListener...");
        new agent_ingested_listener_1.AgentIngestedListener(kafka_client_1.kafkaWrapper.consumer('ai-chat-host-agent-ingested')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start AgentIngestedListener:", err);
        });
        // Agent updated listener - updates agent projections
        console.log("📥 [AI Chat Host] Starting AgentUpdatedListener...");
        new agent_updated_listener_1.AgentUpdatedListener(kafka_client_1.kafkaWrapper.consumer('ai-chat-host-agent-updated')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start AgentUpdatedListener:", err);
        });
        // Room participant added listener - tracks agent joins
        console.log("📥 [AI Chat Host] Starting RoomParticipantAddedListener...");
        new room_participant_added_listener_1.RoomParticipantAddedListener(kafka_client_1.kafkaWrapper.consumer('ai-chat-host-room-participant-added')).listen().catch(err => {
            console.error("❌ [AI Chat Host] Failed to start RoomParticipantAddedListener:", err);
        });
        console.log("✅ [AI Chat Host] All Kafka listeners started");
        // Start HTTP server (for health checks)
        const PORT = process.env.PORT || 3000;
        app_1.app.listen(PORT, () => {
            console.log(`✅ [AI Chat Host] Service listening on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ [AI Chat Host] Error starting service:", err);
        process.exit(1);
    }
});
// Graceful shutdown
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [AI Chat Host] SIGTERM received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield redis_client_1.redisWrapper.disconnect();
    yield mongoose_1.default.disconnect();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [AI Chat Host] SIGINT received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield redis_client_1.redisWrapper.disconnect();
    yield mongoose_1.default.disconnect();
    process.exit(0);
}));
startService();
// Error handlers
app_1.app.use(function (req, res, next) {
    next({ status: 404 });
});
app_1.app.use(function (err, req, res, next) {
    console.error('[AI Chat Host] Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
