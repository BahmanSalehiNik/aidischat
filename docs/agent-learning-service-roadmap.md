# Agent-Learning (RLHF) Service — Roadmap

This roadmap consolidates the detailed design (`docs/agent-learning-service-design.md`) and the latest decisions from stakeholder chats. It focuses on execution order, trigger thresholds, and operational guardrails for both the realtime and batch learning loops.

---

## 1. Realtime Policy Update Loop

**Execution Model**
- Dedicated RLHF worker service (Kafka consumer) maintains projections in Mongo and emits policy JSON events.
- No Redis dependency; Kafka + Mongo handle durability and fan-out.

**Trigger Conditions** (any condition fires a recompute):
1. `pendingFeedbackCount >= 5` since last update (per agent).
2. `timeSinceLastUpdate >= 5 minutes` **and** `pendingFeedbackCount > 0` (skip if no new activity).
3. Session termination with at least one new feedback event.
4. Strong-signal events (draft rejection/approval, thumbs-down, abuse flags) trigger `ImmediatePolicyRecalc`.

**Processing Steps**
1. Consume event → normalize reward (bounded ±1, reward table configurable).
2. Update projections (`agent_feedback_aggregations`, `agent_relationship_strength`, etc.).
3. If any trigger satisfied → compute deltas:
   ```ts
   newValue = clamp(oldValue + learningRate * avgReward, minTrait, maxTrait);
   ```
4. Serialize `AgentLearningUpdatedEvent` with the new traits, action policy, exploration epsilon, metrics snapshot, and `version++`.

**Safety Rails**
- Freeze updates when sentiment < -0.5 for 7 days (manual investigation).
- Skip all triggers when `lastActivityAt` exceeds 40 minutes (no conversations, drafts, or feedback) to avoid redundant recalculations; resume once a new event arrives.
- Clamp per-trait values (e.g., empathy ∈ [0.2, 0.95]).
- Exploration epsilon lowered only when variance decreases to avoid premature convergence.

---

## 2. Learning-Rate Strategy

| Layer | Default | Override support |
|-------|---------|------------------|
| Traits | `0.07` | Per-trait + per-agent overrides, bounded `[0.02, 0.12]` |
| Action Policy | `0.05` | Per-agent override allowed |
| Exploration ε | `0.02` | Lowered automatically for highly stable agents |

**Override hierarchy**
1. Global defaults.
2. Trait-level overrides (`humor`, `sarcasm`, etc.).
3. Agent-level overrides (owner or admin controlled).

Overrides are stored in the agents service (`agent.learningConfig`) and enforced in RLHF with caps to prevent runaway updates. Owners can select learning profiles (“conservative / balanced / fast”) that map to preset override bundles.

---

## 3. Cold-Start & Sparse Feedback Handling

Agents inherit archetype priors until sufficient data accumulates. We blend learned values with archetype defaults using:

```ts
const COLD_START_THRESHOLD = 50;
const weight = Math.min(1, feedbackCount / COLD_START_THRESHOLD);
const effectiveTrait = archetypeTrait * (1 - weight) + learnedTrait * weight;
```

Additional rules:
- If `feedbackCount < 10` or `lastFeedbackAt > 7 days`, apply decay toward archetype defaults when computing deltas.
- Maintain a `confidence` flag in projections so downstream consumers know whether the policy is data-driven or archetype-driven.

---

## 4. Batch RLHF & Fine-Tuning

**Orchestration**
- Kubernetes CronJobs drive periodic jobs:
  - **Daily**: aggregate high-quality interactions → build datasets.
  - **Weekly**: trigger fine-tuning / LoRA jobs when thresholds met.
  - **Monthly**: archetype-level clustering and mapping-rule refresh.
- Optional BullMQ queue may be introduced later for on-demand training or prioritization, but CronJobs are the baseline.

**Dataset Eligibility**
- `positiveFeedback >= 100` in the last 30 days.
- `highQualityInteractions >= 50`.
- Not trained within the past week (per agent or archetype).

**Job Tracking**
Collection: `training_jobs`
```ts
{
  jobId: string;
  agentId?: string;
  archetype?: string;
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  retries: number;
  modelOutputId?: string;
}
```

**Outputs**
- `TrainingDatasetReadyEvent` for each dataset batch.
- Fine-tune pipeline registers models (`FineTunedModelRegistry`) and emits `ModelUpdatedEvent`.

---

## 5. Implementation Phases

| Phase | Scope | Key Deliverables |
|-------|-------|------------------|
| Phase 1 | Realtime loop foundation | Kafka consumers, projections, policy event emission, threshold engine |
| Phase 2 | Implicit signals & monitoring | Session triggers, advanced reward configs, dashboards, owner LR presets |
| Phase 3 | Batch RLHF maturity | Dataset CronJobs, job tracking, fine-tune pipeline integration, archetype clustering |
| Phase 4 | Advanced learning | Exploration strategies, transfer learning, cross-agent insights |

---

## 6. Action Items

1. Implement trigger evaluator with the four conditions above and persist `pendingFeedbackCount`, `lastUpdateAt`.
2. Extend agents service schema with optional `learningConfig` for overrides and expose minimal owner UI.
3. Add archetype priors + cold-start blending helper in the policy calculator.
4. Create `training_jobs` collection + daily/weekly CronJobs (or BullMQ workers if Redis already provisioned) for batch RLHF.
5. Document strong-signal event list and ensure feedback service emits the necessary metadata (draft status, abuse flags).

This roadmap should be used alongside the detailed design doc during development; updates from future chats will be appended here before temp artifacts are archived.

