import { ChatRecommendationRequestedEvent, Recommendation } from '@aichatwar/shared';
import { agentMatcher, AgentMatch } from './agent-matcher';
import { utilityRecommender } from './utility-recommender';
import { featureStore } from './feature-store';
import { RECOMMENDATION_CONFIG, OPEN_QUESTIONS_CONFIG } from '../config/constants';

export class ChatRecommender {
  /**
   * Find all recommendations for chat context
   * Combines agent recommendations and utility recommendations
   */
  async findRecommendations(
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // 1. Find agent recommendations
    const agentMatches = await agentMatcher.findRelevantAgents(context);
    
    // Convert agent matches to recommendations
    for (const match of agentMatches) {
      // Get agent features for name/displayName
      const agentFeatures = await featureStore.getAgentFeatures(match.agentId);
      
      recommendations.push({
        type: 'agent',
        agentId: match.agentId,
        score: match.score,
        reason: match.matchReasons.join(', ') || 'Relevant to your conversation',
        metadata: {
          matchReasons: match.matchReasons,
          confidence: match.confidence,
          name: agentFeatures?.name,
          displayName: agentFeatures?.displayName,
        },
      });
    }

    // 2. Find utility recommendations (Open Question Q1: Same response)
    let utilityRecommendations: Recommendation[] = [];
    if (OPEN_QUESTIONS_CONFIG.UTILITY_IN_SAME_RESPONSE) {
      utilityRecommendations = await utilityRecommender.generateUtilityRecommendations(context);
      recommendations.push(...utilityRecommendations);
    }

    // 3. Score and rank all recommendations together
    const scored = this.scoreRecommendations(recommendations, context);

    // 4. Sort by score and limit
    scored.sort((a, b) => b.score - a.score);
    const topRecommendations = scored.slice(0, RECOMMENDATION_CONFIG.MAX_RECOMMENDATIONS_PER_REQUEST);

    console.log(`[ChatRecommender] Generated ${topRecommendations.length} total recommendations (${agentMatches.length} agents, ${utilityRecommendations.length} utilities)`);

    return topRecommendations;
  }

  /**
   * Score recommendations (can adjust scores based on context)
   */
  private scoreRecommendations(
    recommendations: Recommendation[],
    context: ChatRecommendationRequestedEvent['data']
  ): Recommendation[] {
    // For v1, scores are already calculated, just return as-is
    // Future: Can apply context-specific adjustments here
    return recommendations;
  }
}

export const chatRecommender = new ChatRecommender();

