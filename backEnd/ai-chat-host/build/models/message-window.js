"use strict";
// Message window model for in-memory and Redis storage
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageWindowModel = void 0;
// In-memory storage for active windows
const windowCache = new Map();
class MessageWindowModel {
    /**
     * Get window from cache or Redis
     */
    static get(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check in-memory cache first
            const cached = windowCache.get(roomId);
            if (cached) {
                return cached;
            }
            // Try to load from Redis
            try {
                const { redisWrapper } = yield Promise.resolve().then(() => __importStar(require('../redis-client')));
                const key = `window:${roomId}`;
                const data = yield redisWrapper.client.get(key);
                if (data) {
                    const window = JSON.parse(data);
                    // Convert date strings back to Date objects
                    window.lastMessageAt = new Date(window.lastMessageAt);
                    window.lastAnalyzedAt = window.lastAnalyzedAt ? new Date(window.lastAnalyzedAt) : null;
                    window.messages = window.messages.map((m) => (Object.assign(Object.assign({}, m), { createdAt: new Date(m.createdAt) })));
                    // Cache in memory
                    windowCache.set(roomId, window);
                    return window;
                }
            }
            catch (error) {
                console.error(`[MessageWindowModel] Error loading from Redis for room ${roomId}:`, error);
            }
            return null;
        });
    }
    /**
     * Save window to cache and Redis
     */
    static save(window) {
        return __awaiter(this, void 0, void 0, function* () {
            // Update in-memory cache
            windowCache.set(window.roomId, window);
            // Persist to Redis
            try {
                const { redisWrapper } = yield Promise.resolve().then(() => __importStar(require('../redis-client')));
                const { REDIS_CONFIG } = yield Promise.resolve().then(() => __importStar(require('../config/constants')));
                const key = `window:${window.roomId}`;
                const data = JSON.stringify(window);
                yield redisWrapper.client.setEx(key, REDIS_CONFIG.WINDOW_TTL_SECONDS, data);
            }
            catch (error) {
                console.error(`[MessageWindowModel] Error saving to Redis for room ${window.roomId}:`, error);
            }
        });
    }
    /**
     * Create a new window
     */
    static create(roomId) {
        return {
            roomId,
            messages: [],
            lastMessageAt: new Date(),
            lastAnalyzedAt: null,
            analysisCount: 0,
        };
    }
    /**
     * Clear window (remove from cache and Redis)
     */
    static clear(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            windowCache.delete(roomId);
            try {
                const { redisWrapper } = yield Promise.resolve().then(() => __importStar(require('../redis-client')));
                const key = `window:${roomId}`;
                yield redisWrapper.client.del(key);
            }
            catch (error) {
                console.error(`[MessageWindowModel] Error clearing Redis for room ${roomId}:`, error);
            }
        });
    }
}
exports.MessageWindowModel = MessageWindowModel;
