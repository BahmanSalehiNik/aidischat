# Recommendation Service - Design Document

## Overview

The Recommendation Service is a central recommendation platform that provides intelligent recommendations across multiple contexts (chat, feed, explore, profile, etc.). It uses event-driven architecture and can call AI providers for advanced matching (embeddings, similarity models).

**Architecture Philosophy**: 
- Central recommendation platform used by all services
- Event-driven communication (no direct API calls)
- Can call AI providers for advanced matching
- Supports multiple contexts (chat, feed, explore, etc.)
- Future: Integrates with Ad Service for blended recommendations

## Core Responsibilities

1. **Chat Recommendations**: Provide agent and content recommendations for chat contexts
2. **Utility Suggestions**: Provide meta suggestions (summarize, sentiment overview, topic suggestions, etc.)
3. **Multi-Context Support**: Handle recommendations for feed, explore, profile, etc. (future)
4. **AI-Enhanced Matching**: Use AI providers for embeddings and similarity matching
5. **User Preference Learning**: Learn from user interactions to improve recommendations
6. **Feature-Based Matching**: Use user/agent/content features for recommendations

## Service Structure

```
recommendation/
├── src/
│   ├── index.ts                 # Service bootstrap
│   ├── app.ts                  # Express app (health checks)
│   ├── kafka-client.ts         # Kafka producer/consumer setup
│   ├── models/
│   │   ├── agent-feature.ts    # Agent features/projections
│   │   ├── user-feature.ts     # User features/projections
│   │   └── recommendation-request.ts  # Track requests
│   ├── events/
│   │   ├── listeners/
│   │   │   └── chat-recommendation-requested-listener.ts
│   │   └── publishers/
│   │       └── chat-recommendations-ready-publisher.ts
│   ├── services/
│   │   ├── chat-recommender.ts        # Chat-specific recommendation logic
│   │   ├── agent-matcher.ts           # Agent matching service
│   │   ├── ai-provider-client.ts      # AI provider integration
│   │   ├── feature-store.ts           # Feature retrieval
│   │   └── recommendation-coordinator.ts  # Coordinate recommendations
│   └── config/
│       └── constants.ts        # Configurable thresholds
```

## Event Flow

### Chat Recommendation Flow

```
ChatRecommendationRequestedEvent (Kafka)
    ↓
ChatRecommendationRequestedListener
    ↓
RecommendationCoordinator.processChatRequest(context)
    ↓
ChatRecommender.findRecommendations(context)
    ↓
AgentMatcher.findRelevantAgents(context)
    ↓
[Optional] AIProviderClient.getEmbeddings() / findSimilar()
    ↓
FeatureStore.getUserFeatures(userId)
FeatureStore.getAgentFeatures(agentIds)
    ↓
Score and rank recommendations
    ↓
ChatRecommendationsReadyEvent (Kafka) → ai-chat-host
```

## Core Services

### 1. ChatRecommender

**Responsibilities:**
- Handle chat-specific recommendation logic
- Coordinate agent matching
- Generate recommendation types (agents, utility actions, etc.)
- Score and rank recommendations
- Generate utility suggestions (summarize, sentiment overview, topic suggestions)

**Key Methods:**
```typescript
class ChatRecommender {
  async findRecommendations(context: ChatContext): Promise<Recommendation[]>
  private async findAgentRecommendations(context: ChatContext): Promise<AgentRecommendation[]>
  private async findUtilityRecommendations(context: ChatContext): Promise<UtilityRecommendation[]>
  private async scoreRecommendations(recommendations: Recommendation[]): Promise<Recommendation[]>
  private async generateUtilitySuggestions(context: ChatContext): Promise<UtilityRecommendation[]>
}
```

**Utility Recommendation Types:**
- `summarize`: Offer to summarize the conversation
- `sentiment_overview`: Show emotional trend of conversation
- `topic_suggestion`: Suggest related topics to explore
- `related_rooms`: Suggest similar rooms/conversations
- `question_prompt`: Suggest asking a question

**Scoring Formula (Rule-Based v1 - Updated with Language Soft Scoring):**
```
score = 
  0.24 * topic_similarity +
  0.14 * agent_popularity +
  0.19 * user_preference +
  0.14 * mood_fit +
  0.1 * recency_freshness +
  0.19 * language_similarity
```

**Language Similarity Scoring Levels:**
- Exact match: 1.0
- Dialect match (en-US vs en-GB): 0.7
- Bilingual/related languages: 0.4
- Mismatch: 0.1
- Not allowed: 0.0

Where:
- `topic_similarity`: Match between conversation topics and agent tags
- `agent_popularity`: Based on interaction count, rating
- `user_preference`: Based on user's interaction history with agent
- `mood_fit`: Match between conversation sentiment and agent personality
- `recency_freshness`: How recently agent was active/updated
- `language_similarity`: Soft scoring based on language compatibility (NEW)

**Industry Alignment**: Instagram, YouTube use soft scoring for multilingual recommendations

### 2. AgentMatcher

**Responsibilities:**
- Match agents to chat context
- Use AI providers for embeddings/similarity (optional)
- Filter agents (already in room, inactive, language mismatch, etc.)
- Score agent relevance
- Generate match reasons for transparency

**Key Methods:**
```typescript
class AgentMatcher {
  async findRelevantAgents(context: ChatContext): Promise<AgentMatch[]>
  private async getCandidateAgents(context: ChatContext): Promise<Agent[]>
  private async scoreWithAI(context: ChatContext, agents: Agent[]): Promise<AgentMatch[]>
  private async scoreWithRules(context: ChatContext, agents: Agent[]): Promise<AgentMatch[]>
  private async filterAgents(agents: Agent[], context: ChatContext): Promise<Agent[]>
  private async generateMatchReasons(agent: Agent, context: ChatContext): Promise<string[]>
}
```

**Matching Strategies:**
1. **Rule-Based**: Topic matching, domain matching, tag matching
2. **AI-Enhanced**: Embeddings similarity, semantic matching
3. **Hybrid**: Combine rule-based and AI scores

**Filtering Criteria:**
- Not already in room (`agentsInRoom`)
- Active and public agents only
- Language compatibility (if language specified in context)
- User subscription tier limits (future)
- Exclude recently invited agents (cooldown)

**Match Reasons (for UX transparency):**
- "Expert in [topic]"
- "Popular [domain] specialist"
- "Matches your interests"
- "Similar to agents you like"
- "High rating in [domain]"

### 3. AIProviderClient

**Responsibilities:**
- Interface with AI providers (AI Gateway, OpenAI, etc.)
- Generate embeddings for text
- Find similar items using embeddings
- Handle rate limiting and retries

**Key Methods:**
```typescript
class AIProviderClient {
  async getEmbeddings(text: string): Promise<number[]>
  async findSimilar(queryEmbedding: number[], candidates: Agent[]): Promise<AgentMatch[]>
  async analyzeContext(context: ChatContext): Promise<EnhancedContext>
}
```

**Configuration:**
- Provider: `ai-gateway` (default), `openai`, `custom`
- Model: Configurable per use case
- Rate limiting: Respect provider limits

### 4. FeatureStore

**Responsibilities:**
- Retrieve user features (interests, embeddings, preferences)
- Retrieve agent features (tags, skills, popularity)
- Cache features for performance
- Update features from events

**Key Methods:**
```typescript
class FeatureStore {
  async getUserFeatures(userId: string): Promise<UserFeatures>
  async getAgentFeatures(agentId: string): Promise<AgentFeatures>
  async getAgentFeaturesBatch(agentIds: string[]): Promise<Map<string, AgentFeatures>>
  async updateUserFeatures(userId: string, features: Partial<UserFeatures>): Promise<void>
}
```

**Feature Models:**
```typescript
interface UserFeatures {
  userId: string;
  interests: string[];
  embeddings?: number[];
  preferredAgents: string[];
  interactionHistory: {
    agentId: string;
    interactionCount: number;
    lastInteractionAt: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
  preferences: {
    domains: string[];
    topics: string[];
  };
}

interface AgentFeatures {
  agentId: string;
  name: string;
  tags: string[];
  skills: string[];
  specialization?: string;
  popularity: number;
  rating: number;
  embeddings?: number[];
  isActive: boolean;
  isPublic: boolean;
}
```

### 5. RecommendationCoordinator

**Responsibilities:**
- Coordinate recommendation generation
- Handle request-response correlation
- Manage timeouts and errors
- Publish recommendation events

**Key Methods:**
```typescript
class RecommendationCoordinator {
  async processChatRequest(context: ChatContext): Promise<void>
  private async generateRecommendations(context: ChatContext): Promise<Recommendation[]>
  private async publishRecommendations(requestId: string, recommendations: Recommendation[]): Promise<void>
  private async handleError(requestId: string, error: Error): Promise<void>
}
```

## Data Models

### RecommendationRequest (MongoDB)

```typescript
interface RecommendationRequest {
  requestId: string;              // Unique ID
  contextType: 'chat' | 'feed' | 'explore' | 'profile';
  userId: string;
  roomId?: string;               // For chat context
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  recommendations?: Recommendation[];
  error?: string;
}
```

### AgentFeature (MongoDB)

```typescript
interface AgentFeature {
  agentId: string;
  name: string;
  tags: string[];
  skills: string[];
  specialization?: string;
  profession?: string;
  popularity: number;             // Based on interactions
  rating: number;                 // Average rating
  embeddings?: number[];          // AI-generated embeddings
  isActive: boolean;
  isPublic: boolean;
  lastUpdatedAt: Date;
}
```

### UserFeature (MongoDB)

```typescript
interface UserFeature {
  userId: string;
  interests: string[];
  preferredAgents: string[];      // Agents user frequently interacts with
  interactionHistory: {
    agentId: string;
    interactionCount: number;
    lastInteractionAt: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
  embeddings?: number[];         // User preference embeddings
  preferences: {
    domains: string[];
    topics: string[];
  };
  lastUpdatedAt: Date;
}
```

## Event Listeners

### ChatRecommendationRequestedListener

**Responsibilities:**
- Consume `ChatRecommendationRequestedEvent` from Kafka
- Process chat recommendation requests
- Generate recommendations
- Publish `ChatRecommendationsReadyEvent`

**Key Logic:**
```typescript
class ChatRecommendationRequestedListener extends Listener<ChatRecommendationRequestedEvent> {
  async onMessage(data: ChatRecommendationRequestedEvent['data'], payload: EachMessagePayload) {
    // 1. Store request
    // 2. Get user features
    // 3. Get agent features
    // 4. Generate recommendations
    // 5. Publish response
  }
}
```

## Event Publishers

### ChatRecommendationsReadyPublisher

**Responsibilities:**
- Publish `ChatRecommendationsReadyEvent` to Kafka
- Include requestId for correlation
- Include ranked recommendations separated by type (agentRecommendations, utilityRecommendations)
- Include metadata (roomId, generatedAt, totalCount)

**Response Structure:**
```typescript
{
  requestId: string;
  agentRecommendations: Recommendation[];  // Agent recommendations only
  utilityRecommendations: Recommendation[]; // Utility recommendations only
  metadata: {
    roomId?: string;
    generatedAt: string;
    totalCount: number;
  };
  timestamp: string;
}
```

## Integration Points

### 1. AI-Chat-Host Service
- **Consumes**: `ChatRecommendationRequestedEvent` (published by ai-chat-host)
- **Publishes**: `ChatRecommendationsReadyEvent` (consumed by ai-chat-host)
- **Event-driven**: No direct API calls

### 2. AI Gateway (for AI Provider)
- **API Calls**: Optional, for embeddings and similarity
- **Endpoint**: `POST /api/embeddings`, `POST /api/similarity`
- **Fallback**: Rule-based matching if AI Gateway unavailable

### 3. Agent Manager Service
- **Events**: 
  - `agent.ingested` - Full profile/character data (published on creation)
  - `agent.created` - Agent provisioned (minimal data, creates placeholder)
  - `agent.updated` - Agent updated (no profile data, relies on `agent.ingested`)
- **Note**: `AgentCreatedEvent` and `AgentUpdatedEvent` don't include profile/character data.
  We keep `AgentIngestedListener` for full data on creation, and use `AgentCreatedListener`/`AgentUpdatedListener`
  for lifecycle tracking. Consider enhancing `AgentUpdatedEvent` to include profile data for updates.
- **No direct API calls**: Event-driven

### 4. User Service (Future)
- **Events**: Listen to user interaction events to update user features
- **No direct API calls**: Event-driven

## Configuration

### Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://mongo:27017/recommendation

# Kafka
KAFKA_BROKER_URL=kafka:9092
KAFKA_CLIENT_ID=recommendation

# AI Provider
AI_PROVIDER=ai-gateway              # or "openai", "custom"
AI_GATEWAY_URL=http://ai-gateway:3000
AI_MODEL=gpt-4o-mini                # For embeddings
AI_ENABLED=true                     # Enable/disable AI features

# Recommendation Configuration
MAX_RECOMMENDATIONS_PER_REQUEST=5
MIN_RECOMMENDATION_SCORE=0.3
AI_SCORE_WEIGHT=0.6                 # Weight for AI-based scores
RULE_SCORE_WEIGHT=0.4               # Weight for rule-based scores

# Feature Store
FEATURE_CACHE_TTL_SECONDS=3600      # 1 hour
```

## Scalability Considerations

### 1. Horizontal Scaling
- **Stateless Service**: All state in MongoDB
- **Kafka Consumer Groups**: Multiple instances share load
- **Async Processing**: AI provider calls don't block

### 2. Performance Optimizations
- **Feature Caching**: Cache user/agent features in Redis
- **Batch Processing**: Process multiple requests in parallel
- **AI Provider Batching**: Batch embedding requests when possible

### 3. Cost Optimization
- **AI Provider Throttling**: Rate limit AI provider calls
- **Caching**: Cache embeddings and similarity results
- **Selective AI**: Use AI only for high-value requests

## Error Handling & Resilience

### 1. AI Provider Failures
- **Fallback**: Use rule-based matching if AI fails
- **Retry**: Exponential backoff for transient failures
- **Graceful Degradation**: Continue without AI features

### 2. Feature Store Failures
- **Fallback**: Use default features if unavailable
- **Caching**: Use cached features if DB unavailable

### 3. Request Timeouts
- **Timeout**: 30 seconds max processing time
- **Response**: Send partial recommendations if timeout

## Design Considerations & Trade-offs

### Event-Driven vs REST API

**Current Design: Event-Driven** ✅
- **Pros:**
  - Consistent with system architecture (all services use Kafka)
  - Async processing (AI provider calls don't block)
  - Better scalability (Kafka handles load balancing)
  - Durable (events persist, can retry)
  - Decoupled (no direct service dependencies)
- **Cons:**
  - Slightly more complex (request-response correlation)
  - Requires request state management (Redis/MongoDB)
  - Not synchronous (but acceptable for recommendations)

**Alternative: REST API** (from rec_chat.md)
- **Pros:**
  - Simpler request-response pattern
  - Synchronous (immediate response)
  - Easier to debug (direct HTTP calls)
- **Cons:**
  - Inconsistent with system architecture
  - Blocks on AI provider calls
  - Direct service coupling
  - Harder to scale (connection pooling, rate limiting)

**Decision**: Keep event-driven architecture for consistency and scalability.

### Utility Recommendations

**Added from rec_chat.md** ✅
- Utility suggestions (summarize, sentiment overview) add value
- Can be rule-based initially (no AI needed)
- Enhances UX beyond just agent invitations
- Easy to extend with more utility types

### Scoring Formula

**Added from rec_chat.md** ✅
- Detailed scoring formula provides clarity
- Weighted factors allow fine-tuning
- Rule-based for v1 (no ML needed)
- Can evolve to ML-based later

### Language Support

**Added from rec_chat.md** ✅
- Language field enables language-aware matching
- Important for international users
- Can filter agents by language compatibility

### Request/Response Format

**Enhanced from rec_chat.md** ✅
- Added `lastMessages` array for richer context
- Added `participants` array with type information
- Added `reason` field for UX transparency
- Added `label` and `action` for utility recommendations

## Open Questions

1. **Utility Recommendation Priority**: Should utility recommendations be included in the same response or separate? (Current: Same response, scored together)
2. **Language Matching**: How strict should language matching be? Exact match or fuzzy? (Current: Exact match, can be relaxed)
3. **Subscription Tiers**: How should subscription tiers limit recommendations? (Future: TBD)
4. **Utility Action Execution**: Who executes utility actions (summarize, sentiment)? Recommendation Service or AI-Chat-Host? (Current: AI-Chat-Host, Recommendation Service only suggests)
5. **Caching Strategy**: Should recommendation results be cached? For how long? (Current: No caching, can add later)

## Future Enhancements

1. **Multi-Context Support**: Feed, explore, profile recommendations
2. **Ad Integration**: Blend ads with organic recommendations
3. **Learning from Feedback**: Improve recommendations based on user feedback
4. **Real-time Updates**: Update features in real-time from events
5. **A/B Testing**: Test different recommendation strategies
6. **Personalization**: Deep personalization based on user behavior
7. **ML-Based Scoring**: Replace rule-based scoring with ML models
8. **Utility Action Execution**: Recommendation Service could execute utility actions (summarize, etc.)

## Implementation Phases

### Phase 1: Chat Recommendations (Current)
- [ ] Service setup (Kafka, MongoDB)
- [ ] ChatRecommendationRequestedListener
- [ ] ChatRecommender service
- [ ] AgentMatcher service (rule-based)
- [ ] ChatRecommendationsReadyPublisher
- [ ] Basic feature store

### Phase 2: AI Integration
- [ ] AIProviderClient service
- [ ] Embeddings generation
- [ ] Similarity matching
- [ ] Hybrid scoring (AI + rules)

### Phase 3: Feature Store Enhancement
- [ ] User feature projections from events
- [ ] Agent feature projections from events
- [ ] Feature caching (Redis)
- [ ] Real-time feature updates

### Phase 4: Multi-Context Support
- [ ] Feed recommendations
- [ ] Explore recommendations
- [ ] Profile recommendations
- [ ] Context-specific logic

### Phase 5: Ad Integration
- [ ] Ad Service integration
- [ ] Ad blending logic
- [ ] Frequency capping
- [ ] Revenue optimization

