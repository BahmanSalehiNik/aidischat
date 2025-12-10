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
exports.recommendationCoordinator = exports.RecommendationCoordinator = void 0;
const chat_recommender_1 = require("./chat-recommender");
const recommendation_request_1 = require("../models/recommendation-request");
const chat_recommendations_ready_publisher_1 = require("../events/publishers/chat-recommendations-ready-publisher");
const kafka_client_1 = require("../kafka-client");
class RecommendationCoordinator {
    /**
     * Process chat recommendation request
     * Main entry point for handling recommendation requests
     */
    processChatRequest(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { requestId, userId, roomId } = context;
            console.log(`[RecommendationCoordinator] Processing request ${requestId} for user ${userId}, room ${roomId}`);
            try {
                // 1. Store request as pending
                const request = recommendation_request_1.RecommendationRequest.build({
                    requestId,
                    contextType: 'chat',
                    userId,
                    roomId,
                    status: 'processing',
                    requestedAt: new Date(context.timestamp),
                });
                yield request.save();
                // 2. Generate recommendations
                const recommendations = yield chat_recommender_1.chatRecommender.findRecommendations(context);
                // 3. Update request status
                request.status = 'completed';
                request.completedAt = new Date();
                request.recommendations = recommendations;
                yield request.save();
                // 4. Publish recommendations ready event
                yield this.publishRecommendations(requestId, recommendations, undefined, roomId);
                console.log(`[RecommendationCoordinator] ✅ Successfully processed request ${requestId}, published ${recommendations.length} recommendations`);
            }
            catch (error) {
                console.error(`[RecommendationCoordinator] ❌ Error processing request ${requestId}:`, error);
                // Update request status to failed
                yield recommendation_request_1.RecommendationRequest.findOneAndUpdate({ requestId }, {
                    status: 'failed',
                    completedAt: new Date(),
                    error: error.message || 'Unknown error',
                });
                // Publish empty recommendations or error response
                yield this.publishRecommendations(requestId, [], error.message);
                throw error;
            }
        });
    }
    /**
     * Publish ChatRecommendationsReadyEvent
     * Open Question Q1: Separate agent and utility recommendations in response structure
     */
    publishRecommendations(requestId, recommendations, error, roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Separate recommendations by type
            const agentRecommendations = error ? [] : recommendations.filter(r => r.type === 'agent');
            const utilityRecommendations = error ? [] : recommendations.filter(r => r.type === 'utility');
            yield new chat_recommendations_ready_publisher_1.ChatRecommendationsReadyPublisher(kafka_client_1.kafkaWrapper.producer).publish({
                requestId,
                agentRecommendations,
                utilityRecommendations,
                metadata: {
                    roomId,
                    generatedAt: new Date().toISOString(),
                    totalCount: agentRecommendations.length + utilityRecommendations.length,
                },
                timestamp: new Date().toISOString(),
            });
            if (error) {
                console.log(`[RecommendationCoordinator] Published empty recommendations for request ${requestId} due to error: ${error}`);
            }
            else {
                console.log(`[RecommendationCoordinator] Published ${agentRecommendations.length} agent + ${utilityRecommendations.length} utility recommendations for request ${requestId}`);
            }
        });
    }
    /**
     * Handle errors (called from listener)
     */
    handleError(requestId, error) {
        return __awaiter(this, void 0, void 0, function* () {
            console.error(`[RecommendationCoordinator] Handling error for request ${requestId}:`, error);
            // Update request status
            yield recommendation_request_1.RecommendationRequest.findOneAndUpdate({ requestId }, {
                status: 'failed',
                completedAt: new Date(),
                error: error.message || 'Unknown error',
            });
            // Publish empty recommendations
            yield this.publishRecommendations(requestId, [], error.message, undefined);
        });
    }
}
exports.RecommendationCoordinator = RecommendationCoordinator;
exports.recommendationCoordinator = new RecommendationCoordinator();
