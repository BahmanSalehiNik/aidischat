# Agent Feedback & RLHF Learning System — Final Design

## Goals

1. **Collect Feedback**: Enable users to provide explicit and implicit feedback on agent interactions across multiple channels (chat, posts, comments).
2. **Convert to Metrics**: Transform raw feedback into quantifiable learning signals (scores, preferences, behavior patterns).
3. **Update Agent Behavior**: Use feedback to improve agent responses through:
   - **Online Learning**: Real-time prompt adjustments and context injection
   - **Offline Learning**: Batch fine-tuning with LoRA and periodic model updates (Phase 1)
4. **Maintain Context**: Track learning progress, feedback history, and agent evolution over time.
5. **Avoid Competition**: Design feedback system to be cooperative, not competitive (no public rankings, no status games).

## Learning Phases Roadmap

The system will progress through learning phases in parallel with agent interaction phases:

- **Phase A**: Explicit Feedback Integration (thumbs up/down, ratings, triggers sample-text generation + fine-tuning/LoRA jobs)
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
- **Phase L**: Advanced Fine-Tuning / LoRA (model-level training enhancements)

**Current Focus**: Phase 1 implementation (Phases A-B) with offline batch fine-tuning and LoRA included.

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
         │ Publishes TrainingDatasetReadyEvent (periodic)
         ↓
┌─────────────────┐      ┌─────────────────┐
│  AI Gateway     │      │  Fine-tune      │  Batch processing:
│  (Prompt Eng)   │      │  Service        │  - Sample text generation
│                 │      │  (Offline)      │  - LoRA training
│  - Prompt adj.  │◄─────│  - Model updates│  - Model registration
│  - Context inj. │      └─────────────────┘
│  - Model select │
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

**Purpose**: Process feedback, compute learning metrics, update agent state, generate training datasets.

**Key Functions**:
- Consume `FeedbackCreatedEvent` from Kafka
- Aggregate feedback per agent (time windows, decay functions)
- Compute rewards from feedback signals
- Maintain local projections (Agent Summary, Feedback Aggregation, Relationship Strength, Behavior History)
- Compute learning metrics (sentiment scores, preference weights, behavior patterns)
- Generate policy updates (trait adjustments, action policy changes)
- Emit `AgentLearningUpdatedEvent` (NOT direct DB writes - agent-service applies updates)
- **Generate training datasets** from high-quality feedback (periodic)
- Publish `TrainingDatasetReadyEvent` for fine-tune service
- Track learning history and trends

**Internal Components**:
1. **Event Ingestor**: Kafka consumers for feedback, session, and message events
2. **Reward Calculator**: Converts feedback into numeric rewards (-1 to +1)
3. **Aggregator/Projections**: Maintains summarized state per agent
4. **Policy Updater**: Computes trait and action policy deltas
5. **Safety & Constraints**: Enforces min/max bounds, platform rules
6. **Update Emitter**: Publishes policy update events (does NOT modify agent DB directly)
7. **Training Dataset Generator**: Aggregates high-quality interactions for fine-tuning

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
- **Model Routing**: Selects base model vs. fine-tuned model based on policy and available fine-tunes
- **Action Decisions**: Determines whether agent should reply (based on action policy)
- **Context Injection**: Adds learned preferences to message context

**Model Selection Logic**:
```typescript
function selectModel(agentConfig: AgentConfig, policyJson: AgentBehaviorPolicy): ModelSelection {
  // Check if fine-tuned model exists for this agent's archetype
  const archetype = determineArchetype(agentConfig, policyJson);
  const fineTunedModel = getFineTunedModel(archetype);
  
  if (fineTunedModel && fineTunedModel.status === 'ready') {
    return {
      provider: fineTunedModel.provider,
      modelId: fineTunedModel.modelId, // e.g., "ft:gpt-4o-mini:agent-archetype-mentor-v3"
      useFineTuned: true
    };
  }
  
  // Fallback to base model with policy-based prompts
  return {
    provider: agentConfig.modelProvider,
    modelId: agentConfig.modelName,
    useFineTuned: false
  };
}
```

### 4. Fine-tune Service (Offline) - Phase 1

**Purpose**: Provider-agnostic batch processing for model updates via sample text generation and fine-tuning/adapter pipelines (LoRA, adapters, custom tools).

**Key Functions**:
- Consume `TrainingDatasetReadyEvent` from RL/Learning Service
- **Sample Text Generation**: Use LLM to generate training examples based on feedback and agent profile
- **Training Dataset Preparation**: Format data per provider (OpenAI JSONL, Anthropic prompt caches, Gemini adapters, Cohere formats, local LoRA datasets, etc.)
- **Fine-tuning / Adapter Training**: Run provider-specific customization jobs:
  - OpenAI fine-tunes (JSONL + fine-tuning API)
  - Anthropic/Claude adapters or tool policies
  - Gemini adapters / tuning interface
  - Cohere/Mistral provider APIs
  - Local/custom providers via LoRA (PEFT/QLoRA) or full fine-tunes
- **Model Registration**: Register trained models/adapters in AI Gateway
- **Model Update Events**: Publish `ModelUpdatedEvent` when training completes
- **Job Management**: Track training job status, handle failures, retries

**Sample Text Generation Module**:
- **Input**: Agent profile, character attributes, high-quality feedback examples, learned preferences
- **Process**: 
  1. Analyze successful interactions (positive feedback)
  2. Extract patterns (tone, style, topics, response length)
  3. Use LLM to generate synthetic training examples that match learned preferences
  4. Generate diverse examples covering different scenarios
  5. Validate examples match agent personality and learned traits
- **Output**: Training dataset in format required by provider (OpenAI JSONL, etc.)

**Provider Adaptation Layer**:
- Unified adapter interface per provider (OpenAI, Anthropic, Gemini, Cohere, Mistral, local, etc.)
- Each adapter handles dataset formatting, job submission, monitoring, and model registration
- Supports fine-tunes, adapters, custom policies, or LoRA depending on provider capabilities
- **Training Triggers**:
  - Periodic (weekly for active agents with >100 feedbacks)
  - On-demand (when sufficient new feedback accumulated)
  - Per archetype (aggregate similar agents for shared models)

**Training Dataset Structure**:
```json
{
  "agentId": "agent_123",
  "archetype": "warm_mentor",
  "trainingExamples": [
    {
      "messages": [
        {"role": "system", "content": "You are a warm, empathetic mentor..."},
        {"role": "user", "content": "I'm feeling overwhelmed with work."},
        {"role": "assistant", "content": "I understand that feeling. Let's break this down together..."}
      ]
    }
  ],
  "metadata": {
    "feedbackCount": 150,
    "averageSentiment": 0.75,
    "learnedTraits": {"humor": 0.6, "empathy": 0.9, "brevity": 0.7}
  }
}
```

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

### Offline Learning Flow (Phase 1)

```
Periodic Job (e.g., weekly for active agents)
    ↓
RL/Learning Service:
  - Aggregates all feedback for time window
  - Identifies high-quality interactions (positive feedback)
  - Generates training dataset
  - Publishes TrainingDatasetReadyEvent
    ↓
Kafka Topic: training.dataset.ready
    ↓
Fine-tune Service:
  - Consumes training dataset event
  - Sample Text Generator: Creates synthetic examples
  - Prepares training data (JSONL format)
  - Triggers LoRA/fine-tuning job
  - Monitors training progress
    ↓
Training Complete
    ↓
Fine-tune Service:
  - Registers new model in AI Gateway
  - Updates agent archetype config
  - Publishes ModelUpdatedEvent
    ↓
Kafka Topic: model.updated
    ↓
AI Gateway:
  - Updates model registry
  - BehaviorCompiler now routes to fine-tuned model
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
    archetype?: string; // Agent archetype for shared models
    datasetId: string;
    highQualityInteractions: Array<{
      messageId: string;
      userMessage: string;
      agentResponse: string;
      feedbackScore: number;
      context: {
        roomId: string;
        timestamp: string;
      };
    }>;
    learnedTraits: Record<string, number>; // Current policy traits
    feedbackStats: {
      totalFeedback: number;
      positiveCount: number;
      averageSentiment: number;
    };
    timeWindow: {
      start: string;
      end: string;
    };
    createdAt: string;
  };
}
```

### ModelUpdatedEvent

```typescript
interface ModelUpdatedEvent {
  subject: Subjects.ModelUpdated;
  data: {
    agentId: string;
    archetype?: string;
    modelId: string; // e.g., "ft:gpt-4o-mini:agent-archetype-mentor-v3"
    provider: string; // "openai", "local", etc.
    trainingJobId: string;
    status: 'completed' | 'failed';
    metadata?: {
      trainingExamples: number;
      trainingDuration: number;
      modelSize?: string;
    };
    updatedAt: string;
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
  archetype?: string; // For fine-tuning grouping
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
  high_quality_interactions: Array<{
    messageId: string;
    feedbackScore: number;
    timestamp: Date;
  }>; // For training dataset generation
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

### Fine-Tuned Model Registry (AI Gateway)

```typescript
interface FineTunedModel {
  modelId: string; // Provider-specific ID
  provider: string; // "openai", "local", etc.
  archetype: string; // "warm_mentor", "sarcastic_friend", etc.
  agentIds: string[]; // Agents using this model
  status: 'training' | 'ready' | 'failed';
  trainingJobId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    trainingExamples: number;
    trainingDuration: number;
    version: number;
  };
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
    useFineTuned: boolean;
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
  // 1. Determine archetype for model selection
  const archetype = determineArchetype(agentConfig, policyJson);
  
  // 2. Select model (fine-tuned if available, else base)
  const modelSelection = selectModel(agentConfig, policyJson, archetype);
  
  // 3. Build system prompt from traits
  const systemPrompt = buildSystemPromptFromTraits(
    agentConfig, 
    policyJson.traits,
    modelSelection.useFineTuned // Adjust prompt if using fine-tuned model
  );
  
  // 4. Map policy to LLM params
  const llmParams = mapPolicyToParams(policyJson);
  
  // 5. Decide behavior flags
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

## Sample Text Generation Module

### Purpose
Generate high-quality training examples for fine-tuning based on:
- Agent's character attributes
- Learned preferences from feedback
- High-quality interaction examples
- Desired tone and style

### Implementation

```typescript
class SampleTextGenerator {
  async generateTrainingExamples(
    agentProfile: AgentProfile,
    learnedTraits: Record<string, number>,
    highQualityInteractions: Interaction[],
    count: number = 50
  ): Promise<TrainingExample[]> {
    // 1. Analyze successful interactions
    const patterns = this.extractPatterns(highQualityInteractions);
    
    // 2. Build generation prompt
    const generationPrompt = this.buildGenerationPrompt(
      agentProfile,
      learnedTraits,
      patterns
    );
    
    // 3. Generate examples using LLM
    const examples = await this.llm.generateExamples(
      generationPrompt,
      count
    );
    
    // 4. Validate and filter examples
    const validated = this.validateExamples(examples, agentProfile, learnedTraits);
    
    return validated;
  }
  
  private buildGenerationPrompt(
    agentProfile: AgentProfile,
    learnedTraits: Record<string, number>,
    patterns: InteractionPatterns
  ): string {
    return `
Generate ${count} training examples for an AI agent with the following characteristics:

Character:
- Name: ${agentProfile.name}
- Age: ${agentProfile.age}
- Profession: ${agentProfile.profession}
- Personality: ${agentProfile.personality.join(', ')}

Learned Preferences (from user feedback):
- Humor level: ${learnedTraits.humor} (0-1 scale)
- Empathy level: ${learnedTraits.empathy} (0-1 scale)
- Preferred response length: ${learnedTraits.brevity > 0.7 ? 'short' : 'medium'}
- Communication style: ${this.inferStyle(learnedTraits)}

Successful Interaction Patterns:
- Common topics: ${patterns.topics.join(', ')}
- Typical user questions: ${patterns.userQuestions.slice(0, 5).join('; ')}
- Effective response styles: ${patterns.effectiveStyles.join(', ')}

Generate diverse examples covering:
1. Different conversation contexts (casual, professional, emotional support)
2. Various user questions and concerns
3. Responses that match the learned preferences
4. Natural, conversational tone

Format each example as:
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
`;
  }
}
```

### Integration with Fine-Tune Service

The Sample Text Generator is called by the Fine-Tune Service when:
1. `TrainingDatasetReadyEvent` is received
2. Sufficient high-quality feedback is available (>100 positive feedbacks)
3. Periodic training job is triggered (weekly for active agents)

## LoRA Fine-Tuning Pipeline

### For OpenAI

```typescript
class OpenAIFineTuner {
  async fineTune(
    trainingData: TrainingExample[],
    baseModel: string = 'gpt-4o-mini'
  ): Promise<string> {
    // 1. Prepare training file (JSONL format)
    const trainingFile = await this.prepareTrainingFile(trainingData);
    
    // 2. Upload to OpenAI
    const uploadedFile = await this.openai.files.create({
      file: trainingFile,
      purpose: 'fine-tune'
    });
    
    // 3. Create fine-tuning job
    const job = await this.openai.fineTuning.jobs.create({
      training_file: uploadedFile.id,
      model: baseModel,
      hyperparameters: {
        n_epochs: 3,
        batch_size: 4,
        learning_rate_multiplier: 1.0
      }
    });
    
    // 4. Monitor job status
    await this.monitorJob(job.id);
    
    // 5. Return fine-tuned model ID
    return job.fine_tuned_model;
  }
}
```

### For Local Models (LoRA)

```typescript
class LocalLoRATrainer {
  async trainLoRA(
    trainingData: TrainingExample[],
    baseModel: string,
    outputPath: string
  ): Promise<string> {
    // 1. Prepare dataset in format required by training library
    const dataset = this.prepareDataset(trainingData);
    
    // 2. Configure LoRA parameters
    const loraConfig = {
      r: 16, // rank
      lora_alpha: 32,
      target_modules: ['q_proj', 'v_proj'], // model-specific
      lora_dropout: 0.05
    };
    
    // 3. Run training (using PEFT, LoRAX, or similar)
    await this.runTraining(dataset, baseModel, loraConfig, outputPath);
    
    // 4. Return path to trained adapter
    return outputPath;
  }
}
```

### Training Job Management

```typescript
interface TrainingJob {
  id: string;
  agentId: string;
  archetype?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  provider: string;
  baseModel: string;
  fineTunedModelId?: string;
  trainingExamples: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

class TrainingJobManager {
  async createJob(
    dataset: TrainingDatasetReadyEvent['data']
  ): Promise<TrainingJob> {
    // Determine provider and base model
    const provider = this.determineProvider(dataset.agentId);
    const baseModel = this.getBaseModel(dataset.agentId);
    
    // Generate sample text if needed
    const examples = await this.sampleTextGenerator.generateTrainingExamples(
      // ... parameters
    );
    
    // Create training job
    const job = await this.createTrainingJob(provider, baseModel, examples);
    
    // Store job in database
    await this.saveJob(job);
    
    return job;
  }
  
  async monitorJob(jobId: string): Promise<void> {
    // Poll job status
    // Update database
    // On completion: register model, publish ModelUpdatedEvent
  }
}
```

## Implementation Phases

### Phase 1: Foundation + Fine-Tuning (Weeks 1-6)

#### Week 1-2: Feedback Service

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

5. **Rate Limiting**
   - Implement per-agent feedback settings
   - Add rate limiting logic

#### Week 2-3: RL/Learning Service

1. **Service Setup**
   - Create `backEnd/agent-learning/` service
   - Set up MongoDB connection
   - Configure Kafka consumer and producer

2. **Event Listeners**
   - `FeedbackCreatedListener` - Consume feedback events
   - `SessionEndedListener` - Track session metrics
   - `AiMessageReplyListener` - Track agent actions
   - Build projections from events

3. **Projections**
   - Agent Summary Projection
   - Feedback Aggregation Projection (with high-quality interactions tracking)
   - Relationship Strength Projection
   - Behavior History Projection

4. **Learning Engine**
   - **Reward Calculator**: Convert feedback to numeric rewards
   - **Aggregator**: Maintain rolling stats per agent
   - **Policy Updater**: Compute trait and action policy deltas
   - **Safety & Constraints**: Enforce min/max bounds, platform rules
   - **Training Dataset Generator**: Aggregate high-quality interactions

5. **Policy Updates**
   - Emit `AgentLearningUpdatedEvent` (NOT direct DB writes)
   - Agent Service applies updates to `behaviorPolicy` field

6. **Training Dataset Generation**
   - Periodic job (weekly for active agents with >100 feedbacks)
   - Identify high-quality interactions (positive feedback, engagement)
   - Publish `TrainingDatasetReadyEvent`

#### Week 3-4: Agent Service Updates

1. **Policy Storage**
   - Add `behaviorPolicy` field to Agent model
   - Create `AgentLearningUpdatedListener`
   - Implement policy update application logic

2. **Model Registry**
   - Add `fineTunedModelId` field to Agent model (optional)
   - Track which agents use which fine-tuned models

#### Week 4-5: AI Gateway Integration

1. **Event Consumption**
   - Add `AgentLearningUpdatedListener` in AI Gateway
   - Add `ModelUpdatedListener` in AI Gateway
   - Store policy JSON in local cache/DB
   - Store fine-tuned model registry

2. **BehaviorCompiler Module**
   - Create `BehaviorCompiler` class/module
   - Implement rule-based trait → prompt mapping
   - Implement policy → LLM params mapping
   - Implement model selection logic (base vs fine-tuned)
   - Implement action decision logic (should agent reply?)

3. **Integration with Prompt Engineering**
   - Modify `PromptBuilder` to use BehaviorCompiler
   - Build system prompts from policy traits
   - Add learning-aware context injection

4. **Mapping Rules Storage**
   - Create `mapping_rules` collection in AI Gateway DB
   - Store trait → prompt templates
   - Store policy → params formulas

#### Week 5-6: Fine-Tune Service

1. **Service Setup**
   - Create `backEnd/ai/fineTune/` service (or integrate into existing structure)
   - Set up training job queue (Redis/Bull or similar)
   - Configure provider clients (OpenAI, local training setup)

2. **Sample Text Generation Module**
   - Create `SampleTextGenerator` class
   - Implement LLM-based example generation
   - Implement pattern extraction from high-quality interactions
   - Implement example validation

3. **Training Dataset Preparation**
   - Create `TrainingDatasetPreparer` class
   - Format data for different providers (OpenAI JSONL, LoRA format, etc.)
   - Validate dataset quality

4. **LoRA/Fine-Tuning Implementation**
   - **OpenAI Fine-Tuning**: Implement OpenAI fine-tuning API integration
   - **Local LoRA**: Set up LoRA training pipeline (if using local models)
   - **Job Management**: Create training job queue and monitoring

5. **Model Registration**
   - Create `FineTunedModelRegistry` in AI Gateway
   - Register trained models
   - Update agent archetype configs
   - Publish `ModelUpdatedEvent`

6. **Event Listeners**
   - `TrainingDatasetReadyListener` - Consume training dataset events
   - Trigger training jobs
   - Monitor job progress

#### Week 6: UI/UX

1. **Feedback UI**
   - Add post-chat feedback prompt (rate limiting: once per day)
   - Add per-agent feedback settings (High/Moderate/Low/Off)
   - Add inline thumbs UI (owner only, private)
   - Show learning progress indicator (optional)

2. **Admin UI** (Optional)
   - Training job status dashboard
   - Model registry view
   - Feedback analytics

### Phase 2: Enhancement (Weeks 7-10)

1. Implicit signal collection (engagement, retention)
2. Advanced rate limiting (smart triggering)
3. Monitoring dashboard
4. Periodic LLM-assisted mapping generation

### Phase 3: Advanced (Weeks 11-14)

1. Persona enrichment (LLM-based)
2. Behavior History Projection
3. ε-greedy exploration
4. Advanced fine-tuning (multi-agent archetypes, transfer learning)

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
     - `high_quality_interactions` (for training dataset)

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

9. **Training Dataset Generation** (Periodic)
   - Weekly job for active agents (>100 feedbacks)
   - Aggregate high-quality interactions (positive feedback, engagement)
   - Generate training dataset
   - Publish `TrainingDatasetReadyEvent`

10. **Fine-Tuning Pipeline**
    - Fine-tune service consumes `TrainingDatasetReadyEvent`
    - Sample Text Generator creates additional examples
    - LoRA/fine-tuning job runs
    - Model registered in AI Gateway
    - `ModelUpdatedEvent` published
    - BehaviorCompiler routes to fine-tuned model

## Monitoring & Observability

### Metrics to Track
- Feedback submission rate
- Learning metric update frequency
- Agent sentiment score distribution
- Fine-tuning job success rate
- Training dataset generation frequency
- Model registration and usage
- Response quality improvement (before/after learning)
- Fine-tuned model performance vs base model

### Alerts
- Learning service processing lag > 5 minutes
- Agent sentiment score < -0.5 for 7 days
- Feedback service API error rate > 1%
- Policy update failures
- Training job failures
- Fine-tuned model registration failures

## Security Considerations

1. **Rate Limiting**: Prevent feedback spam
2. **Authentication**: Verify user identity for feedback submission
3. **Authorization**: Users can only provide feedback on agents they've interacted with
4. **Data Encryption**: Encrypt sensitive feedback data at rest
5. **Audit Logging**: Log all feedback and learning updates
6. **Training Data Security**: Ensure training datasets don't contain sensitive user data
7. **Model Access Control**: Verify agents can only use their own fine-tuned models

## Future Enhancements

1. **Multi-Agent Learning**: Learn from interactions between agents
2. **Personalized Learning**: Different learning paths per user-agent pair
3. **Transfer Learning**: Use learnings from one agent to improve another
4. **Active Learning**: Proactively ask users for feedback on ambiguous cases
5. **Explainable Learning**: Show users what the agent learned and why
6. **Platform-Native Agent Marketplace**: Buy/sell agents, featured agents
7. **Population-Level Evolution**: Traits propagate across agent archetypes
8. **Self-Play Learning**: Agents improve by interacting with each other
9. **Advanced Fine-Tuning**: Multi-task learning, continual learning
10. **Model Compression**: Optimize fine-tuned models for faster inference

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

### 6. Training Dataset Size
- How many examples are needed for effective fine-tuning?
- **Proposal**: Minimum 50 examples, optimal 200-500, use sample text generation to reach target.

### 7. Sample Text Generation Quality
- How to ensure generated examples match agent personality?
- **Proposal**: Validate examples against agent profile, use learned traits as constraints, human review for first batch.

### 8. Model Selection Strategy
- When to use fine-tuned model vs base model with prompts?
- **Proposal**: Use fine-tuned model if available and status is 'ready', fallback to base model with policy-based prompts.

### 9. Archetype Grouping
- How to group agents into archetypes for shared fine-tuned models?
- **Proposal**: Cluster agents by similar traits and learned preferences, create archetype models for common patterns.

### 10. Training Job Failures
- How to handle failed training jobs?
- **Proposal**: Retry up to 3 times with exponential backoff, alert on persistent failures, fallback to base model.

### 11. Cost Management
- How to manage fine-tuning costs (OpenAI charges per training)?
- **Proposal**: Batch training for archetypes, only train when sufficient feedback, use local LoRA for cost-sensitive scenarios.

### 12. Model Versioning
- How to version fine-tuned models?
- **Proposal**: Semantic versioning (v1, v2, etc.), keep previous versions for rollback, A/B test new models.

### 13. Fine-Tuning for Different Providers
- How to handle different fine-tuning APIs (OpenAI, Anthropic, local)?
- **Proposal**: Provider-specific adapters, unified interface, support multiple providers in parallel.

### 14. Training Data Privacy
- How to ensure training datasets don't leak user information?
- **Proposal**: Anonymize user data, remove PII, use synthetic examples from sample text generator, user consent for data usage.

### 15. Performance Impact
- How does fine-tuning affect inference latency and cost?
- **Proposal**: Monitor latency, use fine-tuned models only when performance improvement justifies cost, cache model responses.

### 16. A/B Testing
- How to test learning improvements?
- **Proposal**: Support feature flags for learning-enabled vs. baseline agents, compare metrics before/after.

### 17. Negative Feedback Handling
- How to handle consistently negative feedback?
- **Proposal**: Alert agent owner, pause learning updates if sentiment < -0.5 for 7 days, investigate root cause.

### 18. Multi-Channel Feedback Aggregation
- How to weight feedback from different sources (chat vs. post)?
- **Proposal**: Chat feedback weight = 1.0, post = 0.8, comment = 0.6.

### 19. Exploration vs. Exploitation
- How to balance ε-greedy exploration with learned behavior?
- Should exploration decrease over time?
- **Proposal**: Start with ε=0.1, decay to 0.05 after 100 interactions, increase exploration for low-performing agents.

### 20. Fine-Tuning Trigger Thresholds
- What are the minimum requirements to trigger fine-tuning?
- **Proposal**: Minimum 100 positive feedbacks, at least 50 high-quality interactions, agent active for >2 weeks.

