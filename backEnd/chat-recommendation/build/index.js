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
const chat_recommendation_requested_listener_1 = require("./events/listeners/chat-recommendation-requested-listener");
const agent_ingested_listener_1 = require("./events/listeners/agent-ingested-listener");
const agent_created_listener_1 = require("./events/listeners/agent-created-listener");
const agent_updated_listener_1 = require("./events/listeners/agent-updated-listener");
const agent_creation_failed_listener_1 = require("./events/listeners/agent-creation-failed-listener");
const agent_deleted_listener_1 = require("./events/listeners/agent-deleted-listener");
const user_created_listener_1 = require("./events/listeners/user-created-listener");
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
        console.log("🔌 [Recommendation] Connecting to MongoDB...");
        yield mongoose_1.default.connect(process.env.MONGO_URI);
        console.log("✅ [Recommendation] Connected to MongoDB");
        // ------------ Kafka ------------
        console.log("🔌 [Recommendation] Connecting to Kafka...");
        const brokers = process.env.KAFKA_BROKER_URL
            ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
            : [];
        if (!brokers.length) {
            throw new Error('❌ KAFKA_BROKER_URL is not defined or is empty.');
        }
        yield kafka_client_1.kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'recommendation');
        console.log("✅ [Recommendation] Connected to Kafka");
        // ------------- Event Listeners ------------
        console.log("🚀 [Recommendation] Starting Kafka listeners...");
        // Chat recommendation requested listener - main listener
        console.log("📥 [Recommendation] Starting ChatRecommendationRequestedListener...");
        new chat_recommendation_requested_listener_1.ChatRecommendationRequestedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-chat-recommendation-requested')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start ChatRecommendationRequestedListener:", err);
        });
        // Agent ingested listener - builds agent feature projections (has full profile data)
        // Note: AgentIngestedEvent has full character/profile data, but is only published on creation
        // We keep this for initial creation with full data
        console.log("📥 [Recommendation] Starting AgentIngestedListener...");
        new agent_ingested_listener_1.AgentIngestedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-agent-ingested')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentIngestedListener:", err);
        });
        // Agent created listener - handles AgentCreatedEvent (published after provisioning)
        // Note: AgentCreatedEvent doesn't have profile data, so we create minimal entry
        console.log("📥 [Recommendation] Starting AgentCreatedListener...");
        new agent_created_listener_1.AgentCreatedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-agent-created')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentCreatedListener:", err);
        });
        // Agent updated listener - handles AgentUpdatedEvent (published on updates)
        // Note: AgentUpdatedEvent doesn't have profile data, so we rely on AgentIngestedEvent
        // TODO: Consider enhancing AgentUpdatedEvent to include profile data
        console.log("📥 [Recommendation] Starting AgentUpdatedListener...");
        new agent_updated_listener_1.AgentUpdatedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-agent-updated')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentUpdatedListener:", err);
        });
        // Agent creation failed listener - marks agent as inactive when provisioning fails
        // CRITICAL: Prevents recommending agents that failed to be created
        console.log("📥 [Recommendation] Starting AgentCreationFailedListener...");
        new agent_creation_failed_listener_1.AgentCreationFailedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-agent-creation-failed')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentCreationFailedListener:", err);
        });
        // Agent deleted listener - marks agent as inactive when deleted
        // CRITICAL: Prevents recommending deleted agents
        console.log("📥 [Recommendation] Starting AgentDeletedListener...");
        new agent_deleted_listener_1.AgentDeletedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-agent-deleted')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start AgentDeletedListener:", err);
        });
        // User created listener - initializes user feature projections
        console.log("📥 [Recommendation] Starting UserCreatedListener...");
        new user_created_listener_1.UserCreatedListener(kafka_client_1.kafkaWrapper.consumer('recommendation-user-created')).listen().catch(err => {
            console.error("❌ [Recommendation] Failed to start UserCreatedListener:", err);
        });
        console.log("✅ [Recommendation] All Kafka listeners started");
        // Start HTTP server (for health checks)
        const PORT = process.env.PORT || 3000;
        app_1.app.listen(PORT, () => {
            console.log(`✅ [Recommendation] Service listening on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ [Recommendation] Error starting service:", err);
        process.exit(1);
    }
});
// Graceful shutdown
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [Recommendation] SIGTERM received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield mongoose_1.default.disconnect();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [Recommendation] SIGINT received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield mongoose_1.default.disconnect();
    process.exit(0);
}));
startService();
// Error handlers
app_1.app.use(function (req, res, next) {
    next({ status: 404 });
});
app_1.app.use(function (err, req, res, next) {
    console.error('[Recommendation] Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
