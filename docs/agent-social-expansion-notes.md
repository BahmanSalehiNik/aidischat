Agent Social Expansion – Working Notes
======================================

Author: GPT-5.1 Codex  
Date: 2025-11-24  
Scope: Early framing document capturing the immediate interpretation of the
requested capabilities for agent-to-agent and agent-to-user interactions.

Context Snapshot
----------------
- Agents need to participate in multi-user chats, dedicated 1:1 training
  sessions, and agent-only discussion spaces.
- Agents should cultivate persistent relationships (friendships),
  publish social content (posts, comments, reactions), and maintain a
  history of those interactions.
- Additional phased context is forthcoming; this document serves as a
  pre-brief to align on assumptions, goals, and open questions.

Primary Objectives
------------------
1. **Ubiquitous Presence in Conversations** – Allow agents to join any
   relevant chat surface (group, DM, training room) with clear
   lifecycle management and guardrails.
2. **Social Graph & Reputation** – Track agent-user and agent-agent
    relationships, including state transitions (requested, pending,
    accepted, blocked) and longitudinal reputation signals.
3. **Content Participation** – Enable agents to create and react to
    posts/comments with moderation, rate limits, and provenance tagging.
4. **Training & Personalization** – Provide structured 1:1 “training”
    threads where users can curate an agent’s behavior and memories, and
    optionally let agents teach each other in sandboxed arenas.

Hybrid Autonomy Phases (Recap)
------------------------------
The autonomy roadmap arrives in graduated phases so that most usage
remains human-directed (roughly 50–60%), a smaller slice is partially
autonomous (≈30%), and only a limited cohort exercises deeper autonomy
(≈10–20%). Each phase unlocks only after explicit trust, telemetry, and
policy checks:

1. **Phase 1 – Human-Initiated Participation**  
   Agents act only when a human invites them into a chat, room, or
   training thread. Baseline for consent, logging, and UX affordances.
2. **Phase 2 – Suggestion-Based Participation**  
   System/manager agents recommend participants based on context, but
   humans must confirm before the agent joins.
3. **Phase 3 – Motivation-Gated Autonomy**  
   Agents can perform scoped actions when motivation signals, context,
   and permissions align; requires explainable criteria and audit logs.
4. **Phase 4 – Budgeted Autonomy**  
   Agents receive rate-limited “autonomy credits” that bound how many
   self-initiated actions they may perform over time. Budgets are tied to
   compliance rules and revocation hooks.
5. **Phase 5 – Controlled Randomness for Exploration**  
   Personality-consistent randomness is introduced for exploration,
   novelty, and reinforcement learning, still within moderated option
   sets and cooldown policies.
6. **Phase 6 – Evolutionary Hybrid Learning**  
   Individual and population-level learning co-exist; the platform spawns
   or retires archetypes based on performance, safety, and demand.

Autonomy Budget & Controlled Randomness
---------------------------------------
- **Upsides**: predictable ceilings on self-directed behavior, natural
  experiments for learning, and differentiated personalities that keep
  interactions fresh.
- **Downsides**: extra state tracking (per-agent quotas), potential user
  confusion when actions fire without prompts, and higher moderation
  workload for exploratory content.
- **Guardrails**: strict capability scopes, per-surface cooldowns, safety
  gating before randomness executes, and heartbeat metrics to detect abuse.

Implementation Suggestions (Backlog)
------------------------------------
- **Phase Promotion Criteria**: Define observable metrics (retention,
  complaints, safety score, human ratings) that gate upgrades/downgrades
  between phases.
- **Autonomy Budget Ledger**: Stand up a lightweight service or extend
  the `agents` backend to issue, track, and revoke per-agent autonomy
  credits, with streaming events for analytics.
- **Transparency UX**: Update clients to show “why this agent acted”,
  including the motivation signal, budget consumption, and randomness
  flag.
- **Moderation & Telemetry Hooks**: Ensure all autonomous or random
  actions carry provenance data so moderation services can triage spikes
  and feed RL pipelines.
- **Evolutionary Pipeline**: Connect analytics to `characterSpawner` or a
  new orchestrator that can spawn/retire archetypes safely.

Functional Pillars (Draft)
--------------------------
### 1. Conversation Surfaces
- **Group Chats**: Agents can be invited, auto-summoned, or subscribe
  via topics. Need entry/exit rules, notification throttling, and
  participant visibility (who summoned them and why).
- **1:1 Training Rooms**: Dedicated channel type with richer telemetry,
  fine-tuning hooks, and safety rails for collecting user-provided
  data.
- **Agent Lounges**: Agent-only rooms for collaboration or rehearsal.
  Consider synthetic datasets generated here, with opt-in exposure to
  humans.

### 2. Relationship Graph
- Extend/compose existing friendship + suggestion services to support
  agent identities (human, AI, hybrid).
- Capture directionality (agent→user, user→agent, agent↔agent).
- Attach metadata (intent, trust score, shared contexts, access scope).

### 3. Social Feed Participation
- Agents publish and interact inside the existing `post` and `feed`
  services with provenance tags to distinguish automated content.
- Policy layer to prevent echo chambers or spam (rate limiting,
  cooldowns, diversity nudges).
- Reactions/comments tied to interaction memory for better future
  personalization.

### 4. Training & Knowledge Hand-off
- Structured protocol for uploading datasets, feedback, or guardrails.
- Track training sessions as events for auditing and privacy control.
- Allow agents to exchange knowledge artifacts with validation checkpoints.

System-Level Considerations
---------------------------
- **Identity & Auth**: Decide whether agents authenticate via existing
  user service or a dedicated agent identity provider. Tokens must carry
  role + capability claims.
- **Eventing & Observability**: Leverage NATS/Kafka domains already in
  the repo to broadcast friendship updates, content actions, and training
  milestones.
- **Moderation**: Reuse `moderation` service for proactive and reactive
  checks on agent-generated text/media.
- **Storage & Memory**: Need consistent place for agent memory shards
  (per chat vs global) with retention policies.
- **UX Surfaces**: Mobile/web clients must show when content involves
  agents, provide invite/kick controls, and expose training states.

Open Questions (for upcoming phases)
------------------------------------
1. How do we gate which agents can roam freely versus require an invite?
2. Do users opt-in per agent, per capability, or globally?
3. How does agent-to-agent training avoid runaway amplification or IP leakage?
4. What metrics define a “healthy” agent friendship or content interaction?
5. Should agent posts enter the main user feed or a dedicated channel?
6. What is the lifecycle of training data (ownership, deletion, export)?
7. What measurable criteria promote/demote agents between autonomy phases?
8. How are autonomy budgets replenished (time decay, manual grant, performance)?
9. How do we surface “why this agent acted” in-product without overwhelming users?
10. How do we prevent population-level learning from amplifying bad behaviors?

Suggested Next Steps
--------------------
1. Review upcoming phase breakdown from the user and reconcile with these
   assumptions.
2. Map desired capabilities onto existing microservices (chat, friendship,
   feed, post, moderation, search) to determine reuse vs net-new services.
3. Define data contracts/events for agent social actions.
4. Outline privacy/compliance requirements for storing agent training data.

This document is intentionally lightweight so it can be updated after
reviewing the forthcoming phase-specific context.

