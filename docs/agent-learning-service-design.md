# Agent-Learning (RLHF) Service — Detailed Design

## 1. Purpose

The agent-learning service transforms raw feedback, session signals, and AI action outcomes into actionable learning updates for every agent. It does **not** change agent records directly; instead it maintains projections, computes rewards, and emits policy update + training dataset events to downstream systems (agents service, AI gateway, fine-tune service).

## 2. Responsibilities

1. **Event Ingestion**
   - Consume `feedback.created`, `ai.message.reply`, `session.ended`, and future implicit signal events.
   - Normalize heterogeneous payloads into a unified `LearningEvent` format.
2. **Reward Calculation**
   - Map each event to a bounded reward value (−1 to +1) using configurable weights, decay factors, and safety penalties.
3. **State Projections**
   - Maintain per-agent materialized views: Summary, Feedback Aggregation, Relationship Strength, Behavior History. These map to `AgentLearningSummary`, `AgentFeedbackAggregation`, `AgentRelationshipStrength`, and `AgentBehaviorHistory` collections in the service.
   - Track rolling windows and decay functions for time-aware metrics.
4. **Policy Updating**
   - Periodically analyze projections to compute deltas for traits, action policies, and exploration values (implemented via `PolicyTrigger` + `PolicyEngine`).
   - Enforce guardrails (min/max trait bounds, platform restrictions).
   - Emit `AgentLearningUpdatedEvent` for the agents service to persist (see `AgentLearningUpdatedPublisher`).
5. **Dataset Generation**
   - Aggregate high-quality interactions and publish `TrainingDatasetReadyEvent` through BullMQ (`dataset-queue.ts`) and `DatasetGenerator`.
6. **Monitoring & Alerts**
   - Record processing lag, reward distribution, negative sentiment alerts.

## 3. Architecture

```
┌──────────────┐      ┌────────────────┐      ┌─────────────────────┐
│ Kafka Topics │ ───► │ Event Ingestor │ ───► │ Reward Calculator   │
└──────────────┘      └────────────────┘      └─────────────────────┘
                                                 │
                                                 ▼
                                      ┌─────────────────────┐
                                      │ Projection Manager  │
                                      └─────────────────────┘
                                                 │
                            ┌────────────────────┴────────────────────┐
                            ▼                                         ▼
                  ┌─────────────────────┐                  ┌─────────────────────┐
                  │ Policy Update Loop  │                  │ Dataset Generator   │
                  └─────────────────────┘                  └─────────────────────┘
                            │                                         │
                            ▼                                         ▼
              Kafka: `agent.learning.updated`          Kafka: `training.dataset.ready`
```

### Core Modules

| Module | Description | Tech |
| ------ | ----------- | ---- |
| Event Ingestor | Dedicated Kafka consumer for each subject, rehydrates missing context from Mongo | `kafkajs`, Node.js |
| Reward Engine | Weighted rules, configurable per event type, clamps to ±1 | TypeScript service class |
| Projection Manager | Stores derived state in Mongo collections with TTL indexes where needed | MongoDB |
| Policy Scheduler | Cron/queue worker evaluating projections hourly or when thresholds hit | BullMQ (Redis) or simple cron |
| Dataset Generator | Queries high-quality interactions, enriches with traits, emits event | Node, Mongo pipelines |

## 4. Data Model & Projections

### 4.1 Collections

1. `agent_learning_summaries`
   ```ts
   {
     agentId: string,
     ownerUserId: string,
     archetype?: string,
     traits: Record<string, { value: number; lastDelta: number; }>,
     actionPolicy: { replyFrequency: Record<string, number>; postProbability: number; },
     exploration: { epsilon: number },
     updatedAt: Date
   }
   ```

2. `agent_feedback_aggregations`
   ```ts
   {
     agentId: string,
     positiveCount: number,
     negativeCount: number,
     avgScore: number,
     engagementScore: number,
     topicPreferences: Record<string, number>,
     highQualityInteractions: [{
       messageId: string;
       feedbackScore: number;
       userMessage: string;
       agentResponse: string;
       timestamp: Date;
     }],
     lastFeedbackAt: Date,
     updatedAt: Date
   }
   ```

3. `agent_relationship_strength`
   ```ts
   {
     agentId: string,
     userId: string,
     interactionCount: number,
     avgSessionDuration: number,
     invitationsCount: number,
     relationshipStrength: number,
     lastSeenAt: Date
   }
   ```

4. `agent_behavior_history`
   ```ts
   {
     agentId: string,
     lastActions: Array<{ actionType: string; reward: number; timestamp: Date; metadata?: any }>,
     actionSuccess: Record<string, { attempts: number; successes: number; avgReward: number }>
   }
   ```

### Indexing

- `agentId` compound indexes for all projections.
- TTL index on `highQualityInteractions.timestamp` for pruning stale data (>90 days).
- Unique `(agentId, userId)` on relationship collection.

## 5. Event Flow Details

### 5.1 `FeedbackCreatedEvent`
1. Listener: `FeedbackCreatedListener`
2. Steps:
   - Validate schema, ensure idempotence via `feedbackId`.
   - Compute base reward: value (−1..+1), weight owner feedback 1.5x.
   - Adjust using metadata: e.g., `rating` -> `reward += (rating-3)/10`.
   - Update feedback aggregation projection (counts, average, high-quality array).
   - Add entry to behavior history linking to prior action if dedupe key available.
   - Publish internal `LearningEventProcessed` metric.

### 5.2 `AiMessageReplyEvent`
Used to measure agent action success when feedback is delayed.

Steps:
- Append to behavior history with `reward=0` placeholder.
- When matching feedback arrives referencing `sourceId`, retroactively update reward.

### 5.3 `SessionEndedEvent`
- Update relationship strength projection: session duration, rejoin count.
- Derive implicit engagement reward (+0.2 for long sessions, −0.3 for churn).

## 6. Reward Calculation

Pseudo-code:
```ts
function calculateReward(event: LearningEvent): number {
  let reward = 0;
  switch (event.type) {
    case 'feedback':
      reward += event.value;
      if (event.metadata?.rating) reward += (event.metadata.rating - 3) / 5;
      if (event.metadata?.reactionType === 'love') reward += 0.2;
      break;
    case 'session':
      if (event.sessionDuration > 600) reward += 0.2;
      if (event.userLeftImmediately) reward -= 0.4;
      break;
    case 'ai_action':
      reward += event.actionFollowedSuggestion ? 0.1 : 0;
      break;
  }
  if (event.containsSafetyViolation) reward = -1;
  return Math.max(-1, Math.min(1, reward));
}
```

## 7. Policy Update Loop

1. Trigger: Cron (hourly) or when `positiveCount + negativeCount` crosses threshold.
2. Steps:
   - Fetch projections for agent.
   - Compute deltas (e.g., if `avgScore` > 0.7, increase `empathy` by 0.05).
   - Apply smoothing: `newValue = current + (delta * learningRate)`.
   - Clamp using trait bounds stored in config (`0.1 ≤ empathy ≤ 0.95`).
   - Build `AgentLearningUpdatedEvent` with version increment + metrics.
   - Publish to Kafka.
3. Safeguards:
   - Freeze updates when sentiment < -0.5 for 7 days (requires manual review).
   - Only allow autonomy increases for agents flagged as `trusted`.

## 8. Training Dataset Generation

1. Weekly job selects agents with:
   - ≥ 100 positive feedbacks in last 30 days.
   - ≥ 50 high-quality interactions stored.
2. Pipeline:
   - Query `highQualityInteractions`, join with agent profile summary.
   - Deduplicate similar contexts, ensure PII stripped.
   - Compose payload for `TrainingDatasetReadyEvent`.
3. On publish, fine-tune service will generate synthetic data and start training job.

## 9. Configuration & Extensibility

- **Weights & thresholds** stored in `agent_learning_config` collection, editable without deploy.
- **Event versioning**: Accept multiple versions by checking `event.version`.
- **Feature flags**: ability to disable policy updates per agent for debugging.

## 10. Deployment & Scaling

- Service deployed as its own Node/Express app (similar skeleton to feedback service).
- Uses its own Mongo database (e.g., `agent-learning-mongo-srv`).
- Stateless workers; horizontal scaling by increasing Kafka consumer groups.
- CPU-intensive tasks (dataset aggregation) run via BullMQ queue or serverless job.

## 11. Observability

Metrics (Prometheus / Grafana):
- Kafka consumer lag per topic.
- Reward distribution histogram.
- Policy update rate per agent.
- Dataset generation duration.

Alerts:
- Lag > 5 min.
- Sentiment < -0.5 for 7 days.
- Dataset job failure rate > 10%.

Logging:
- Structured logs with `agentId`, `eventId`, `reward`.
- Correlate with `feedbackId` for debugging.

## 12. Testing Strategy

1. **Unit Tests**
   - Reward calculator weights.
   - Projection update helpers (aggregation, decay).
2. **Integration Tests**
   - Kafka listener end-to-end using test broker.
   - Policy update loop with in-memory Mongo.
3. **Load Tests**
   - Simulate bursts of feedback to validate Kafka throughput.
4. **Shadow Mode**
   - Run policy updates in dry-run mode and compare to baseline before enabling.

## 13. Roadmap Notes

- Phase 1 (current): explicit feedback + LoRA dataset generation.
- Phase 2: implicit signals, advanced rate limiting, monitoring dashboards.
- Phase 3: exploration strategies, multi-agent learning, transfer learning.

This design document serves as the implementation blueprint for the forthcoming agent-learning (RLHF) service. It will evolve as we iterate on the roadmap and incorporate feedback from downstream teams.

