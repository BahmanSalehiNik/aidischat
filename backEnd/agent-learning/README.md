# Agent Learning (RLHF) Service

This service consumes feedback, session, and AI action events to keep each agent’s behavior policy up to date. It mirrors the architecture defined in `docs/agent-learning-service-design.md`, but here’s the condensed view focused on implementation.

## Data Flow

```
Kafka (feedback/session/ai events)
        │
        ▼
Event Listeners
   - agent.created         -> seed projections
   - feedback.created      -> rewards + triggers
   - session.ended         -> relationship strength
   - ai.message.reply      -> behavior history
        │
        ▼
Projections (Mongo)
   - AgentLearningSummary
   - AgentFeedbackAggregation
   - AgentRelationshipStrength
   - AgentBehaviorHistory
        │
        ├─ PolicyTrigger → PolicyEngine → AgentLearningUpdatedEvent
        │
        └─ HighQualityInteraction → Dataset queue → TrainingDatasetReadyEvent
```

### Realtime loop
1. `FeedbackCreatedListener` maps raw feedback to normalized rewards and updates `AgentFeedbackAggregation`.
2. `PolicyTrigger` checks thresholds (>=5 pending feedback, 5 min timer, session end, strong signal, inactivity guard).
3. `PolicyEngine` adjusts traits/action policy/exploration, persists `AgentLearningSummary`, and emits `AgentLearningUpdatedEvent`.

### Auxiliary projections
- `SessionEndedListener` updates per-user relationship stats (trust/inactivity).
- `AiMessageReplyListener` logs outgoing agent actions for later correlation.

### Dataset generation
- Positive feedback + high-quality interactions are collected in `HighQualityInteraction`.
- `DatasetScheduler` periodically enqueues agents over the thresholds.
- `DatasetGenerator` workers create `TrainingDatasetReadyEvent` payloads for the fine-tune pipeline and log job status in `TrainingJob`.

## Key Files

| Path | Purpose |
| ---- | ------- |
| `src/index.ts` | Bootstraps service, connects Kafka/Mongo, registers listeners, starts dataset worker/scheduler. |
| `src/events/listeners/*.ts` | Kafka consumers for agent created, feedback, session ended, and AI replies. |
| `src/models/*.ts` | Mongo projections: learning summary, feedback aggregation, relationship strength, behavior history, high-quality interactions, training jobs. |
| `src/services/reward-calculator.ts` | Converts feedback metadata to normalized reward + strong-signal flag. |
| `src/services/policy-trigger.ts` | Encapsulates threshold logic (feedback count, time interval, inactivity, strong signals). |
| `src/services/policy-engine.ts` | Applies learning rates, clamps values, and publishes updated policy JSON. |
| `src/services/dataset-generator.ts` | Handles dataset eligibility + job execution, emitting `TrainingDatasetReadyEvent`. |
| `src/queues/dataset-queue.ts` | BullMQ queue + worker setup for dataset jobs. |
| `src/test/*.test.ts` | Initial unit tests for reward calculation, trigger logic (policy engine tests skipped until Kafka mocking strategy finalized). |

For the full design rationale, see `docs/agent-learning-service-design.md` and the roadmap file. Use this README as the quick reference when working inside the service.

