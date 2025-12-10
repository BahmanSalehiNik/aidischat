import { ChatRecommendationRequestedEvent, Recommendation } from '@aichatwar/shared';
import { RECOMMENDATION_CONFIG, OPEN_QUESTIONS_CONFIG } from '../config/constants';

export class UtilityRecommender {
  /**
   * Generate utility recommendations based on chat context
   * Open Question Q1: Utility recommendations included in same response
   */
  async generateUtilityRecommendations(
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<Recommendation[]> {
    if (!OPEN_QUESTIONS_CONFIG.ENABLE_UTILITY_RECOMMENDATIONS) {
      return [];
    }

    const utilities: Recommendation[] = [];

    // 1. Summarize utility (if conversation is long enough)
    if (context.messageCount >= 10) {
      utilities.push({
        type: 'utility',
        action: 'summarize',
        label: 'Get a quick summary',
        score: this.calculateSummarizeScore(context),
        reason: 'Conversation has enough messages for a meaningful summary',
      });
    }

    // 2. Sentiment overview (if conversation has sentiment variation)
    if (context.sentiment !== 'neutral' && context.messageCount >= 5) {
      utilities.push({
        type: 'utility',
        action: 'sentiment_overview',
        label: 'See the emotional trend',
        score: this.calculateSentimentScore(context),
        reason: `Conversation has ${context.sentiment} sentiment`,
      });
    }

    // 3. Topic suggestion (if conversation is getting long)
    if (context.messageCount >= 15) {
      utilities.push({
        type: 'utility',
        action: 'topic_suggestion',
        label: 'Explore related topics',
        score: this.calculateTopicSuggestionScore(context),
        reason: 'Conversation might benefit from topic exploration',
      });
    }

    // 4. Related rooms (if topics are well-defined)
    if (context.topics && context.topics.length >= 2) {
      utilities.push({
        type: 'utility',
        action: 'related_rooms',
        label: 'Find similar conversations',
        score: this.calculateRelatedRoomsScore(context),
        reason: 'Multiple topics suggest related conversations exist',
      });
    }

    // Filter by minimum score and limit count
    const filtered = utilities
      .filter(u => u.score >= RECOMMENDATION_CONFIG.MIN_UTILITY_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, OPEN_QUESTIONS_CONFIG.UTILITY_MAX_COUNT);

    console.log(`[UtilityRecommender] Generated ${filtered.length} utility recommendations`);

    return filtered;
  }

  /**
   * Calculate score for summarize utility
   */
  private calculateSummarizeScore(context: ChatRecommendationRequestedEvent['data']): number {
    // More messages = higher score (up to a point)
    const messageScore = Math.min(context.messageCount / 30, 1.0);
    // Longer conversations benefit more from summaries
    return 0.5 + (messageScore * 0.5);
  }

  /**
   * Calculate score for sentiment overview utility
   */
  private calculateSentimentScore(context: ChatRecommendationRequestedEvent['data']): number {
    // Strong sentiment (positive or negative) = higher score
    if (context.sentiment === 'positive' || context.sentiment === 'negative') {
      return 0.6;
    }
    return 0.4;
  }

  /**
   * Calculate score for topic suggestion utility
   */
  private calculateTopicSuggestionScore(context: ChatRecommendationRequestedEvent['data']): number {
    // More topics = higher score
    const topicScore = context.topics ? Math.min(context.topics.length / 5, 1.0) : 0;
    return 0.4 + (topicScore * 0.3);
  }

  /**
   * Calculate score for related rooms utility
   */
  private calculateRelatedRoomsScore(context: ChatRecommendationRequestedEvent['data']): number {
    // Well-defined topics = higher score
    if (context.topics && context.topics.length >= 2) {
      return 0.5;
    }
    return 0.3;
  }
}

export const utilityRecommender = new UtilityRecommender();

