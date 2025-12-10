import { ChatRecommendationRequestedEvent } from '@aichatwar/shared';
import { AgentFeatures } from './feature-store';
import { featureStore } from './feature-store';
import { AgentFeature } from '../models/agent-feature';
import { RECOMMENDATION_CONFIG, OPEN_QUESTIONS_CONFIG } from '../config/constants';

export interface AgentMatch {
  agentId: string;
  score: number;
  matchReasons: string[];
  confidence: number;
}

export class AgentMatcher {
  /**
   * Find relevant agents for chat context
   */
  async findRelevantAgents(
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<AgentMatch[]> {
    // Get candidate agents
    const candidates = await this.getCandidateAgents(context);
    
    if (candidates.length === 0) {
      console.log(`[AgentMatcher] No candidate agents found for context`);
      return [];
    }

    // Filter agents
    const filtered = await this.filterAgents(candidates, context);
    
    if (filtered.length === 0) {
      console.log(`[AgentMatcher] No agents passed filtering`);
      return [];
    }

    // Score agents (rule-based for v1)
    const scored = await this.scoreWithRules(filtered, context);

    // Sort by score and return top N
    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored
      .filter(m => m.score >= RECOMMENDATION_CONFIG.MIN_AGENT_SCORE)
      .slice(0, RECOMMENDATION_CONFIG.MAX_RECOMMENDATIONS_PER_REQUEST);

    console.log(`[AgentMatcher] Found ${topMatches.length} relevant agents for room ${context.roomId}`);

    return topMatches;
  }

  /**
   * Get candidate agents based on topics and domain
   * Uses soft language scoring (not hard filtering)
   */
  private async getCandidateAgents(
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<AgentFeatures[]> {
    const query: any = {
      provisioningStatus: 'active', // CRITICAL: Only recommend successfully provisioned agents
      isPublic: true,
    };

    // Language: Use soft scoring instead of hard filtering
    // Don't filter by language in query - score it later in scoring formula
    // This allows multilingual agents and flexible matching

    // Filter by tags if topics provided
    if (context.topics && context.topics.length > 0) {
      query.tags = { $in: context.topics };
    }

    // Filter by specialization/domain if provided
    if (context.domain && context.domain !== 'general') {
      query.$or = [
        { specialization: { $regex: context.domain, $options: 'i' } },
        { profession: { $regex: context.domain, $options: 'i' } },
        ...(query.$or || []),
      ];
    }

    const agentFeatures = await AgentFeature.find(query)
      .limit(RECOMMENDATION_CONFIG.MAX_AGENT_CANDIDATES)
      .lean();

    return agentFeatures.map(af => ({
      agentId: af.agentId,
      name: af.name,
      displayName: af.displayName,
      tags: af.tags,
      skills: af.skills,
      specialization: af.specialization,
      profession: af.profession,
      popularity: af.popularity,
      rating: af.rating,
      embeddings: af.embeddings,
      isActive: af.isActive, // Deprecated: Use provisioningStatus
      provisioningStatus: (af.provisioningStatus || 'pending') as any, // Include provisioningStatus
      isPublic: af.isPublic,
      language: af.language,
    }));
  }

  /**
   * Filter agents (already in room, subscription tier limits, etc.)
   * Open Question Q3: RecService enforces ranking limits, AgentService enforces invitations
   */
  private async filterAgents(
    agents: AgentFeatures[],
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<AgentFeatures[]> {
    return agents.filter(agent => {
      // Filter out agents already in room
      if (context.agentsInRoom.includes(agent.agentId)) {
        return false;
      }

      // Filter by subscription tier (Open Question Q3: RecService limits candidate generation)
      if (OPEN_QUESTIONS_CONFIG.SUBSCRIPTION_TIER_ENABLED) {
        // TODO: Get user subscription tier from user features
        // TODO: Apply limits based on tier (free: 2, premium: 5, business: 10)
        // Note: AgentService will also enforce at invitation time to prevent bypass
      }

      return true;
    });
  }

  /**
   * Score agents using rule-based approach
   */
  private async scoreWithRules(
    agents: AgentFeatures[],
    context: ChatRecommendationRequestedEvent['data']
  ): Promise<AgentMatch[]> {
    // Get user features for personalization
    const userFeatures = await featureStore.getUserFeatures(context.userId);

    const matches: AgentMatch[] = [];

    for (const agent of agents) {
      const scores: {
        topicSimilarity: number;
        agentPopularity: number;
        userPreference: number;
        moodFit: number;
        recencyFreshness: number;
        languageSimilarity: number;
      } = {
        topicSimilarity: this.calculateTopicSimilarity(agent, context),
        agentPopularity: this.calculatePopularity(agent),
        userPreference: this.calculateUserPreference(agent, userFeatures),
        moodFit: this.calculateMoodFit(agent, context),
        recencyFreshness: this.calculateRecency(agent),
        languageSimilarity: this.calculateLanguageSimilarity(agent, context),
      };

      // Weighted score (updated formula with language soft scoring)
      const totalScore = 
        scores.topicSimilarity * RECOMMENDATION_CONFIG.SCORING_WEIGHTS.TOPIC_SIMILARITY +
        scores.agentPopularity * RECOMMENDATION_CONFIG.SCORING_WEIGHTS.AGENT_POPULARITY +
        scores.userPreference * RECOMMENDATION_CONFIG.SCORING_WEIGHTS.USER_PREFERENCE +
        scores.moodFit * RECOMMENDATION_CONFIG.SCORING_WEIGHTS.MOOD_FIT +
        scores.recencyFreshness * RECOMMENDATION_CONFIG.SCORING_WEIGHTS.RECENCY_FRESHNESS +
        scores.languageSimilarity * OPEN_QUESTIONS_CONFIG.LANGUAGE_SCORE_WEIGHT;

      // Generate match reasons
      const matchReasons = this.generateMatchReasons(agent, context, scores, userFeatures);

      matches.push({
        agentId: agent.agentId,
        score: Math.min(1, totalScore), // Cap at 1.0
        matchReasons,
        confidence: this.calculateConfidence(scores, matchReasons.length),
      });
    }

    return matches;
  }

  /**
   * Calculate topic similarity score
   */
  private calculateTopicSimilarity(
    agent: AgentFeatures,
    context: ChatRecommendationRequestedEvent['data']
  ): number {
    if (!context.topics || context.topics.length === 0) {
      return 0.5; // Neutral if no topics
    }

    const agentTags = [...agent.tags, ...agent.skills];
    if (agent.specialization) agentTags.push(agent.specialization);
    if (agent.profession) agentTags.push(agent.profession);

    const lowerAgentTags = agentTags.map(t => t.toLowerCase());
    const lowerTopics = context.topics.map(t => t.toLowerCase());

    let matches = 0;
    for (const topic of lowerTopics) {
      if (lowerAgentTags.some(tag => tag.includes(topic) || topic.includes(tag))) {
        matches++;
      }
    }

    return matches / context.topics.length;
  }

  /**
   * Calculate popularity score (normalized)
   */
  private calculatePopularity(agent: AgentFeatures): number {
    // Normalize popularity (assuming max popularity is around 1000)
    const normalizedPopularity = Math.min(agent.popularity / 1000, 1);
    // Combine with rating (0-5 scale, normalize to 0-1)
    const normalizedRating = agent.rating / 5;
    return (normalizedPopularity * 0.6 + normalizedRating * 0.4);
  }

  /**
   * Calculate user preference score
   */
  private calculateUserPreference(
    agent: AgentFeatures,
    userFeatures: any
  ): number {
    if (!userFeatures) {
      return 0.5; // Neutral if no user features
    }

    // Check if agent is in preferred agents
    if (userFeatures.preferredAgents.includes(agent.agentId)) {
      return 1.0;
    }

    // Check interaction history
    const interaction = userFeatures.interactionHistory.find(
      (ih: any) => ih.agentId === agent.agentId
    );

    if (interaction) {
      // Positive interactions boost score
      if (interaction.sentiment === 'positive') {
        return 0.8 + (interaction.interactionCount / 10) * 0.2; // Cap at 1.0
      } else if (interaction.sentiment === 'negative') {
        return 0.2; // Negative interactions reduce score
      }
      return 0.5; // Neutral interactions
    }

    // Check interest overlap
    const interestOverlap = this.calculateInterestOverlap(agent, userFeatures);
    return interestOverlap;
  }

  /**
   * Calculate interest overlap between agent and user
   */
  private calculateInterestOverlap(agent: AgentFeatures, userFeatures: any): number {
    const agentTags = [...agent.tags, ...agent.skills];
    const userInterests = [...userFeatures.interests, ...(userFeatures.preferences?.topics || [])];

    if (userInterests.length === 0) {
      return 0.5;
    }

    const lowerAgentTags = agentTags.map(t => t.toLowerCase());
    const lowerUserInterests = userInterests.map(t => t.toLowerCase());

    let matches = 0;
    for (const interest of lowerUserInterests) {
      if (lowerAgentTags.some(tag => tag.includes(interest) || interest.includes(tag))) {
        matches++;
      }
    }

    return matches / userInterests.length;
  }

  /**
   * Calculate mood fit score
   */
  private calculateMoodFit(
    agent: AgentFeatures,
    context: ChatRecommendationRequestedEvent['data']
  ): number {
    // For v1, simple heuristic: positive mood prefers popular agents
    // Can be enhanced with agent personality traits later
    if (context.sentiment === 'positive') {
      return agent.popularity > 100 ? 0.8 : 0.5;
    } else if (context.sentiment === 'negative') {
      // Negative mood might prefer supportive agents (future: check agent traits)
      return 0.6;
    }
    return 0.5; // Neutral
  }

  /**
   * Calculate recency/freshness score
   */
  private calculateRecency(agent: AgentFeatures): number {
    // For v1, assume all agents are recent
    // Can be enhanced with lastActivityAt field later
    return 0.7; // Default moderate score
  }

  /**
   * Calculate language similarity score (soft scoring)
   * Open Question Q2: Soft scoring instead of hard filtering
   */
  private calculateLanguageSimilarity(
    agent: AgentFeatures,
    context: ChatRecommendationRequestedEvent['data']
  ): number {
    if (!context.language || !agent.language) {
      return 0.5; // Neutral if no language specified
    }

    const userLang = context.language.toLowerCase();
    const agentLang = agent.language.toLowerCase();

    // Exact match
    if (userLang === agentLang) {
      return OPEN_QUESTIONS_CONFIG.LANGUAGE_EXACT_MATCH_SCORE;
    }

    // Dialect match (e.g., en-US vs en-GB)
    const userBase = userLang.split('-')[0];
    const agentBase = agentLang.split('-')[0];
    if (userBase === agentBase) {
      return OPEN_QUESTIONS_CONFIG.LANGUAGE_DIALECT_SCORE;
    }

    // Check if user is bilingual (future: check user features for known languages)
    // For now, if languages are related (same family), give partial score
    // This is a simplified heuristic - can be enhanced with language families
    const relatedLanguages: { [key: string]: string[] } = {
      'en': ['es', 'fr', 'de'], // English speakers often know Romance/Germanic languages
      'es': ['en', 'pt', 'fr'], // Spanish speakers often know English/Portuguese/French
      'fr': ['en', 'es', 'it'], // French speakers often know English/Spanish/Italian
    };

    if (relatedLanguages[userBase]?.includes(agentBase) || 
        relatedLanguages[agentBase]?.includes(userBase)) {
      return OPEN_QUESTIONS_CONFIG.LANGUAGE_BILINGUAL_SCORE;
    }

    // Mismatch (different language families)
    return OPEN_QUESTIONS_CONFIG.LANGUAGE_MISMATCH_SCORE;
  }

  /**
   * Generate match reasons for UX transparency
   */
  private generateMatchReasons(
    agent: AgentFeatures,
    context: ChatRecommendationRequestedEvent['data'],
    scores: any,
    userFeatures: any
  ): string[] {
    const reasons: string[] = [];

    if (scores.topicSimilarity > 0.7) {
      if (agent.specialization) {
        reasons.push(`Expert in ${agent.specialization}`);
      } else if (context.topics && context.topics.length > 0) {
        reasons.push(`Expert in ${context.topics[0]}`);
      }
    }

    if (scores.agentPopularity > 0.7) {
      reasons.push(`Popular ${agent.specialization || 'agent'}`);
    }

    if (scores.userPreference > 0.7) {
      if (userFeatures?.preferredAgents.includes(agent.agentId)) {
        reasons.push('Matches your preferences');
      } else {
        reasons.push('Similar to agents you like');
      }
    }

    if (agent.rating >= 4.5) {
      reasons.push(`High rating (${agent.rating.toFixed(1)}/5)`);
    }

    if (context.domain && agent.specialization?.toLowerCase().includes(context.domain.toLowerCase())) {
      reasons.push(`${context.domain} specialist`);
    }

    return reasons.length > 0 ? reasons : ['Relevant to your conversation'];
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    scores: {
      topicSimilarity: number;
      agentPopularity: number;
      userPreference: number;
      moodFit: number;
      recencyFreshness: number;
      languageSimilarity: number;
    },
    reasonCount: number
  ): number {
    // Confidence based on score distribution and number of match reasons
    const scoreValues = Object.values(scores) as number[];
    const scoreVariance = Math.max(...scoreValues) - Math.min(...scoreValues);
    const baseConfidence = 0.5 + (scoreVariance * 0.3) + (reasonCount * 0.1);
    return Math.min(1, baseConfidence);
  }
}

export const agentMatcher = new AgentMatcher();

