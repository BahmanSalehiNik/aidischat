import { ChatRecommendationRequestedEvent, ChatRecommendationsReadyEvent, Recommendation } from '@aichatwar/shared';
import { chatRecommender } from './chat-recommender';
import { RecommendationRequest } from '../models/recommendation-request';
import { ChatRecommendationsReadyPublisher } from '../events/publishers/chat-recommendations-ready-publisher';
import { kafkaWrapper } from '../kafka-client';
import { RECOMMENDATION_CONFIG } from '../config/constants';

export class RecommendationCoordinator {
  /**
   * Process chat recommendation request
   * Main entry point for handling recommendation requests
   */
  async processChatRequest(
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<void> {
    const { requestId, userId, roomId } = context;

    console.log(`[RecommendationCoordinator] Processing request ${requestId} for user ${userId}, room ${roomId}`);

    try {
      // 1. Store request as pending
      const request = RecommendationRequest.build({
        requestId,
        contextType: 'chat',
        userId,
        roomId,
        status: 'processing',
        requestedAt: new Date(context.timestamp),
      });
      await request.save();

      // 2. Generate recommendations
      const recommendations = await chatRecommender.findRecommendations(context);

      // 3. Update request status
      request.status = 'completed';
      request.completedAt = new Date();
      request.recommendations = recommendations;
      await request.save();

      // 4. Publish recommendations ready event
      await this.publishRecommendations(requestId, recommendations, undefined, roomId);

      console.log(`[RecommendationCoordinator] ✅ Successfully processed request ${requestId}, published ${recommendations.length} recommendations`);
    } catch (error: any) {
      console.error(`[RecommendationCoordinator] ❌ Error processing request ${requestId}:`, error);
      
      // Update request status to failed
      await RecommendationRequest.findOneAndUpdate(
        { requestId },
        {
          status: 'failed',
          completedAt: new Date(),
          error: error.message || 'Unknown error',
        }
      );

      // Publish empty recommendations or error response
      await this.publishRecommendations(requestId, [], error.message);
      
      throw error;
    }
  }

  /**
   * Publish ChatRecommendationsReadyEvent
   * Open Question Q1: Separate agent and utility recommendations in response structure
   */
  private async publishRecommendations(
    requestId: string,
    recommendations: Recommendation[],
    error?: string,
    roomId?: string
  ): Promise<void> {
    // Separate recommendations by type
    const agentRecommendations = error ? [] : recommendations.filter(r => r.type === 'agent');
    const utilityRecommendations = error ? [] : recommendations.filter(r => r.type === 'utility');

    await new ChatRecommendationsReadyPublisher(kafkaWrapper.producer).publish({
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
    } else {
      console.log(`[RecommendationCoordinator] Published ${agentRecommendations.length} agent + ${utilityRecommendations.length} utility recommendations for request ${requestId}`);
    }
  }

  /**
   * Handle errors (called from listener)
   */
  async handleError(requestId: string, error: Error): Promise<void> {
    console.error(`[RecommendationCoordinator] Handling error for request ${requestId}:`, error);

    // Update request status
    await RecommendationRequest.findOneAndUpdate(
      { requestId },
      {
        status: 'failed',
        completedAt: new Date(),
        error: error.message || 'Unknown error',
      }
    );

      // Publish empty recommendations
      await this.publishRecommendations(requestId, [], error.message, undefined);
  }
}

export const recommendationCoordinator = new RecommendationCoordinator();

