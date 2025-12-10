# Open Questions - Recommendations & Answers

This document addresses the open questions from the design and provides recommendations based on best practices and system architecture.

## Q1: Utility Recommendation Priority

**Question**: Should utility recommendations be included in the same response or separate?

**Recommendation**: ✅ **Same response, but separated by type** - UPDATED

**Rationale** (Updated based on industry best practices):
- Single round-trip: One event per refresh cycle
- Clean separation: `agentRecommendations` vs `utilityRecommendations` arrays
- Easy UI rendering: AI-Chat-Host can render them independently
- Co-ranking possible: RecService can deprioritize utilities if agents make more sense
- Industry standard: TikTok, Instagram return utilities in same response but separated

**Implementation**:
- `UTILITY_IN_SAME_RESPONSE: true` (default)
- `SEPARATE_BY_TYPE: true` (separate arrays in response)
- `UTILITY_MAX_COUNT: 2` (limit utility recommendations)
- Response structure:
  ```typescript
  {
    agentRecommendations: Recommendation[],
    utilityRecommendations: Recommendation[],
    metadata: { roomId, generatedAt, totalCount }
  }
  ```

**Previous Answer** (Refined):
- Same response: ✅ Correct
- Scored together: ✅ Still true, but now separated in structure for cleaner UI

## Q2: Language Matching Strictness

**Question**: How strict should language matching be? Exact match or fuzzy?

**Recommendation**: ✅ **Soft scoring (weighted factor in scoring formula)** - UPDATED

**Rationale** (Updated based on industry best practices):
- Real conversations often mix languages
- Some agents can handle multiple languages
- Hard filters remove useful suggestions
- Soft scoring provides flexibility + better UX
- Industry standard: Instagram, YouTube use soft scoring

**Implementation**:
- `LANGUAGE_SOFT_SCORING: true` (default)
- `LANGUAGE_SCORE_WEIGHT: 0.2` (weight in scoring formula)
- Scoring levels:
  - Exact match: 1.0
  - Dialect match (en-US vs en-GB): 0.7
  - Bilingual/related languages: 0.4
  - Mismatch: 0.1
  - Not allowed: 0.0
- Integrated into scoring formula: `score = ... + language_similarity * 0.2`

**Previous Answer** (Replaced):
- Exact match with fallback: Too restrictive, doesn't handle multilingual users well

## Q3: Subscription Tier Limits

**Question**: How should subscription tiers limit recommendations?

**Recommendation**: ✅ **RecService for ranking limits + AgentService for enforcement** - UPDATED

**Rationale** (Updated based on industry best practices):
- Two-layer approach: Prevents bypass and ensures clean separation
- RecService: Limits candidate generation (free: 2, premium: 5, business: 10)
- AgentService: Prevents invitations that exceed tier (enforcement layer)
- Industry standard: LinkedIn, Tinder enforce at recommendation layer

**Implementation**:
- `SUBSCRIPTION_TIER_ENABLED: false` (not in v1, but structure ready)
- `SUBSCRIPTION_TIER_LIMITS`: { free: 2, premium: 5, business: 10 }
- RecService: Limits number of agent recommendations based on tier
- AgentService: Validates tier before allowing invitation (prevents API bypass)

**Why Not API Gateway?**
- Shouldn't know business logic

**Why Not AI-Chat-Host?**
- Only consumes recommendations; doesn't enforce

**Previous Answer** (Enhanced):
- Not in v1: ✅ Still true
- But now: Clear two-layer enforcement strategy defined

## Q4: Utility Action Execution

**Question**: Who executes utility actions (summarize, sentiment)? Recommendation Service or AI-Chat-Host?

**Recommendation**: ✅ **AI-Chat-Host executes, Recommendation Service only suggests**

**Rationale**:
- Separation of concerns: Recommendation Service suggests, AI-Chat-Host executes
- Flexibility: AI-Chat-Host can choose how to execute (different UI, different services)
- Simpler Recommendation Service: Doesn't need to know about execution details
- Future: Can move execution to Recommendation Service if needed

**Implementation**:
- `UTILITY_EXECUTION_SERVICE: 'ai-chat-host'` (default)
- Recommendation Service returns `action` and `label`
- AI-Chat-Host handles execution (calls AI Gateway, shows UI, etc.)

**Alternative Considered**:
- Recommendation Service executes: More coupling, harder to change execution logic

## Q5: Caching Strategy

**Question**: Should recommendation results be cached? For how long?

**Recommendation**: ✅ **Multi-level caching strategy** - UPDATED

**Rationale** (Updated based on industry best practices):
- Multi-level approach: Different caching at different layers
- RecService: Cache features, embeddings, popular candidates (not full responses)
- AI-Chat-Host: Cache full responses briefly (30-60s) to prevent hammering
- Industry standard: YouTube, TikTok cache features/embeddings, not final recommendations

**Implementation - RecService**:
- `CACHE_AGENT_FEATURES: true` (1 hour TTL)
- `CACHE_USER_FEATURES: true` (1 hour TTL)
- `CACHE_EMBEDDINGS: true` (30 minutes TTL)
- `CACHE_POPULAR_CANDIDATES: true` (5 minutes TTL - popular agents by topic)
- `CACHE_RECOMMENDATIONS_IN_RECSERVICE: false` (never cache full responses)

**Implementation - AI-Chat-Host** (to be implemented):
- `CACHE_RECOMMENDATIONS_IN_AICHATHOST: true` (30-60 seconds TTL)
- Cache key: `roomId + userId + contextHash`
- Prevents hammering RecService on every message
- Use case: User scrolls up/down chat - shouldn't trigger rec calls repeatedly

**What NOT to Cache**:
- Full recommendation responses per room (too context-specific)
- Utility suggestions (context-dependent)
- Chat mood / last messages (changes quickly)

**Previous Answer** (Enhanced):
- Cache features: ✅ Still true
- But now: Added AI-Chat-Host response caching layer

## Summary of Default Answers (Updated)

| Question | Answer | Config Key |
|----------|--------|------------|
| Q1: Utility priority | Same response, separated by type | `UTILITY_IN_SAME_RESPONSE: true`, `SEPARATE_BY_TYPE: true` |
| Q2: Language matching | Soft scoring (weighted) | `LANGUAGE_SOFT_SCORING: true`, `LANGUAGE_SCORE_WEIGHT: 0.2` |
| Q3: Subscription tiers | RecService limits + AgentService enforcement | `SUBSCRIPTION_TIER_ENABLED: false` (v1), structure ready |
| Q4: Utility execution | AI-Chat-Host executes | `UTILITY_EXECUTION_SERVICE: 'ai-chat-host'` |
| Q5: Caching | Multi-level: Features in RecService + Responses in AI-Chat-Host | `CACHE_AGENT_FEATURES: true`, `CACHE_RECOMMENDATIONS_IN_AICHATHOST: true` |

## Configuration Override

All answers can be overridden via environment variables:
- `UTILITY_IN_SAME_RESPONSE=true/false`
- `LANGUAGE_MATCH_STRICT=true/false`
- `LANGUAGE_FALLBACK_TO_DEFAULT=true/false`
- `SUBSCRIPTION_TIER_ENABLED=true/false`
- `UTILITY_EXECUTION_SERVICE=recommendation|ai-chat-host`
- `CACHE_RECOMMENDATIONS=true/false`
- `CACHE_AGENT_FEATURES=true/false`
- `CACHE_USER_FEATURES=true/false`

