// Configuration constants for Recommendation Service

export const RECOMMENDATION_CONFIG = {
  // Recommendation limits
  MAX_RECOMMENDATIONS_PER_REQUEST: parseInt(process.env.MAX_RECOMMENDATIONS_PER_REQUEST || '5', 10),
  MIN_RECOMMENDATION_SCORE: parseFloat(process.env.MIN_RECOMMENDATION_SCORE || '0.3'),
  
  // Scoring weights (rule-based)
  // Updated formula includes language soft scoring
  // Adjusted weights to accommodate language (0.2): 0.25 + 0.15 + 0.2 + 0.15 + 0.1 + 0.2 = 1.05
  // Normalized to 1.0: divide by 1.05, or adjust individual weights
  // Final: 0.24 + 0.14 + 0.19 + 0.14 + 0.1 + 0.19 = 1.0
  SCORING_WEIGHTS: {
    TOPIC_SIMILARITY: parseFloat(process.env.TOPIC_SIMILARITY_WEIGHT || '0.24'),
    AGENT_POPULARITY: parseFloat(process.env.AGENT_POPULARITY_WEIGHT || '0.14'),
    USER_PREFERENCE: parseFloat(process.env.USER_PREFERENCE_WEIGHT || '0.19'),
    MOOD_FIT: parseFloat(process.env.MOOD_FIT_WEIGHT || '0.14'),
    RECENCY_FRESHNESS: parseFloat(process.env.RECENCY_FRESHNESS_WEIGHT || '0.1'),
    // Note: Language similarity is added separately with OPEN_QUESTIONS_CONFIG.LANGUAGE_SCORE_WEIGHT (0.19)
  },
  
  // AI scoring weights (when AI is enabled)
  AI_SCORE_WEIGHT: parseFloat(process.env.AI_SCORE_WEIGHT || '0.6'),
  RULE_SCORE_WEIGHT: parseFloat(process.env.RULE_SCORE_WEIGHT || '0.4'),
  
  // Agent matching
  MAX_AGENT_CANDIDATES: parseInt(process.env.MAX_AGENT_CANDIDATES || '50', 10),
  MIN_AGENT_SCORE: parseFloat(process.env.MIN_AGENT_SCORE || '0.3'),
  
  // Utility recommendations
  ENABLE_UTILITY_RECOMMENDATIONS: process.env.ENABLE_UTILITY_RECOMMENDATIONS !== 'false',
  MIN_UTILITY_SCORE: parseFloat(process.env.MIN_UTILITY_SCORE || '0.4'),
  
  // Request timeout
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10), // 30 seconds
};

export const AI_CONFIG = {
  PROVIDER: process.env.AI_PROVIDER || 'ai-gateway',
  GATEWAY_URL: process.env.AI_GATEWAY_URL || 'http://ai-gateway-srv:3000',
  MODEL: process.env.AI_MODEL || 'gpt-4o-mini',
  ENABLED: process.env.AI_ENABLED !== 'false',
  EMBEDDINGS_ENABLED: process.env.AI_EMBEDDINGS_ENABLED !== 'false',
};

export const FEATURE_STORE_CONFIG = {
  CACHE_TTL_SECONDS: parseInt(process.env.FEATURE_CACHE_TTL_SECONDS || '3600', 10), // 1 hour
  ENABLE_CACHE: process.env.FEATURE_CACHE_ENABLED !== 'false',
};

export const KAFKA_CONFIG = {
  BROKERS: (process.env.KAFKA_BROKER_URL || 'redpanda-srv:9092').split(','),
  CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'recommendation',
};

// Open Questions - Answers (based on industry best practices)
export const OPEN_QUESTIONS_CONFIG = {
  // Q1: Utility recommendation priority
  // Answer: Same response, but separated by type (agentRecommendations vs utilityRecommendations)
  // This allows clean separation in UI while keeping single round-trip
  ENABLE_UTILITY_RECOMMENDATIONS: true, // Enable/disable utility recommendations
  UTILITY_IN_SAME_RESPONSE: true,
  UTILITY_MAX_COUNT: 2, // Max utility recommendations per response
  SEPARATE_BY_TYPE: true, // Separate arrays in response structure
  
  // Q2: Language matching strictness
  // Answer: Soft scoring (weighted factor in scoring formula)
  // More flexible than exact match, supports multilingual users
  LANGUAGE_SOFT_SCORING: true,
  LANGUAGE_SCORE_WEIGHT: 0.19, // Weight in scoring formula (adjusted to sum to 1.0 with other weights)
  LANGUAGE_EXACT_MATCH_SCORE: 1.0,
  LANGUAGE_DIALECT_SCORE: 0.7, // e.g., en-US vs en-GB
  LANGUAGE_BILINGUAL_SCORE: 0.4, // User speaks both languages
  LANGUAGE_MISMATCH_SCORE: 0.1,
  LANGUAGE_NOT_ALLOWED_SCORE: 0.0,
  
  // Q3: Subscription tier limits
  // Answer: RecService for ranking limits + AgentService for enforcement
  // Two-layer approach prevents bypass and ensures clean separation
  SUBSCRIPTION_TIER_ENABLED: false, // Not in v1, but structure ready
  SUBSCRIPTION_TIER_LIMITS: {
    free: 2,      // Free tier: 2 agent recommendations
    premium: 5,  // Premium: 5
    business: 10, // Business: 10
  },
  
  // Q4: Utility action execution
  // Answer: AI-Chat-Host executes, Recommendation Service only suggests
  // Hard rule: Recommendation systems do NOT execute actions (keeps them stateless)
  UTILITY_EXECUTION_SERVICE: 'ai-chat-host', // 'recommendation' or 'ai-chat-host'
  
  // Q5: Caching strategy
  // Answer: Multi-level caching
  // - RecService: Cache features (agent/user), embeddings, popular candidates
  // - AI-Chat-Host: Cache full responses briefly (30-60s) to prevent hammering
  // - Never cache: Full recommendations per room (too context-specific)
  CACHE_RECOMMENDATIONS_IN_RECSERVICE: false, // Don't cache full responses in RecService
  CACHE_RECOMMENDATIONS_IN_AICHATHOST: true,  // AI-Chat-Host should cache responses
  AICHATHOST_CACHE_TTL_SECONDS: 45, // 30-60 seconds in AI-Chat-Host
  CACHE_AGENT_FEATURES: true,
  CACHE_USER_FEATURES: true,
  CACHE_EMBEDDINGS: true, // Cache embeddings (change slowly)
  CACHE_POPULAR_CANDIDATES: true, // Cache popular agent candidates by topic
  FEATURE_CACHE_TTL_SECONDS: 3600, // 1 hour for features
  EMBEDDING_CACHE_TTL_SECONDS: 1800, // 30 minutes for embeddings
  CANDIDATE_CACHE_TTL_SECONDS: 300, // 5 minutes for popular candidates
};

