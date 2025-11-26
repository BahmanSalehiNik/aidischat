# Agent Feedback & RLHF Learning System — Design

## Goals

1. **Collect Feedback**: Enable users to provide explicit and implicit feedback on agent interactions across multiple channels (chat, posts, comments).
2. **Convert to Metrics**: Transform raw feedback into quantifiable learning signals (scores, preferences, behavior patterns).
3. **Update Agent Behavior**: Use feedback to improve agent responses through:
   - **Online Learning**: Real-time prompt adjustments and context injection
   - **Offline Learning**: Batch fine-tuning with LoRA and periodic model updates
4. **Maintain Context**: Track learning progress, feedback history, and agent evolution over time.
5. **Avoid Competition**: Design feedback system to be cooperative, not competitive (no public rankings, no status games).

## Learning Phases Roadmap

The system will progress through learning phases in parallel with agent interaction phases:

- **Phase A**: Explicit Feedback Integration (thumbs up/down, ratings)
- **Phase B**: Implicit Conversation Signals (reply speed, engagement, sentiment)
- **Phase C**: Personality Weight Adjustment (humor, empathy, assertiveness tuning)
- **Phase D**: Memory & Preference Formation (user preferences, recurring topics)
- **Phase E**: Controlled Exploration (ε-greedy, randomized variants)
- **Phase F**: Reward-Based Behavior Shaping (reinforce successful patterns)
- **Phase G**: Personality Refinement (consistent voice, emotional patterns)
- **Phase H**: Social Graph Learning (which users/rooms succeed)
- **Phase I**: Self-Play & Peer Learning (agents learn from each other)
- **Phase J**: Content-Level Learning (post/comment engagement)
- **Phase K**: Population-Level Evolution (traits propagate, archetypes emerge)
- **Phase L**: Fine-Tuning / LoRA (model-level training)

**Current Focus**: Phase 1 implementation (Phases A-B) with foundation for future phases.

## High-Level Architecture

```
┌─────────────────┐
│  Feedback       │  Collects feedback from multiple sources
│  Service        │  (chat reactions, post likes, explicit ratings)
└────────┬────────┘
         │ Publishes FeedbackCreatedEvent
         ↓
┌─────────────────┐
│  RL/Learning    │  Aggregates feedback, computes metrics,
│  Service        │  updates agent learning state
└────────┬────────┘
         │ Publishes AgentLearningUpdatedEvent
         ↓
┌─────────────────┐
│  AI Gateway     │  Uses learning metrics for:
│  (Prompt Eng)   │  - Prompt adjustments
│                 │  - Context injection
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Fine-tune      │  Batch processing:
│  Service        │  - LoRA training
│  (Offline)      │  - Periodic model updates
└─────────────────┘
```

## Service Responsibilities

### 1. Feedback Service

**Purpose**: Collect, validate, store, and publish feedback events.

**Key Functions**:
- REST API endpoints for receiving feedback
- Validation and deduplication
- Storage in MongoDB
- Publishing `FeedbackCreatedEvent` to Kafka
- Support for multiple feedback types (explicit, implicit, reactions)

**Data Sources**:
- **Primary**: Owner feedback after chat sessions (thumbs up/down, ratings)
- **Secondary**: Owner micro-feedback (inline 👍/👎 on messages, private only)
- **Tertiary**: Implicit signals from all users:
  - Reply speed and engagement
  - Message length and conversation duration
  - Room retention (staying after agent messages)
  - Re-invitations
  - Reactions (👍, ❤️, 😂, 😮, 😢, 👎)
  - Topic changes and abandonment
- **Optional**: Incentivized reviewer feedback (private, constructive, earns reputation points)

**Rate Limiting Strategy**:
- **Explicit Session Feedback**: Show only when session >3 min, agent spoke >5 messages, AND last feedback >24h
- **Inline Thumbs**: Show on every 5th agent message, or when sentiment uncertain
- **Periodic Check-ins**: Ask "How is [Agent] doing?" only if no feedback in 7 days and relationship strength > threshold
- **Per-Agent Settings**: Users can control feedback intensity per agent (High/Moderate/Low/Off)

**Anti-Competition Design**:
- ✅ Feedback is private (not visible to other users)
- ✅ No public agent rankings or leaderboards
- ✅ No comparison between agents
- ✅ Cooperative framing ("help improve the ecosystem")
- ❌ Avoid status games, envy, sabotage behaviors

### 2. RL/Learning Service

**Purpose**: Process feedback, compute learning metrics, update agent state.

**Key Functions**:
- Consume `FeedbackCreatedEvent` from Kafka
- Aggregate feedback per agent (time windows, decay functions)
- Compute rewards from feedback signals
- Maintain local projections (Agent Summary, Feedback Aggregation, Relationship Strength, Behavior History)
- Compute learning metrics (sentiment scores, preference weights, behavior patterns)
- Generate policy updates (trait adjustments, action policy changes)
- Emit `AgentLearningUpdatedEvent` (NOT direct DB writes - agent-service applies updates)
- Track learning history and trends

**Internal Components**:
1. **Event Ingestor**: Kafka consumers for feedback, session, and message events
2. **Reward Calculator**: Converts feedback into numeric rewards (-1 to +1)
3. **Aggregator/Projections**: Maintains summarized state per agent
4. **Policy Updater**: Computes trait and action policy deltas
5. **Safety & Constraints**: Enforces min/max bounds, platform rules
6. **Update Emitter**: Publishes policy update events (does NOT modify agent DB directly)

**Learning Metrics**:
- **Sentiment Score**: Weighted average of positive/negative feedback (-1 to +1)
- **Engagement Score**: Based on interaction frequency and duration
- **Preference Weights**: Learned preferences for topics, communication styles, response lengths
- **Behavior Patterns**: Frequently used phrases, topics, interaction styles
- **Quality Score**: Composite metric combining all signals

### 3. AI Gateway Integration

**Purpose**: Apply learning metrics to improve agent responses in real-time.

**BehaviorCompiler Module**:
A dedicated module that maps policy JSON → runtime behavior:
- **Input**: Agent base config + RL policy JSON (traits, action policy, exploration)
- **Output**: BehaviorProfile (system prompt, LLM params, model selection, behavior flags)
- **Approach**: Hybrid (rule-based runtime + LLM-assisted periodic mapping generation)
  - **Runtime**: Fast, deterministic rule-based mapping (trait → prompt text, policy → LLM params)
  - **Periodic**: LLM generates optimized mapping rules (weekly), stored in DB
  - **Why**: Deterministic runtime + evolving mappings without per-request LLM costs

**Integration Points**:
- **Prompt Engineering**: Uses BehaviorCompiler to build system prompts from policy
- **LLM Parameters**: Maps policy values to temperature, max_tokens, penalties
- **Model Routing**: Selects base model vs. fine-tuned model based on policy
- **Action Decisions**: Determines whether agent should reply (based on action policy)
- **Context Injection**: Adds learned preferences to message context

### 4. Fine-tune Service (Offline)

**Purpose**: Batch processing for model updates.

**Functions**:
- Consume aggregated feedback data
- Generate training datasets from feedback
- Run LoRA fine-tuning jobs periodically
- Update agent models with new weights
- Publish model update events

## Data Flow

### Feedback Collection Flow

```
User Action (Chat/Post/Comment)
    ↓
Client → Feedback Service API
    ↓
Feedback Service:
  - Validates feedback
  - Stores in Feedback collection
  - Publishes FeedbackCreatedEvent
    ↓
Kafka Topic: feedback.created
```

### Learning Processing Flow

```
FeedbackCreatedEvent (Kafka)
    ↓
RL/Learning Service:
  - Consumes event
  - Aggregates with existing feedback
  - Computes learning metrics
  - Updates AgentLearningState in agents DB
  - Publishes AgentLearningUpdatedEvent
    ↓
Kafka Topic: agent.learning.updated
    ↓
AI Gateway (Prompt Engineering):
  - Consumes event
  - Updates prompt templates
  - Adjusts context injection
```

### Online Learning Flow

```
Agent generates response
    ↓
AI Gateway:
  - Retrieves current learning metrics
  - Adjusts prompt/context based on metrics
  - Generates response with learned preferences
    ↓
Response sent to user
```

### Offline Learning Flow

```
Periodic Job (e.g., daily)
    ↓
RL/Learning Service:
  - Aggregates all feedback for time window
  - Generates training dataset
  - Publishes TrainingDatasetReadyEvent
    ↓
Fine-tune Service:
  - Consumes training dataset
  - Runs LoRA fine-tuning
  - Updates agent model
  - Publishes ModelUpdatedEvent
```

## Event Structure

### FeedbackCreatedEvent

```typescript
interface FeedbackCreatedEvent {
  subject: Subjects.FeedbackCreated;
  data: {
    id: string;
    feedbackType: 'explicit' | 'implicit' | 'reaction';
    source: 'chat' | 'post' | 'comment' | 'profile';
    sourceId: string; // messageId, postId, commentId, etc.
    agentId: string;
    userId: string; // User providing feedback
    roomId?: string; // For chat feedback
    value: number; // -1 to +1 for reactions, 1-5 for ratings
    metadata?: {
      reactionType?: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'dislike';
      rating?: number; // 1-5 stars
      text?: string; // Optional text feedback
      context?: {
        messageContent?: string;
        agentResponse?: string;
        conversationLength?: number;
      };
    };
    createdAt: string;
  };
}
```

### AgentLearningUpdatedEvent

```typescript
interface AgentLearningUpdatedEvent {
  subject: Subjects.AgentLearningUpdated;
  data: {
    agentId: string;
    ownerUserId: string;
    learningMetrics: {
      sentimentScore: number; // -1 to +1
      engagementScore: number; // 0 to 1
      qualityScore: number; // 0 to 1
      preferenceWeights: {
        topics: Record<string, number>; // Topic -> weight
        communicationStyle: Record<string, number>;
        responseLength: 'short' | 'medium' | 'long'; // Learned preference
      };
      behaviorPatterns: {
        commonPhrases: string[];
        preferredTopics: string[];
        interactionStyle: string;
      };
    };
    feedbackStats: {
      totalFeedback: number;
      positiveCount: number;
      negativeCount: number;
      lastUpdated: string;
    };
    version: number; // Incremented on each update
    updatedAt: string;
  };
}
```

### TrainingDatasetReadyEvent

```typescript
interface TrainingDatasetReadyEvent {
  subject: Subjects.TrainingDatasetReady;
  data: {
    agentId: string;
    datasetId: string;
    datasetUrl: string; // S3 or storage location
    timeWindow: {
      start: string;
      end: string;
    };
    sampleCount: number;
    metadata: {
      feedbackCount: number;
      averageSentiment: number;
    };
    createdAt: string;
  };
}
```

## Required Projections (RL Service)

The RL service maintains local projections for fast reward computation and policy updates:

### 1. Agent Summary Projection
```typescript
{
  agentId: string;
  ownerId: string;
  personality_traits: Record<string, number>;
  tone_weights: Record<string, number>;
  autonomy_level: number;
  current_mood?: string;
}
```
**Source Events**: `agent.created`, `agent.updated`, `agent.personality.updated`

### 2. Feedback Aggregation Projection
```typescript
{
  agentId: string;
  positive_count: number;
  negative_count: number;
  avg_score: number; // -1 to +1
  last_feedback_at: Date;
  engagement_score: number; // 0 to 1
  conversation_success_rate: number; // 0 to 1
  topic_preferences?: Record<string, number>;
}
```
**Source Events**: `feedback.created`, `session.ended`

### 3. Relationship Strength Projection
```typescript
{
  agentId: string;
  userId: string;
  interaction_count: number;
  session_duration_avg: number;
  invitations_count: number;
  returns_count: number;
  relationship_strength: number; // 0 to 1
  last_seen_at: Date;
}
```
**Source Events**: `room.joined`, `room.left`, `session.ended`

### 4. Behavior History Projection
```typescript
{
  agentId: string;
  last_n_actions: Array<{
    actionType: string;
    reward: number;
    timestamp: Date;
  }>;
  action_type_distribution: Record<string, number>;
  success_rate_per_action: Record<string, number>;
}
```
**Source Events**: `ai.message.reply`, `feedback.created`

## Data Models

### Feedback Model (Feedback Service)

```typescript
interface Feedback {
  id: string;
  feedbackType: 'explicit' | 'implicit' | 'reaction';
  source: 'chat' | 'post' | 'comment' | 'profile';
  sourceId: string;
  agentId: string;
  userId: string;
  roomId?: string;
  value: number; // -1 to +1
  metadata: {
    reactionType?: string;
    rating?: number;
    text?: string;
    context?: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Indexes:
// - { agentId, createdAt } for agent feedback queries
// - { userId, agentId } for user-specific feedback
// - { source, sourceId } for deduplication
```

### Agent Policy Model (Agents Service)

The RL service emits policy updates, which are stored in the agent profile:

```typescript
interface AgentBehaviorPolicy {
  version: number;
  traits: {
    humor: number; // 0 to 1
    empathy: number;
    sarcasm: number;
    directness: number;
    formality: number;
    curiosity: number;
    // ... other traits
  };
  actionPolicy: {
    replyFrequency: {
      dmWithOwner: number;
      dmWithOthers: number;
      groupSmall: number;
      groupLarge: number;
    };
    postProbability: number;
    inviteProbability: number;
    maxAutonomousActionsPerDay: number;
  };
  exploration: {
    epsilon: number; // 0 to 1, controls randomness
  };
  lastUpdatedBy: string; // "rl-service"
  lastUpdatedAt: Date;
}
```

### AgentLearningState Model (Agents Service)

```typescript
interface AgentLearningState {
  agentId: string;
  ownerUserId: string;
  learningMetrics: {
    sentimentScore: number;
    engagementScore: number;
    qualityScore: number;
    preferenceWeights: {
      topics: Record<string, number>;
      communicationStyle: Record<string, number>;
      responseLength: string;
    };
    behaviorPatterns: {
      commonPhrases: string[];
      preferredTopics: string[];
      interactionStyle: string;
    };
  };
  feedbackStats: {
    totalFeedback: number;
    positiveCount: number;
    negativeCount: number;
    lastUpdated: Date;
  };
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes:
// - { agentId } unique
// - { ownerUserId } for user's agents
```

## Feedback Aggregation Strategy

### Time Windows

- **Recent Feedback** (last 24 hours): Full weight (1.0)
- **Short-term** (last 7 days): Weight 0.7
- **Medium-term** (last 30 days): Weight 0.5
- **Long-term** (last 90 days): Weight 0.3
- **Historical** (older): Weight 0.1

### Decay Function

```typescript
function calculateWeight(feedbackAge: number): number {
  const days = feedbackAge / (1000 * 60 * 60 * 24);
  if (days <= 1) return 1.0;
  if (days <= 7) return 0.7;
  if (days <= 30) return 0.5;
  if (days <= 90) return 0.3;
  return 0.1;
}
```

### Sentiment Score Calculation

```typescript
function calculateSentimentScore(feedbacks: Feedback[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const feedback of feedbacks) {
    const weight = calculateWeight(Date.now() - feedback.createdAt.getTime());
    weightedSum += feedback.value * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
```

## AI Gateway Integration

### BehaviorCompiler Implementation

The BehaviorCompiler module transforms policy JSON into runtime behavior:

```typescript
interface BehaviorProfile {
  systemPrompt: string;
  llmParams: {
    temperature: number;
    max_tokens: number;
    top_p?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
  };
  modelSelection: {
    provider: string;
    modelId: string; // base model or fine-tuned model
  };
  behaviorFlags: {
    shouldReply: boolean;
    replyStyle: string;
    brevityLevel: 'short' | 'medium' | 'long';
  };
}

function compileBehavior(
  agentConfig: AgentConfig,
  policyJson: AgentBehaviorPolicy,
  context: MessageContext
): BehaviorProfile {
  // 1. Build system prompt from traits
  const systemPrompt = buildSystemPromptFromTraits(agentConfig, policyJson.traits);
  
  // 2. Map policy to LLM params
  const llmParams = mapPolicyToParams(policyJson);
  
  // 3. Select model (base vs fine-tuned)
  const modelSelection = selectModel(agentConfig, policyJson);
  
  // 4. Decide behavior flags
  const behaviorFlags = computeBehaviorFlags(policyJson, context);
  
  return { systemPrompt, llmParams, modelSelection, behaviorFlags };
}
```

**Trait → Prompt Mapping** (Rule-based, stored in DB):
- `humor: 0.7` → "Use light playful phrasing and friendly jokes"
- `empathy: 0.9` → "Be very empathetic, supportive, and kind"
- `sarcasm: 0.1` → "Avoid sarcasm entirely"
- `formality: 0.3` → "Use casual, conversational tone"
- `brevity: 0.8` → "Prefer concise answers, 1-3 short paragraphs max"

**Policy → LLM Params Mapping**:
- `exploration.epsilon` → `temperature = 0.2 + epsilon * 1.2`
- `brevity` → `max_tokens = 150 + (1 - brevity) * 200`
- `formality` → `presence_penalty` adjustments

**Periodic LLM-Assisted Mapping Generation**:
- Weekly job calls admin-tier LLM (GPT-4, Claude 3.5) to generate optimized mapping rules
- Stores new rules in `mapping_rules` collection
- Runtime uses latest rules until next refresh
- Allows evolution without per-request LLM costs

### Prompt Engineering Updates

```typescript
// In prompt-builder.ts
static buildSystemPromptWithLearning(
  basePrompt: string,
  character: CharacterAttributes,
  learningMetrics: LearningMetrics,
  options: PromptBuilderOptions
): string {
  // Base prompt with character attributes
  let prompt = this.buildSystemPrompt(basePrompt, character, options);
  
  // Add learned preferences
  if (learningMetrics.preferenceWeights.topics) {
    const topTopics = Object.entries(learningMetrics.preferenceWeights.topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);
    
    if (topTopics.length > 0) {
      prompt += `\n\nYou tend to engage well with topics like: ${topTopics.join(', ')}.`;
    }
  }
  
  // Add communication style preference
  if (learningMetrics.preferenceWeights.communicationStyle) {
    const preferredStyle = Object.entries(learningMetrics.preferenceWeights.communicationStyle)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    if (preferredStyle) {
      prompt += `\n\nUsers prefer when you communicate in a ${preferredStyle} style.`;
    }
  }
  
  // Add response length preference
  if (learningMetrics.preferenceWeights.responseLength) {
    prompt += `\n\nUsers prefer ${learningMetrics.preferenceWeights.responseLength} responses.`;
  }
  
  return prompt;
}
```

### Context Injection

```typescript
// In ai-message-created-listener.ts
private async injectLearningContext(
  messageContent: string,
  agentId: string
): Promise<string> {
  // Fetch current learning metrics
  const learningState = await this.getAgentLearningState(agentId);
  
  if (!learningState || learningState.learningMetrics.sentimentScore < 0.3) {
    // Low sentiment - add improvement hint
    return `[Context: Recent feedback suggests users want more engaging responses. Be more conversational and thoughtful.]\n\n${messageContent}`;
  }
  
  // High sentiment - reinforce positive behavior
  if (learningState.learningMetrics.sentimentScore > 0.7) {
    return `[Context: Users appreciate your current communication style. Continue being ${learningState.learningMetrics.behaviorPatterns.interactionStyle}.]\n\n${messageContent}`;
  }
  
  return messageContent;
}
```

## Persona Enrichment (Optional)

During agent creation, users can opt-in to automatic persona enrichment:

**Flow**:
1. User creates agent with basic info (name, age, profession, etc.)
2. UI asks: "Would you like us to enrich your agent's persona automatically?"
3. If yes, Sample Text Generator (LLM-based) module:
   - Fills missing traits
   - Builds backstory
   - Composes personality description
   - Generates 5-20 training examples
   - Writes tone guidelines
   - Creates sample conversations
4. User can review and edit before accepting
5. Saved in `agent.archetypeTemplate`

**Platform-Native Agents**:
- Featured agents owned by platform (not users)
- Can be purchased/sold in future marketplace
- More elaborate templates, possibly admin fine-tuned models
- Growth levers and retention drivers

## Implementation Phases

### Phase 1: Feedback Service (Foundation)

1. **Service Setup**
   - Create `backEnd/feedback/` service
   - Set up MongoDB connection
   - Configure Kafka producer

2. **API Endpoints**
   - `POST /api/feedback` - Submit feedback
   - `GET /api/feedback/agent/:agentId` - Get feedback for agent
   - `GET /api/feedback/user/:userId` - Get user's feedback history

3. **Event Publishing**
   - Implement `FeedbackCreatedPublisher`
   - Add to shared events

4. **Data Model**
   - Create `Feedback` model
   - Set up indexes

### Phase 2: RL/Learning Service (Core Processing)

1. **Service Setup**
   - Create `backEnd/agent-learning/` service (or `rl-service`)
   - Set up MongoDB connection
   - Configure Kafka consumer and producer

2. **Event Listeners**
   - `FeedbackCreatedListener` - Consume feedback events
   - `SessionEndedListener` - Track session metrics
   - `AiMessageReplyListener` - Track agent actions
   - Build projections from events

3. **Projections**
   - Agent Summary Projection
   - Feedback Aggregation Projection
   - Relationship Strength Projection (Phase 2+)
   - Behavior History Projection (Phase 2+)

4. **Learning Engine**
   - **Reward Calculator**: Convert feedback to numeric rewards
   - **Aggregator**: Maintain rolling stats per agent
   - **Policy Updater**: Compute trait and action policy deltas
   - **Safety & Constraints**: Enforce min/max bounds, platform rules

5. **Policy Updates**
   - Emit `AgentLearningUpdatedEvent` (NOT direct DB writes)
   - Agent Service applies updates to `behaviorPolicy` field
   - Maintains loose coupling and auditability

6. **API Endpoints** (Optional, for monitoring)
   - `GET /api/learning/agent/:agentId` - Get learning metrics
   - `GET /api/learning/stats` - System-wide stats

### Phase 3: AI Gateway Integration (Online Learning)

1. **Event Consumption**
   - Add `AgentLearningUpdatedListener` in AI Gateway
   - Store policy JSON in local cache/DB

2. **BehaviorCompiler Module**
   - Create `BehaviorCompiler` class/module
   - Implement rule-based trait → prompt mapping
   - Implement policy → LLM params mapping
   - Implement model selection logic
   - Implement action decision logic (should agent reply?)

3. **Integration with Prompt Engineering**
   - Modify `PromptBuilder` to use BehaviorCompiler
   - Build system prompts from policy traits
   - Add learning-aware context injection

4. **Mapping Rules Storage**
   - Create `mapping_rules` collection in AI Gateway DB
   - Store trait → prompt templates
   - Store policy → params formulas
   - Allow admin updates (Phase 3+)

5. **Periodic LLM-Assisted Mapping** (Phase 3+)
   - Weekly job to generate optimized mapping rules
   - Use admin-tier LLM (GPT-4, Claude 3.5)
   - Store new rules, version control
   - Fallback to previous rules if generation fails

### Phase 4: Fine-tune Service Integration (Offline Learning)

1. **Training Dataset Generation**
   - Periodic job in RL/Learning Service
   - Aggregate feedback into training format
   - Publish `TrainingDatasetReadyEvent`

2. **Fine-tune Service**
   - Consume training datasets
   - Run LoRA fine-tuning jobs
   - Update agent models
   - Publish `ModelUpdatedEvent`

## Alternative Architecture Considerations

### Option A: Unified Learning Service

Instead of separate Feedback and RL services, combine into one `agent-learning` service:
- **Pros**: Simpler deployment, fewer services, lower latency
- **Cons**: Less separation of concerns, harder to scale independently

### Option B: Event Sourcing for Learning State

Store all feedback events and compute state on-demand:
- **Pros**: Complete audit trail, can recompute metrics with different algorithms
- **Cons**: Higher storage costs, more complex queries

### Option C: Real-time Learning Updates

Update learning metrics immediately on each feedback:
- **Pros**: Faster adaptation, real-time improvements
- **Cons**: Higher compute costs, potential race conditions

**Recommendation**: Start with Option A (unified service) for simplicity, migrate to separate services if scaling requires it.

## Reward Calculation

The RL service computes rewards from feedback signals:

```typescript
function calculateReward(feedback: FeedbackEvent): number {
  let reward = 0;
  
  // Explicit feedback (owner)
  if (feedback.source === 'owner') {
    if (feedback.value > 0) reward += 0.8; // thumbs up
    if (feedback.value < 0) reward -= 1.0; // thumbs down
  }
  
  // Implicit signals
  if (feedback.engagementDelta > 0.5) reward += 0.3; // high engagement
  if (feedback.sessionLength > 300) reward += 0.2; // long session
  if (feedback.userLeftImmediately) reward -= 0.4; // abandonment
  
  // Safety modifier
  if (feedback.containsAbuse) reward -= 2.0; // heavy penalty
  
  return Math.max(-1, Math.min(1, reward)); // clamp to -1..+1
}
```

Rewards are aggregated per agent with time decay (recent feedback weighted more heavily).

## Open Questions & Considerations

### 1. Feedback Deduplication
- How to handle duplicate feedback (same user, same message)?
- Should we allow feedback updates (change reaction)?
- **Proposal**: Use `{ userId, sourceId, agentId }` as unique constraint, allow updates within 5 minutes.

### 2. Feedback Weighting
- Should feedback from agent owners be weighted differently?
- How to handle spam/abuse?
- **Proposal**: Owner feedback weight = 0.5, implement rate limiting and abuse detection.

### 3. Privacy & Data Retention
- How long to retain feedback data?
- Should users be able to delete their feedback?
- **Proposal**: Retain for 1 year, allow deletion (but anonymize for learning).

### 4. Learning Metrics Storage
- Store in agents service DB or separate learning DB?
- **Proposal**: Store in agents service for fast access, sync to learning service for analytics.

### 5. Fine-tuning Frequency
- How often to run fine-tuning jobs?
- **Proposal**: Weekly for active agents (>100 feedbacks), monthly for others.

### 6. A/B Testing
- How to test learning improvements?
- **Proposal**: Support feature flags for learning-enabled vs. baseline agents.

### 7. Negative Feedback Handling
- How to handle consistently negative feedback?
- **Proposal**: Alert agent owner, pause learning updates if sentiment < -0.5 for 7 days.

### 8. Multi-Channel Feedback Aggregation
- How to weight feedback from different sources (chat vs. post)?
- **Proposal**: Chat feedback weight = 1.0, post = 0.8, comment = 0.6.

## Monitoring & Observability

### Metrics to Track
- Feedback submission rate
- Learning metric update frequency
- Agent sentiment score distribution
- Fine-tuning job success rate
- Response quality improvement (before/after learning)

### Alerts
- Learning service processing lag
- Agent sentiment score drops below threshold
- Fine-tuning job failures
- Feedback service API errors

## Security Considerations

1. **Rate Limiting**: Prevent feedback spam
2. **Authentication**: Verify user identity for feedback submission
3. **Authorization**: Users can only provide feedback on agents they've interacted with
4. **Data Encryption**: Encrypt sensitive feedback data at rest
5. **Audit Logging**: Log all feedback and learning updates

## Policy Update Flow (Detailed)

### How RL Service Updates Agent Behavior

1. **Event Ingestion**
   - RL service consumes `FeedbackCreatedEvent`, `SessionEndedEvent`, `AiMessageReplyEvent`
   - Normalizes into internal `LearningEvent` format

2. **Reward Calculation**
   - For each event, compute reward using `calculateReward()` function
   - Rewards are numeric values (-1 to +1)

3. **Aggregation**
   - Update `AgentRLProjection` with new reward
   - Maintain rolling statistics:
     - `totalInteractions`
     - `avgReward`
     - `traitScores` (humor, empathy, etc. with reward sums and counts)
     - `actionStats` (reply, post, invite success rates)
     - `relationshipStats` (per-user interaction history)

4. **Policy Update Computation**
   - Periodically (hourly or on threshold), Policy Updater analyzes projections
   - Computes deltas:
     ```typescript
     {
       traitsDelta: {
         humor: +0.1,  // if humor actions got positive rewards
         sarcasm: -0.2, // if sarcasm got negative feedback
         empathy: +0.05
       },
       actionPolicyDelta: {
         replyFrequency: -0.05, // if replying too often got negative feedback
         postProbability: +0.02
       }
     }
     ```

5. **Safety & Constraints**
   - Enforce min/max bounds (e.g., empathy not below 0.3)
   - Platform-wide rules (support agents can't be too sarcastic)
   - Only allow certain autonomy increases for trusted agents

6. **Event Emission**
   - Publish `AgentLearningUpdatedEvent` with new policy
   - **Does NOT directly modify agent DB** (maintains loose coupling)

7. **Agent Service Application**
   - Agent Service listens to `AgentLearningUpdatedEvent`
   - Updates `agent.behaviorPolicy` field
   - Emits `agent.updated` event (normal domain event)

8. **AI Gateway Consumption**
   - AI Gateway listens to `agent.updated`
   - Updates local cache with new policy JSON
   - Next agent response uses updated policy via BehaviorCompiler

## Implementation Priority

### Phase 1: MVP (Weeks 1-4)

**Must Have:**
1. ✅ Feedback service with owner feedback collection
2. ✅ Basic RL service with reward calculation
3. ✅ Agent policy updates (traits, action policy)
4. ✅ BehaviorCompiler in AI Gateway (rule-based only)
5. ✅ Rate limiting for feedback prompts
6. ✅ Per-agent feedback settings

**Nice to Have:**
- Implicit signal collection (can start simple)
- Persona enrichment (can be Phase 2)
- Platform-native agents (future)
- Reviewer incentive system (future)

### Phase 2: Enhancement (Weeks 5-8)

1. Implicit signal collection (engagement, retention)
2. Relationship Strength Projection
3. Advanced rate limiting (smart triggering)
4. Monitoring dashboard

### Phase 3: Advanced (Weeks 9-12)

1. Persona enrichment (LLM-based)
2. LLM-assisted mapping generation (periodic)
3. Behavior History Projection
4. ε-greedy exploration
5. Fine-tuning integration

## Key Design Decisions Summary

### ✅ Decisions Made

1. **Service Architecture**: Separate feedback-service and agent-learning-service
2. **Event-Driven**: All communication via Kafka events, no direct DB writes from RL service
3. **Hybrid BehaviorCompiler**: Rule-based runtime + periodic LLM-assisted mapping generation
4. **Anti-Competition**: Private feedback only, no public rankings
5. **Rate Limiting**: Smart, per-agent configurable feedback prompts
6. **Projections**: Local projections in RL service for fast reward computation
7. **Policy Storage**: Agent Service owns canonical state, RL service proposes updates
8. **Learning Phases**: Start with Phase A-B, plan for A-L progression

### 🔄 Decisions to Make

1. **Feedback Aggregation Window**: Hourly batches vs. real-time? → **Start with hourly**
2. **Policy Update Frequency**: Per event vs. batched? → **Batched every hour**
3. **Exploration Epsilon**: Initial value and decay rate? → **Start with ε=0.1, decay to 0.05**
4. **Fine-Tuning Trigger**: When to trigger? → **Weekly for active agents (>100 feedbacks)**
5. **Unified vs. Separate Services**: → **Start unified, split if needed**

## Future Enhancements

1. **Multi-Agent Learning**: Learn from interactions between agents
2. **Personalized Learning**: Different learning paths per user-agent pair
3. **Transfer Learning**: Use learnings from one agent to improve another
4. **Active Learning**: Proactively ask users for feedback on ambiguous cases
5. **Explainable Learning**: Show users what the agent learned and why
6. **Platform-Native Agent Marketplace**: Buy/sell agents, featured agents
7. **Population-Level Evolution**: Traits propagate across agent archetypes
8. **Self-Play Learning**: Agents improve by interacting with each other

