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
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureStore = exports.FeatureStore = void 0;
const agent_feature_1 = require("../models/agent-feature");
const user_feature_1 = require("../models/user-feature");
const constants_1 = require("../config/constants");
const agent_feature_2 = require("../models/agent-feature");
// In-memory cache for features
const agentFeatureCache = new Map();
const userFeatureCache = new Map();
class FeatureStore {
    /**
     * Get user features (with caching if enabled)
     */
    getUserFeatures(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
                const cached = userFeatureCache.get(userId);
                if (cached) {
                    const age = Date.now() - cached.timestamp;
                    if (age < constants_1.FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
                        return cached.data;
                    }
                    userFeatureCache.delete(userId);
                }
            }
            // Fetch from database
            const userFeature = yield user_feature_1.UserFeature.findOne({ userId });
            if (!userFeature) {
                return null;
            }
            const features = {
                userId: userFeature.userId,
                interests: userFeature.interests,
                preferredAgents: userFeature.preferredAgents,
                interactionHistory: userFeature.interactionHistory,
                embeddings: userFeature.embeddings,
                preferences: userFeature.preferences,
                language: userFeature.language,
            };
            // Cache if enabled
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
                userFeatureCache.set(userId, {
                    data: features,
                    timestamp: Date.now(),
                });
            }
            return features;
        });
    }
    /**
     * Get agent features (with caching if enabled)
     */
    getAgentFeatures(agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache first
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
                const cached = agentFeatureCache.get(agentId);
                if (cached) {
                    const age = Date.now() - cached.timestamp;
                    if (age < constants_1.FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
                        return cached.data;
                    }
                    agentFeatureCache.delete(agentId);
                }
            }
            // Fetch from database
            const agentFeature = yield agent_feature_1.AgentFeature.findOne({ agentId });
            if (!agentFeature) {
                return null;
            }
            const features = {
                agentId: agentFeature.agentId,
                name: agentFeature.name,
                displayName: agentFeature.displayName,
                tags: agentFeature.tags,
                skills: agentFeature.skills,
                specialization: agentFeature.specialization,
                profession: agentFeature.profession,
                popularity: agentFeature.popularity,
                rating: agentFeature.rating,
                embeddings: agentFeature.embeddings,
                isActive: agentFeature.isActive, // Deprecated
                provisioningStatus: agentFeature.provisioningStatus || agent_feature_2.AgentProvisioningStatus.Pending,
                isPublic: agentFeature.isPublic,
                language: agentFeature.language,
            };
            // Cache if enabled
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
                agentFeatureCache.set(agentId, {
                    data: features,
                    timestamp: Date.now(),
                });
            }
            return features;
        });
    }
    /**
     * Get multiple agent features in batch
     */
    getAgentFeaturesBatch(agentIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = new Map();
            const uncachedIds = [];
            // Check cache for each agent
            for (const agentId of agentIds) {
                if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
                    const cached = agentFeatureCache.get(agentId);
                    if (cached) {
                        const age = Date.now() - cached.timestamp;
                        if (age < constants_1.FEATURE_STORE_CONFIG.CACHE_TTL_SECONDS * 1000) {
                            result.set(agentId, cached.data);
                            continue;
                        }
                        agentFeatureCache.delete(agentId);
                    }
                }
                uncachedIds.push(agentId);
            }
            // Fetch uncached agents from database
            if (uncachedIds.length > 0) {
                const agentFeatures = yield agent_feature_1.AgentFeature.find({
                    agentId: { $in: uncachedIds },
                });
                for (const agentFeature of agentFeatures) {
                    const features = {
                        agentId: agentFeature.agentId,
                        name: agentFeature.name,
                        displayName: agentFeature.displayName,
                        tags: agentFeature.tags,
                        skills: agentFeature.skills,
                        specialization: agentFeature.specialization,
                        profession: agentFeature.profession,
                        popularity: agentFeature.popularity,
                        rating: agentFeature.rating,
                        embeddings: agentFeature.embeddings,
                        isActive: agentFeature.isActive, // Deprecated
                        provisioningStatus: agentFeature.provisioningStatus || agent_feature_2.AgentProvisioningStatus.Pending,
                        isPublic: agentFeature.isPublic,
                        language: agentFeature.language,
                    };
                    result.set(agentFeature.agentId, features);
                    // Cache if enabled
                    if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
                        agentFeatureCache.set(agentFeature.agentId, {
                            data: features,
                            timestamp: Date.now(),
                        });
                    }
                }
            }
            return result;
        });
    }
    /**
     * Update user features (called from event listeners)
     */
    updateUserFeatures(userId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            yield user_feature_1.UserFeature.findOneAndUpdate({ userId }, Object.assign(Object.assign({}, updates), { lastUpdatedAt: new Date() }), { upsert: true, new: true });
            // Invalidate cache
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_USER_FEATURES) {
                userFeatureCache.delete(userId);
            }
        });
    }
    /**
     * Update agent features (called from event listeners)
     */
    updateAgentFeatures(agentId, updates) {
        return __awaiter(this, void 0, void 0, function* () {
            yield agent_feature_1.AgentFeature.findOneAndUpdate({ agentId }, Object.assign(Object.assign({}, updates), { lastUpdatedAt: new Date() }), { upsert: true, new: true });
            // Invalidate cache
            if (constants_1.OPEN_QUESTIONS_CONFIG.CACHE_AGENT_FEATURES) {
                agentFeatureCache.delete(agentId);
            }
        });
    }
}
exports.FeatureStore = FeatureStore;
exports.featureStore = new FeatureStore();
