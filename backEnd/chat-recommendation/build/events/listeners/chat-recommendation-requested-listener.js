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
exports.ChatRecommendationRequestedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const recommendation_coordinator_1 = require("../../services/recommendation-coordinator");
/**
 * ChatRecommendationRequestedListener
 *
 * Consumes ChatRecommendationRequestedEvent from ai-chat-host
 * Processes the request and publishes ChatRecommendationsReadyEvent
 */
class ChatRecommendationRequestedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ChatRecommendationRequested;
        this.groupId = 'recommendation-chat-recommendation-requested';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { requestId, userId, roomId, topics, sentiment, intent, domain } = data;
            console.log(`[ChatRecommendationRequestedListener] Processing recommendation request ${requestId} for room ${roomId}`);
            try {
                // Process the recommendation request
                yield recommendation_coordinator_1.recommendationCoordinator.processChatRequest(data);
                console.log(`[ChatRecommendationRequestedListener] ✅ Successfully processed request ${requestId}`);
            }
            catch (error) {
                console.error(`[ChatRecommendationRequestedListener] ❌ Error processing request ${requestId}:`, error);
                // Handle error - publish empty recommendations or error event
                yield recommendation_coordinator_1.recommendationCoordinator.handleError(requestId, error);
                // Don't throw - acknowledge to prevent infinite retries
                // The error handler will publish an appropriate response
            }
            yield this.ack();
        });
    }
}
exports.ChatRecommendationRequestedListener = ChatRecommendationRequestedListener;
