import { Listener, Subjects, ChatRecommendationRequestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { recommendationCoordinator } from '../../services/recommendation-coordinator';

/**
 * ChatRecommendationRequestedListener
 * 
 * Consumes ChatRecommendationRequestedEvent from ai-chat-host
 * Processes the request and publishes ChatRecommendationsReadyEvent
 */
export class ChatRecommendationRequestedListener extends Listener<ChatRecommendationRequestedEvent> {
  readonly topic = Subjects.ChatRecommendationRequested;
  readonly groupId = 'recommendation-chat-recommendation-requested';

  async onMessage(data: ChatRecommendationRequestedEvent['data'], payload: EachMessagePayload) {
    const { requestId, userId, roomId, topics, sentiment, intent, domain } = data;

    console.log(`[ChatRecommendationRequestedListener] Processing recommendation request ${requestId} for room ${roomId}`);

    try {
      // Process the recommendation request
      await recommendationCoordinator.processChatRequest(data);

      console.log(`[ChatRecommendationRequestedListener] ✅ Successfully processed request ${requestId}`);
    } catch (error: any) {
      console.error(`[ChatRecommendationRequestedListener] ❌ Error processing request ${requestId}:`, error);
      
      // Handle error - publish empty recommendations or error event
      await recommendationCoordinator.handleError(requestId, error);
      
      // Don't throw - acknowledge to prevent infinite retries
      // The error handler will publish an appropriate response
    }

    await this.ack();
  }
}

