# AI Chat Host Service - Design Document

## Overview

The `ai-chat-host` service intelligently analyzes chat conversations and automatically invites relevant AI agents to join rooms based on conversation context, sentiment, and topic analysis. It maintains a sliding window of recent messages for each room and uses NLP/sentiment analysis to determine when and which agents should be invited.

**Architecture Philosophy**: AI-Chat-Host is a **client** of the Recommendation Service, not the place where recommendation logic lives. This separation allows:
- Recommendation Service to be reused by other services (feed, explore, profile, etc.)
- Easier integration of ads in the future
- Centralized recommendation logic that can evolve independently
- Better scalability and maintainability

## Core Responsibilities

1. **Message Window Management**: Maintain a sliding window of recent messages (e.g., 10 messages) per room
2. **Time-Based Triggers**: Analyze conversations after a time threshold (e.g., 30 seconds of activity)
3. **NLP/Sentiment Analysis**: Analyze message content to extract topics, sentiment, and context
4. **Context Building**: Build chat context summary and call Recommendation Service
5. **Agent Invitation**: Invite recommended agents via the agent-manager service
6. **UX Adaptation**: Transform generic recommendations into chat-specific actions (invite, banner, modal)

## Architecture

### Service Structure

```
ai-chat-host/
├── src/
│   ├── index.ts                 # Service bootstrap
│   ├── app.ts                  # Express app (if needed for health checks)
│   ├── kafka-client.ts         # Kafka producer/consumer setup
│   ├── models/
│   │   ├── message-window.ts   # Message window per room
│   │   ├── analysis-result.ts  # Analysis results cache
│   │   └── room-analysis.ts    # Room analysis state
│   ├── events/
│   │   ├── listeners/
│   │   │   └── message-created-listener.ts  # Listen to message.created
│   │   └── publishers/
│   │       └── room-agent-invited-publisher.ts  # Publish invitations
│   ├── services/
│   │   ├── message-window-manager.ts    # Sliding window logic
│   │   ├── analysis-trigger.ts          # Time/message threshold logic
│   │   ├── nlp-analyzer.ts             # NLP/sentiment analysis
│   │   ├── agent-matcher.ts            # Match agents to conversations
│   │   └── invitation-coordinator.ts   # Coordinate invitations
│   └── config/
│       └── constants.ts        # Configurable thresholds
```

## Data Models

### MessageWindow (In-Memory + Redis)

```typescript
interface MessageWindow {
  roomId: string;
  messages: Array<{
    id: string;
    content: string;
    senderId: string;
    senderType: 'human' | 'agent';
    createdAt: Date;
  }>;
  lastMessageAt: Date;
  lastAnalyzedAt: Date | null;
  analysisCount: number;
}
```

**Storage Strategy:**
- **In-Memory (Map)**: Fast access for active rooms
- **Redis**: Persist windows for durability and multi-instance support
- **TTL**: Auto-expire windows after inactivity (e.g., 1 hour)

### RoomAnalysisResult (MongoDB)

```typescript
interface RoomAnalysisResult {
  roomId: string;
  analyzedAt: Date;
  messageWindowSize: number;
  topics: string[];              // Extracted topics/keywords
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;               // -1 to 1
  };
  context: {
    intent: string;              // e.g., "question", "discussion", "support"
    domain: string;              // e.g., "technical", "social", "business"
  };
  matchedAgentIds: string[];     // Agents that were matched
  invitedAgentIds: string[];     // Agents that were actually invited
  invitationReason: string;      // Why agents were invited
}
```

### RoomAnalysisState (MongoDB)

```typescript
interface RoomAnalysisState {
  roomId: string;
  lastAnalysisAt: Date | null;
  lastInvitationAt: Date | null;
  totalAnalyses: number;
  totalInvitations: number;
  cooldownUntil: Date | null;    // Prevent spam invitations
  activeWindowSize: number;
}
```

### PendingRecommendationRequest (Redis + MongoDB)

**Purpose**: Track pending recommendation requests for request-response correlation

**Storage Strategy**:
- **Redis**: Fast lookup for active requests (primary)
- **MongoDB**: Persistent storage for monitoring/debugging (optional)

```typescript
interface PendingRecommendationRequest {
  requestId: string;              // Unique ID (UUID)
  roomId: string;
  userId: string;
  context: ChatContext;           // Full context sent to Recommendation Service
  requestedAt: Date;
  expiresAt: Date;                // TTL: 5 minutes
  status: 'pending' | 'completed' | 'timeout';
}
```

**Redis Key Pattern**: `pending_recommendation:${requestId}`
**TTL**: 5 minutes (300 seconds)

## Event Flow

### 1. Message Created Event

```
message.created (Kafka)
    ↓
MessageCreatedListener
    ↓
MessageWindowManager.addMessage()
    ↓
AnalysisTrigger.checkThresholds()
    ↓
[If threshold met] → Trigger Analysis
```

### 2. Analysis & Recommendation Flow (Event-Driven)

```
AnalysisTrigger.trigger()
    ↓
NLPAnalyzer.analyze(window)
    ↓
ChatContextBuilder.buildContext(analysis, window, roomId)
    ↓
ChatRecommendationRequestedEvent (Kafka) → recommendation-service
    ↓
[AI-Chat-Host waits for response]
    ↓
ChatRecommendationsReadyEvent (Kafka) ← recommendation-service
    ↓
RecommendationsReceivedListener.process(recommendations)
    ↓
RecommendationResponse: [
  { type: "agent", agentId: "...", score: 0.91 },
  { type: "summary_offer", score: 0.8 }
]
    ↓
InvitationCoordinator.inviteAgents(recommendations, roomId)
    ↓
RoomAgentInvitedEvent (Kafka) → agent-manager
```

**Event-Driven Architecture Benefits**:
- **Async Processing**: Recommendation Service can call AI providers without blocking
- **Decoupling**: No direct API dependencies between services
- **Scalability**: Recommendation Service can process requests in parallel
- **Resilience**: Events are durable, can retry on failure
- **Consistency**: Matches the rest of the system's event-driven pattern

**Note**: The Recommendation Service is a separate microservice that handles:
- Agent matching logic (may call AI providers for embeddings/similarity)
- User preference learning
- Multi-context support (chat, feed, explore, etc.)
- Future ad integration

## Core Services

### 1. MessageWindowManager

**Responsibilities:**
- Maintain sliding window per room (FIFO, max 10 messages)
- Store in Redis with TTL
- Update lastMessageAt timestamp
- Clean up old windows

**Key Methods:**
```typescript
class MessageWindowManager {
  async addMessage(roomId: string, message: Message): Promise<MessageWindow>
  async getWindow(roomId: string): Promise<MessageWindow | null>
  async clearWindow(roomId: string): Promise<void>
  private async persistToRedis(window: MessageWindow): Promise<void>
  private async loadFromRedis(roomId: string): Promise<MessageWindow | null>
}
```

### 2. AnalysisTrigger

**Responsibilities:**
- Check if analysis should be triggered
- Time threshold: e.g., 30 seconds since last message
- Message threshold: e.g., 5 new messages since last analysis
- Cooldown: Prevent too frequent analyses (e.g., min 2 minutes between)

**Key Methods:**
```typescript
class AnalysisTrigger {
  async shouldAnalyze(window: MessageWindow, state: RoomAnalysisState): Promise<boolean>
  async checkTimeThreshold(window: MessageWindow): Promise<boolean>
  async checkMessageThreshold(window: MessageWindow, state: RoomAnalysisState): Promise<boolean>
  async checkCooldown(state: RoomAnalysisState): Promise<boolean>
}
```

**Configuration:**
```typescript
const ANALYSIS_CONFIG = {
  WINDOW_SIZE: 10,                    // Max messages in window
  TIME_THRESHOLD_MS: 30000,           // 30 seconds
  MESSAGE_THRESHOLD: 5,               // 5 new messages
  MIN_COOLDOWN_MS: 120000,            // 2 minutes between analyses
  MAX_ANALYSES_PER_HOUR: 10,          // Rate limiting
};
```

### 3. NLPAnalyzer

**Responsibilities:**
- Extract topics/keywords from message window
- Analyze sentiment (positive/neutral/negative)
- Determine conversation intent and domain
- Use AI Gateway or external NLP service

**Key Methods:**
```typescript
class NLPAnalyzer {
  async analyze(window: MessageWindow): Promise<AnalysisResult>
  private async extractTopics(messages: Message[]): Promise<string[]>
  private async analyzeSentiment(messages: Message[]): Promise<SentimentResult>
  private async determineContext(messages: Message[]): Promise<ContextResult>
}
```

**AI Integration Options:**
1. **AI Gateway**: Use existing AI Gateway service for NLP
2. **External API**: OpenAI, Google Cloud NLP, AWS Comprehend
3. **Embedded Model**: Use lightweight NLP library (compromise on accuracy)

**Analysis Output:**
```typescript
interface AnalysisResult {
  topics: string[];                    // ["javascript", "react", "debugging"]
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number;                     // -1 to 1
    breakdown: { [messageId: string]: number };
  };
  context: {
    intent: string;                    // "question", "discussion", "support"
    domain: string;                    // "technical", "social", "business"
    keywords: string[];                 // Top keywords
  };
  confidence: number;                  // 0 to 1
}
```

### 4. ChatContextBuilder

**Responsibilities:**
- Build chat context summary from analysis and window
- Prepare context for Recommendation Service event
- Extract room metadata (participants, agents already in room)
- Publish `ChatRecommendationRequestedEvent` to Kafka

**Key Methods:**
```typescript
class ChatContextBuilder {
  async buildAndPublishContext(
    analysis: AnalysisResult,
    window: MessageWindow,
    roomId: string,
    userId: string
  ): Promise<void>
  
  private buildContext(
    analysis: AnalysisResult,
    window: MessageWindow,
    roomId: string,
    userId: string
  ): ChatContext
}
```

**ChatContext Interface:**
```typescript
interface ChatContext {
  requestId: string;              // Unique ID for request-response correlation
  userId: string;
  contextType: 'chat';
  roomId: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  domain: string;
  agentsInRoom: string[];
  participants: string[];
  messageCount: number;
  lastActivityAt: Date;
  timestamp: string;
}
```

**Event Publishing:**
- Publishes `ChatRecommendationRequestedEvent` to Kafka
- Stores request in pending state (Redis/MongoDB) for correlation
- Sets TTL for request state (e.g., 5 minutes) to handle timeouts

### 4b. RecommendationsReceivedListener

**Responsibilities:**
- Listen for `ChatRecommendationsReadyEvent` from Recommendation Service
- Correlate response with pending request (using requestId)
- Process recommendations and trigger invitations
- Handle timeouts and missing responses

**Key Methods:**
```typescript
class RecommendationsReceivedListener extends Listener<ChatRecommendationsReadyEvent> {
  async onMessage(data: ChatRecommendationsReadyEvent['data'], payload: EachMessagePayload): Promise<void>
  private async correlateRequest(requestId: string): Promise<PendingRequest | null>
  private async processRecommendations(recommendations: Recommendation[], context: ChatContext): Promise<void>
}
```

**Pending Request State:**
- Stored in Redis/MongoDB with requestId as key
- Contains: roomId, userId, context, timestamp
- TTL: 5 minutes (handles Recommendation Service timeouts)
- Used to correlate response with original request

**Event-Driven Architecture**:
- **No Direct API Calls**: All communication via Kafka events
- **Async Processing**: Recommendation Service can take time (AI provider calls)
- **Request-Response Correlation**: Uses requestId to match responses
- **Resilience**: Events are durable, can handle service restarts

### 5. InvitationCoordinator

**Responsibilities:**
- Transform recommendations into chat-specific actions
- Coordinate agent invitations from recommendations
- Check if agents are already in room
- Respect invitation limits (e.g., max 3 agents per room)
- Publish RoomAgentInvitedEvent
- Track invitation history
- Handle other recommendation types (summary offers, etc.)

**Key Methods:**
```typescript
class InvitationCoordinator {
  async processRecommendations(
    recommendations: Recommendation[],
    roomId: string,
    context: ChatContext
  ): Promise<void>
  private async inviteAgents(agentRecommendations: AgentRecommendation[], roomId: string): Promise<void>
  private async checkExistingParticipants(roomId: string): Promise<string[]>
  private async filterAlreadyInvited(agentIds: string[], roomId: string): Promise<string[]>
  private async publishInvitation(agentId: string, roomId: string, reason: string): Promise<void>
}
```

**Recommendation Types:**
- `agent`: Invite agent to room
- `summary_offer`: Offer conversation summary (future)
- `ad`: Display ad in chat UI (future - handled by frontend)

**Invitation Limits:**
- Max agents per room: 3-5 (configurable)
- Max invitations per analysis: 2
- Cooldown per agent: 1 hour (prevent spam)

## Event Publishers

### ChatRecommendationRequestedEvent

```typescript
interface ChatRecommendationRequestedEvent {
  requestId: string;                   // Unique ID for request-response correlation
  userId: string;
  contextType: 'chat';
  roomId: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;                      // "question", "discussion", "support"
  domain: string;                      // "technical", "social", "business"
  agentsInRoom: string[];              // Agents already in room
  participants: string[];              // All participant IDs
  messageCount: number;
  lastActivityAt: string;             // ISO timestamp
  timestamp: string;
}
```

**Published to:** `chat.recommendation.requested` topic (consumed by recommendation-service)

**Purpose**: Request recommendations from Recommendation Service based on chat context.

### RoomAgentInvitedEvent

```typescript
interface RoomAgentInvitedEvent {
  agentId: string;
  roomId: string;
  invitedBy: 'ai-chat-host';           // Service identifier
  timestamp: string;
}
```

**Published to:** `room.agent.invited` topic (consumed by agent-manager)

## Event Listeners

### ChatRecommendationsReadyEvent (Consumed)

```typescript
interface ChatRecommendationsReadyEvent {
  requestId: string;                   // Correlates with ChatRecommendationRequestedEvent
  recommendations: Recommendation[];
  timestamp: string;
}

interface Recommendation {
  type: 'agent' | 'summary_offer' | 'ad';  // Future: 'ad'
  agentId?: string;                        // For type: 'agent'
  score: number;                           // 0 to 1
  metadata?: {
    matchReasons?: string[];
    confidence?: number;
    [key: string]: any;
  };
}
```

**Consumed from:** `chat.recommendations.ready` topic (published by recommendation-service)

**Purpose**: Receive recommendations from Recommendation Service and process them.

## Configuration

### Environment Variables

```bash
# Window Configuration
MESSAGE_WINDOW_SIZE=10
TIME_THRESHOLD_MS=30000
MESSAGE_THRESHOLD=5

# Analysis Configuration
MIN_COOLDOWN_MS=120000
MAX_ANALYSES_PER_HOUR=10
MAX_AGENTS_PER_ROOM=3
MAX_INVITATIONS_PER_ANALYSIS=2

# NLP Configuration
NLP_PROVIDER=ai-gateway              # or "openai", "google", "aws"
NLP_MODEL=gpt-4o-mini                # Model to use
NLP_ENDPOINT=http://ai-gateway:3000  # If using AI Gateway

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
WINDOW_TTL_SECONDS=3600              # 1 hour

# Kafka Configuration
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=ai-chat-host
```

## Database Schema

### MongoDB Collections

**room_analysis_results**
```javascript
{
  _id: ObjectId,
  roomId: String (indexed),
  analyzedAt: Date (indexed),
  messageWindowSize: Number,
  topics: [String],
  sentiment: {
    overall: String,
    score: Number
  },
  context: {
    intent: String,
    domain: String
  },
  matchedAgentIds: [String],
  invitedAgentIds: [String],
  invitationReason: String
}
```

**room_analysis_states**
```javascript
{
  _id: ObjectId,
  roomId: String (indexed, unique),
  lastAnalysisAt: Date,
  lastInvitationAt: Date,
  totalAnalyses: Number,
  totalInvitations: Number,
  cooldownUntil: Date,
  activeWindowSize: Number
}
```

## Integration Points

### 1. Chat Service
- **Consumes**: `message.created` events
- **No direct API calls needed**

### 2. Recommendation Service (Event-Driven Integration)
- **Publishes**: `ChatRecommendationRequestedEvent` → `chat.recommendation.requested` topic
- **Consumes**: `ChatRecommendationsReadyEvent` ← `chat.recommendations.ready` topic
- **Event Flow**:
  1. AI-Chat-Host publishes `ChatRecommendationRequestedEvent` with requestId
  2. Recommendation Service consumes event, processes (may call AI providers)
  3. Recommendation Service publishes `ChatRecommendationsReadyEvent` with same requestId
  4. AI-Chat-Host correlates response using requestId and processes recommendations
- **Request Correlation**: Uses requestId stored in Redis/MongoDB with TTL
- **Timeout Handling**: Pending requests expire after 5 minutes
- **Note**: This is the primary integration point. Agent matching logic lives in Recommendation Service, not in AI-Chat-Host. All communication is event-driven, no direct API calls.

### 3. Agent Manager Service
- **Publishes**: `room.agent.invited` events
- **Consumes**: (Optional) `agent.created`, `agent.updated` for agent profile cache

### 4. Room Service (Event-Based)
- **Event-based**: Listen to `room.participant.added` events to track agents in room
- **No direct API calls needed** (event-driven architecture)

### 5. AI Gateway (for NLP - Optional)
- **Future**: Could be called via events if needed
- **Current**: Uses keyword-based fallback in NLPAnalyzer
- **Note**: NLP analysis is lightweight and done locally, no external calls needed

## Scalability Considerations

### 1. Horizontal Scaling
- **Stateless Service**: All state in Redis/MongoDB
- **Kafka Consumer Groups**: Multiple instances share load
- **Redis Pub/Sub**: Can use Redis Streams for better scaling

### 2. Performance Optimizations
- **In-Memory Cache**: Hot message windows in memory
- **Batch Processing**: Process multiple rooms in batches
- **Async Processing**: Non-blocking analysis calls
- **Rate Limiting**: Prevent API abuse

### 3. Cost Optimization
- **Analysis Throttling**: Cooldowns prevent excessive API calls
- **Caching**: Cache analysis results for similar conversations
- **Selective Analysis**: Only analyze rooms with human messages

## Error Handling & Resilience

### 1. NLP Service Failures
- **Fallback**: Use keyword-based matching if NLP fails
- **Retry**: Exponential backoff for transient failures
- **Graceful Degradation**: Continue without analysis if service down

### 2. Recommendation Service Failures
- **Timeout Handling**: Pending requests expire after 5 minutes
- **Missing Responses**: Log and continue (don't block chat functionality)
- **Event Retry**: Kafka handles retries for failed event processing
- **Fallback**: If Recommendation Service is down, skip recommendations (graceful degradation)
- **Logging**: Log all failures and timeouts for monitoring

### 3. Invitation Failures
- **Idempotency**: Track invitations to prevent duplicates
- **Retry Logic**: Retry failed invitations with backoff

## Monitoring & Observability

### Metrics to Track
- Messages processed per second
- Analysis trigger rate
- Agent match rate
- Invitation success rate
- NLP API latency
- Error rates by type

### Logging
- All analysis triggers
- Agent matches and scores
- Invitations sent
- Errors and failures

## Architecture Evolution: Recommendation Service & Ad Service

### Current Phase: AI-Chat-Host with Embedded Matching (Temporary)

**Current Implementation**:
- AI-Chat-Host contains `AgentMatcher` service
- Matching logic is embedded in AI-Chat-Host
- Works for initial implementation but not scalable

### Phase 1: Extract to Recommendation Service

**Recommendation Service (v1)**:
- **Purpose**: Central recommendation platform for all contexts
- **Contexts Supported**: `chat` (initially), then `feed`, `explore`, `profile`, etc.
- **Features**:
  - Agent suggestions for chat
  - Rule-based + LLM/embedding similarity
  - User preference learning
  - Feature store for user/agent/content features
- **API**: `POST /api/recommendations` with contextType
- **Data**: Uses features/projections, not raw chat logs

**AI-Chat-Host Changes**:
- Remove `AgentMatcher` service
- Add `RecommendationServiceClient` to call Recommendation Service
- Focus on chat context building and UX adaptation

### Phase 2: General Recommender

**Recommendation Service (v2)**:
- **Multi-Context**: Feed, explore, agent profiles, notifications
- **Feature Store**: User embeddings, interests, engagement patterns
- **Signals Aggregation**:
  - Feed interactions (likes, shares, dwell time)
  - Chat interactions (which agents user likes, topics)
  - Follows/friendships
  - Agent feedback (RLHF signals)
- **No Ads Yet**: Keep it simple, organic recommendations only

### Phase 3: Ad Service Integration

**Ad Service**:
- **Owns**: Campaigns, targeting, budgets, bidding/auction, creatives
- **API**: `POST /api/adslots/fill` with contextType, slotType, topics, device, locale
- **Returns**: Ad candidates with scores

**Recommendation Service (v3)**:
- **Blending**: Merges organic recommendations with ads
- **Slot Management**: Knows which slots can show ads (chat_banner, feed_card, etc.)
- **Hybrid Ranking**: Blends organic + ads with frequency capping
- **Returns**: Mixed list of organic items + ads

**AI-Chat-Host**:
- **No Changes**: Still calls Recommendation Service, receives blended results
- **UX Adaptation**: Handles ad recommendations in chat UI (banners, etc.)

### Key Principles

1. **AI-Chat-Host is a Client**: It doesn't own recommendation logic
2. **Separation of Concerns**: Chat context vs. recommendation logic
3. **Reusability**: Recommendation Service used by multiple surfaces
4. **Future-Proof**: Easy to add ads without changing AI-Chat-Host
5. **Feature-Based**: Recommendation Service uses features, not raw data

## Future Enhancements

1. **Recommendation Service Integration**: Move agent matching to Recommendation Service
2. **Multi-Context Support**: Support feed, explore, profile recommendations
3. **User Preference Learning**: Learn from user interactions across all contexts
4. **Ad Integration**: Seamless ad blending in recommendations
5. **Multi-Language Support**: Analyze conversations in multiple languages
6. **Contextual Memory**: Remember previous conversations in the same room
7. **A/B Testing**: Test different recommendation strategies
8. **Web Behavior Integration**: Use cookies, web tracking for better recommendations

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Service setup (Kafka, MongoDB, Redis)
- [ ] MessageWindowManager
- [ ] MessageCreatedListener
- [ ] Basic sliding window logic

### Phase 2: Analysis Trigger
- [ ] AnalysisTrigger service
- [ ] Time/message threshold logic
- [ ] Cooldown management

### Phase 3: NLP Integration
- [ ] NLPAnalyzer service
- [ ] AI Gateway integration
- [ ] Topic/sentiment extraction

### Phase 4: Recommendation Service Integration (Event-Driven)
- [ ] ChatContextBuilder service (publishes events)
- [ ] ChatRecommendationRequestedEvent publisher
- [ ] RecommendationsReceivedListener (consumes response events)
- [ ] Request correlation logic (requestId matching)
- [ ] Pending request state management (Redis/MongoDB)
- [ ] Timeout handling for missing responses
- [ ] Remove embedded AgentMatcher (move logic to Recommendation Service)

### Phase 5: Invitation System
- [ ] InvitationCoordinator
- [ ] RoomAgentInvitedEvent publishing
- [ ] Invitation tracking

### Phase 6: Polish & Optimization
- [ ] Caching layer
- [ ] Error handling
- [ ] Monitoring & logging
- [ ] Performance optimization

### Phase 7: Recommendation Service Migration (Future)
- [ ] Build Recommendation Service (separate microservice)
- [ ] Recommendation Service listens to `ChatRecommendationRequestedEvent`
- [ ] Recommendation Service processes requests (may call AI providers)
- [ ] Recommendation Service publishes `ChatRecommendationsReadyEvent`
- [ ] Move agent matching logic from AI-Chat-Host to Recommendation Service
- [ ] Update AI-Chat-Host to use event-driven communication
- [ ] Remove AgentMatcher from AI-Chat-Host
- [ ] Add support for other recommendation types (summary offers, etc.)
- [ ] Implement request correlation and timeout handling

### Phase 8: Ad Service Integration (Future)
- [ ] Build Ad Service (separate microservice)
- [ ] Integrate Ad Service with Recommendation Service
- [ ] Update Recommendation Service to blend ads with organic recommendations
- [ ] Update AI-Chat-Host UX to handle ad recommendations

## Event-Driven Architecture Benefits

### Why Event-Driven for Recommendation Service Integration

1. **Async Processing**
   - Recommendation Service can call AI providers (embeddings, similarity models) without blocking
   - AI-Chat-Host doesn't wait for slow AI provider responses
   - Better resource utilization and scalability

2. **Service Decoupling**
   - No direct API dependencies between services
   - Services can evolve independently
   - Easier to scale Recommendation Service separately

3. **Resilience & Durability**
   - Events are persisted in Kafka
   - Can retry on failures
   - Handles service restarts gracefully
   - No lost requests

4. **Consistency with System Architecture**
   - Matches the rest of the system's event-driven pattern
   - All inter-service communication via Kafka events
   - No mixed patterns (some API calls, some events)

5. **Request-Response Correlation**
   - Uses requestId to correlate requests and responses
   - Handles out-of-order responses
   - Timeout handling for missing responses

6. **Scalability**
   - Multiple Recommendation Service instances can process requests in parallel
   - Kafka consumer groups handle load balancing
   - No connection pooling or rate limiting concerns

### Event Flow Pattern

```
AI-Chat-Host                    Kafka                    Recommendation Service
     │                            │                                │
     │ 1. Publish                  │                                │
     ├───────────────────────────>│                                │
     │ ChatRecommendationRequested │                                │
     │                            │                                │
     │                            │ 2. Consume                     │
     │                            ├───────────────────────────────>│
     │                            │                                │
     │                            │ 3. Process (may call AI)      │
     │                            │                                │
     │                            │ 4. Publish                     │
     │                            │<───────────────────────────────┤
     │                            │ ChatRecommendationsReady      │
     │                            │                                │
     │ 5. Consume                 │                                │
     │<───────────────────────────┤                                │
     │                            │                                │
     │ 6. Process & Invite        │                                │
     │                            │                                │
```

## Architectural Improvements (Based on Industry Best Practices)

### Key Insights from Large-Scale Platforms (Instagram/Facebook/TikTok)

1. **Central Recommendation Platform**
   - Recommendation logic should NOT live in AI-Chat-Host
   - Separate Recommendation Service handles all recommendation logic
   - Used by multiple surfaces: chat, feed, explore, profile, etc.
   - Enables consistent recommendation quality across the platform

2. **AI-Chat-Host as a Client**
   - AI-Chat-Host focuses on chat-specific concerns:
     - Message window management
     - Chat context extraction
     - UX adaptation (invite buttons, banners, modals)
   - Calls Recommendation Service for actual recommendations
   - Transforms generic recommendations into chat-specific actions

3. **Feature-Based Architecture**
   - Recommendation Service uses **features**, not raw data
   - Features include:
     - User: interests, embeddings, engagement patterns, preferences
     - Agent: tags, skills, popularity, RLHF traits
     - Content: embeddings, topics, popularity, freshness
   - Raw data (messages, posts) stays in their respective services
   - Feature store (or indexed DB) provides fast access

4. **Ad Service as Specialized Recommender**
   - Ads are a specialized recommendation problem
   - Ad Service handles: campaigns, targeting, budgets, auctions, frequency capping
   - Recommendation Service blends ads with organic recommendations
   - AI-Chat-Host receives blended results, no ad-specific logic needed

5. **Multi-Context Support**
   - Same Recommendation Service API works for:
     - `contextType: "chat"` → agent suggestions
     - `contextType: "feed"` → posts, agents to follow
     - `contextType: "explore"` → trending content
     - `contextType: "profile"` → similar agents, related content
   - Context-specific logic in Recommendation Service, not in clients

6. **Scalability & Maintainability**
   - Recommendation improvements benefit all surfaces
   - Ad integration doesn't require changes to AI-Chat-Host
   - New recommendation types (summary offers, etc.) easy to add
   - A/B testing centralized in Recommendation Service

### Migration Path

**Current State (Temporary)**:
- AI-Chat-Host has embedded `AgentMatcher`
- Works for initial implementation
- Not scalable for multi-context recommendations

**Target State**:
- AI-Chat-Host publishes `ChatRecommendationRequestedEvent` to Kafka
- Recommendation Service consumes event, processes (may call AI providers)
- Recommendation Service publishes `ChatRecommendationsReadyEvent` to Kafka
- AI-Chat-Host consumes response event and processes recommendations
- All communication is event-driven (no direct API calls)
- Recommendation Service handles all matching logic
- Ad Service integrates with Recommendation Service
- All surfaces (chat, feed, explore) use same recommendation platform

**Migration Steps**:
1. Build Recommendation Service v1 (chat context only)
2. Move agent matching logic from AI-Chat-Host to Recommendation Service
3. Update AI-Chat-Host to call Recommendation Service
4. Expand Recommendation Service to support other contexts
5. Add Ad Service and integrate with Recommendation Service

