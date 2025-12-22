"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const connection_retry_1 = require("./utils/connection-retry");
const avatar_routes_1 = require("./routes/avatar-routes");
const PORT = parseInt(process.env.PORT || '3000', 10);
const startService = () => __awaiter(void 0, void 0, void 0, function* () {
    // Validate environment variables
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI must be defined!");
    }
    try {
        // ------------ Mongoose ----------
        console.log("🔌 [AR Avatar] Connecting to MongoDB...");
        yield (0, connection_retry_1.retryWithBackoff)(() => __awaiter(void 0, void 0, void 0, function* () {
            yield mongoose_1.default.connect(process.env.MONGO_URI);
            console.log("✅ [AR Avatar] Connected to MongoDB");
        }), { maxRetries: 30, initialDelayMs: 2000 }, "MongoDB");
        // ------------ Kafka (Optional for Phase 1) ------------
        if (process.env.KAFKA_BROKER_URL) {
            console.log("🔌 [AR Avatar] Connecting to Kafka...");
            const brokers = process.env.KAFKA_BROKER_URL
                ? process.env.KAFKA_BROKER_URL.split(',').map(host => host.trim())
                : [];
            if (brokers.length) {
                yield (0, connection_retry_1.retryWithBackoff)(() => __awaiter(void 0, void 0, void 0, function* () {
                    yield kafka_client_1.kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ar-avatar');
                    console.log("✅ [AR Avatar] Connected to Kafka");
                }), { maxRetries: 30, initialDelayMs: 2000 }, "Kafka");
                // ------------ Event Listeners ------------
                console.log("🚀 [AR Avatar] Starting Kafka listeners...");
                // Agent ingested listener - triggers avatar generation
                // Use retry logic for listener setup
                yield (0, connection_retry_1.retryWithBackoff)(() => __awaiter(void 0, void 0, void 0, function* () {
                    const { AgentIngestedListener } = yield Promise.resolve().then(() => __importStar(require('./events/listeners/agent-ingested-listener')));
                    console.log("📥 [AR Avatar] Starting AgentIngestedListener...");
                    const listener = new AgentIngestedListener(kafka_client_1.kafkaWrapper.consumer('ar-avatar-agent-ingested'));
                    yield listener.listen();
                    console.log("✅ [AR Avatar] AgentIngestedListener started successfully");
                }), { maxRetries: 10, initialDelayMs: 3000 }, "AgentIngestedListener");
                console.log("✅ [AR Avatar] All Kafka listeners started");
            }
        }
        // ------------ Routes ------------
        const { ttsRouter } = yield Promise.resolve().then(() => __importStar(require('./routes/tts-routes')));
        app_1.app.use('/api/avatars', avatar_routes_1.avatarRouter);
        app_1.app.use('/api/tts', ttsRouter);
        // ------------ Catch-all route (must be after all routes) ------------
        const { NotFoundError } = yield Promise.resolve().then(() => __importStar(require('@aichatwar/shared')));
        const { errorHandler } = yield Promise.resolve().then(() => __importStar(require('@aichatwar/shared')));
        app_1.app.all('*', () => __awaiter(void 0, void 0, void 0, function* () {
            throw new NotFoundError();
        }));
        app_1.app.use(errorHandler);
        // ------------ Start Server ------------
        app_1.app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ [AR Avatar] Service listening on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("❌ [AR Avatar] Error starting service:", err);
        process.exit(1);
    }
});
// Graceful shutdown
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [AR Avatar] SIGTERM received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield mongoose_1.default.connection.close();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🛑 [AR Avatar] SIGINT received, shutting down gracefully...');
    yield kafka_client_1.kafkaWrapper.disconnect();
    yield mongoose_1.default.connection.close();
    process.exit(0);
}));
process.on('unhandledRejection', (err) => {
    console.error('[AR Avatar] Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
    console.error('[AR Avatar] Uncaught exception:', err);
    process.exit(1);
});
startService();
