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
exports.chatRecommender = exports.ChatRecommender = void 0;
const agent_matcher_1 = require("./agent-matcher");
const utility_recommender_1 = require("./utility-recommender");
const feature_store_1 = require("./feature-store");
const constants_1 = require("../config/constants");
class ChatRecommender {
    /**
     * Find all recommendations for chat context
     * Combines agent recommendations and utility recommendations
     */
    findRecommendations(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const recommendations = [];
            // 1. Find agent recommendations
            const agentMatches = yield agent_matcher_1.agentMatcher.findRelevantAgents(context);
            // Convert agent matches to recommendations
            for (const match of agentMatches) {
                // Get agent features for name/displayName
                const agentFeatures = yield feature_store_1.featureStore.getAgentFeatures(match.agentId);
                recommendations.push({
                    type: 'agent',
                    agentId: match.agentId,
                    score: match.score,
                    reason: match.matchReasons.join(', ') || 'Relevant to your conversation',
                    metadata: {
                        matchReasons: match.matchReasons,
                        confidence: match.confidence,
                        name: agentFeatures === null || agentFeatures === void 0 ? void 0 : agentFeatures.name,
                        displayName: agentFeatures === null || agentFeatures === void 0 ? void 0 : agentFeatures.displayName,
                    },
                });
            }
            // 2. Find utility recommendations (Open Question Q1: Same response)
            let utilityRecommendations = [];
            if (constants_1.OPEN_QUESTIONS_CONFIG.UTILITY_IN_SAME_RESPONSE) {
                utilityRecommendations = yield utility_recommender_1.utilityRecommender.generateUtilityRecommendations(context);
                recommendations.push(...utilityRecommendations);
            }
            // 3. Score and rank all recommendations together
            const scored = this.scoreRecommendations(recommendations, context);
            // 4. Sort by score and limit
            scored.sort((a, b) => b.score - a.score);
            const topRecommendations = scored.slice(0, constants_1.RECOMMENDATION_CONFIG.MAX_RECOMMENDATIONS_PER_REQUEST);
            console.log(`[ChatRecommender] Generated ${topRecommendations.length} total recommendations (${agentMatches.length} agents, ${utilityRecommendations.length} utilities)`);
            return topRecommendations;
        });
    }
    /**
     * Score recommendations (can adjust scores based on context)
     */
    scoreRecommendations(recommendations, context) {
        // For v1, scores are already calculated, just return as-is
        // Future: Can apply context-specific adjustments here
        return recommendations;
    }
}
exports.ChatRecommender = ChatRecommender;
exports.chatRecommender = new ChatRecommender();
