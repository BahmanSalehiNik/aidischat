# Monitoring + Capping User Cost (AI + Cloud) — Investigation

## Scope (current)

This doc focuses on **cost monitoring + caps per user**, including **AI usage by the user and their agents**, with **subscription tiers** having different caps.

**Out of scope for now (removed):**
- AR
- 3D models
- TTS
- speech-to-text

(We can keep the mechanisms generic so these can be re-enabled later without redesigning the billing system.)

---

## Why this matters (what can go wrong)

- **Runaway spend**: agents running in background, auto-replies, feed scans, retries, and parallelism can create unbounded provider calls.
- **Cross-service blind spots**: without a unified ledger, costs spread across `aiGateway`, `agent-manager`, `chat`, `media`, storage, etc. become hard to attribute per user.
- **Caps that don’t enforce**: “soft limits” without gatekeeping at the right boundaries lead to surprises and “bill shock”.
- **Fraud/abuse**: automated prompting loops, prompt injection causing tool abuse, high fanout to many agents, repeated retries.

---

## What we already have in this repo (useful hooks)

### Existing attribution fields in events

You already pass the right identifiers through the event flow:
- `AiMessageCreatedEvent`: each AI receiver has `{ agentId, ownerUserId }` (AI Gateway can attribute cost to `ownerUserId`).
- `AgentFeedScannedEvent`: includes `{ agentId, ownerUserId, scanId, feedEntryIds, ... }` (feed scans can be attributed to owner).

### Providers already return token usage

`aiGateway` providers return `usage` with prompt/completion/total tokens:
- OpenAI Chat Completions: `completion.usage.*`
- OpenAI Assistants: `runStatus.usage.*` (when available)
- Anthropic: `message.usage.input_tokens/output_tokens`
- Cohere: `response.meta.tokens.*`
- Local OpenAI-compatible: `response.data.usage.*`

### A precedent for “cap-aware behavior”

`agent-manager` already gates whether AI Gateway should generate comment drafts during feed scans by adding `createComment: false` into the forwarded `AgentFeedScannedEvent`.

This is an important pattern: **feature-level gating** (e.g., “skip expensive action”) can be driven by budget/cap state.

---

## Main cost drivers (AI apps + “big apps” reality)

### AI cost drivers (usually #1)

- **Tokens** (prompt + completion): primary driver for LLM APIs.
- **Model choice**: higher-tier models can be 10×–50× more expensive per token.
- **Context length growth**: thread history, system prompts, tool schemas, long user messages.
- **Background agents**: autonomous runs, feed scans, auto-drafting, scheduled actions.
- **Retries / timeouts**: failed calls that are retried can double/triple spend.
- **Streaming**: typically same token cost, but can increase compute/network and complicate partial-charge semantics.
- **Multimodal** (images): increases request size and sometimes tokenized “vision” cost; also triggers downstream media fetch/egress.

### Cloud cost drivers (can become #1 at scale)

Even if AI is dominant early, large apps learn to monitor these too:
- **Media storage** (blobs), and especially **egress** (downloads to clients, signed URLs, CDN misses).
- **Compute** (K8s CPU/memory), plus autoscaling inefficiencies.
- **Database** (Mongo/Redis) IOPS, storage growth, hot indexes, read amplification.
- **Messaging** (Kafka/NATS) throughput, retention, partitions, consumer lag → bigger clusters.
- **Network**: cross-zone/region traffic, service-to-service chatty calls, large payloads (feed batches, images).
- **Third-party APIs** (image import/search, moderation, email/SMS, push notifications).

---

## The key design principle: one usage ledger, multiple caps

“Big apps” typically separate:

- **Metering**: collect usage events (tokens, calls, bytes, seconds).
- **Rating**: convert usage → cost (in cents) using a pricebook.
- **Billing**: invoices, payment, proration (optional at first).
- **Quotas/caps**: enforce real-time limits by tier / user / agent / feature.

In practice: implement a **Usage Ledger** first; billing can come later.

---

## Recommended architecture in this repo

### 1) Usage events (produced by services doing work)

Emit an internal event each time a cost-relevant action happens, with a stable schema and idempotency key.

**Where to emit:**
- **AI calls**: `aiGateway` right after provider returns (has token usage, provider, model).
- **Background agent actions**: `agent-manager` for scheduled work (feed scans, auto-drafts), especially if it triggers downstream services.
- **Media**: when importing external images into storage and when serving downloads (if you control the serving path).
- **API Gateway** (optional): to meter “requests” as a unit for abuse protection.

**Suggested event name(s):**
- `usage.event.recorded` (generic)
- or split by domain: `usage.ai.recorded`, `usage.media.recorded`, `usage.db.recorded` (usually overkill early).

**Minimal fields (must-have):**
- `idempotencyKey` (string) — to prevent double-charging on retries
- `timestamp`
- `ownerUserId` (the user who pays)
- `agentId?` (the actor/consumer)
- `feature` (chat_reply, feed_scan, draft_revision, etc.)
- `provider` + `model` (for AI)
- `usage` (tokens, bytes, seconds) + `unit` + `quantity`
- `metadata` (roomId, messageId, scanId, region, etc.)

### 2) Usage ledger service (single source of truth)

Create a small service (or module) that:
- **stores raw usage events** (append-only)
- **dedupes via idempotencyKey**
- **aggregates** by (userId, period, feature, provider, model)
- **computes “remaining budget”** for caps
- exposes a **low-latency quota check** API (or cache) for gatekeeping

This could live under `backEnd/ai/aiBilling/` (currently empty) as a proper service.

### 3) Enforcement points (where caps actually prevent spend)

To cap real spend, enforcement must happen **before** expensive work:

- **AI Gateway**: *pre-call* quota check + “reservation” of worst-case tokens
  - works for both user-triggered and agent-triggered calls
- **Agent-manager**: degrade behavior when near cap (already does `createComment=false` for part of the feed flow)
- **API Gateway**: rate-limit abusive patterns independent of spend (RPM, concurrency)

**Rule of thumb:** enforce caps at the boundary closest to the external cost.

---

## Quota model: how to cap “user + agents” cleanly

### What to cap

You generally need *two* types of caps:

1) **Spend-like caps** (recommended): “$ / month” or “credits / month”
- maps to LLM provider invoices most directly
- handles mixed models/providers

2) **Technical caps** (secondary): RPM/TPM, concurrency, maxTokens per request
- protects reliability and prevents abuse

### Who owns the budget

Define budgets at multiple scopes:
- **User budget** (primary): all the user’s activity + all their agents draw from the same pool.
- **Agent sub-budgets** (optional): per-agent “allowance” to prevent a single agent from draining the user pool.
- **Feature budgets** (optional): e.g., feed scans vs chat replies.

### Periods

Most common:
- **Monthly** budgets (subscription aligned)
- plus **daily** guardrails (prevents burning the month in a day)

---

## Subscription tiers: practical cap patterns

You asked for different subscription levels with different caps. Typical patterns:

### Tier primitives

- **Included monthly credits**: e.g., 10, 50, 200 “credits”
- **Hard cap** at 100%: requests are blocked or degraded
- **Soft cap** at 80–90%: warn user, degrade expensive features
- **Overage** (optional): allow going above cap with explicit opt-in and a payment method

### Feature degradation ladder (best UX)

Instead of “everything stops”, big apps degrade:

- **Near cap**:
  - reduce `maxTokens`
  - force cheaper model (if allowed)
  - disable background actions (feed scans, auto drafts)
  - lower concurrency (queue instead of parallel)
- **At hard cap**:
  - block AI calls with a clear error and upgrade CTA
  - allow “essential” operations (non-AI features) normally

This matches the existing `createComment=false` pattern: it’s a **cap-driven feature switch**.

---

## Real-time quota enforcement (the “reservation” approach)

### Why reservations are needed

If you only charge **after** an LLM call completes, you can exceed caps because:
- multiple requests can run concurrently
- retries can duplicate spend
- background agents can overlap with user-triggered calls

The common pattern is:
- **pre-authorize** (reserve) a worst-case amount
- **settle** with actual usage after completion
- **release** unused reservation

This is how you get a real hard cap even with concurrency and Kafka retries.

### Reservation flow (AI calls)

For each provider call, do:

1) **Estimate worst-case usage**
- `estimatedPromptTokens`: tokenize message + system prompt + tool schemas (best-effort)
- `estimatedCompletionTokens`: use `maxTokens` (because the model can use up to that)
- `estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens`
- Convert to **estimatedCents** using a **pricebook** (provider+model pricing)

2) **Check quota + reserve**
- If user is below cap: reserve `estimatedCents` and proceed.
- If near cap: return “degrade” decision (cheaper model / lower maxTokens / disable background actions).
- If at cap: deny before the external call.

3) **Call provider**

4) **Settle**
- Read actual tokens from provider response (`usage.totalTokens`, etc.)
- Convert to **actualCents** using the same pricebook version
- Record final usage event, mark reservation as “settled”
- Release unused amount (reservation - actual)

5) **Idempotency**
- Use `idempotencyKey` per “billable action” so retries don’t double-charge.

### What’s a good idempotency key?

Make it stable per billable action:
- **Chat AI reply**: `ai:chat_reply:${originalMessageId}:${agentId}`
- **Reply-to-agent flow**: `ai:reply_to:${replyMessageId}:${agentId}`
- **Feed scan**: `ai:feed_scan:${scanId}:${agentId}`
- **Draft revision**: `ai:draft_revision:${draftId}:${agentId}:${revisionRequestId?}`

### What about OpenAI Assistants threads (context is server-side)?

Assistants API usage includes server-side thread context, so prompt tokens are harder to pre-estimate.

Practical approach:
- Reserve based on **policy bound** (e.g., `maxTokens` + safety buffer).
- Keep `maxTokens` conservative per tier.
- Settle using `runStatus.usage` when available.

### What about streaming?

Streaming requires:
- reservation upfront
- settle at end
- if stream aborts: settle with partial tokens if provider returns them; otherwise settle to reserved minus a safe refund policy.

---

## Rating: convert usage into “cost”

### Pricebook

Maintain a pricebook table/version that maps:
- `provider` (openai/anthropic/cohere/local/custom)
- `model`
- `unit` (input_token, output_token)
- `pricePerUnit` (e.g., cents per 1K tokens)
- `effectiveFrom`

Important:
- **Store the pricebook version** used for every settlement.
- Provider prices change; you need historical correctness.

### Credits vs dollars

Most apps expose “credits” in UX but internally store:
- **cents** (or micros) for finance accuracy
- optionally a “credits” translation layer per tier

Recommendation:
- Store in **micros** (1/1,000,000 of currency unit) or **cents**.
- Expose “credits” = cents / conversionFactor for UX simplicity.

---

## Data model (suggested) for the ledger + quotas

This is intentionally simple and Mongo-friendly (consistent with the repo’s usage of Mongo).

### Collections (minimum)

1) `usage_events` (append-only)
- `_id`
- `idempotencyKey` (unique index)
- `ownerUserId`
- `agentId?`
- `feature`
- `provider?`, `model?`
- `usage`: `{ promptTokens?, completionTokens?, totalTokens?, bytes?, seconds? }`
- `rated`: `{ currency: 'USD', pricebookVersion, amountCents }`
- `metadata`: `{ messageId?, roomId?, scanId?, draftId?, service, env }`
- `timestamp`

2) `usage_reservations` (short-lived but persisted)
- `_id`
- `idempotencyKey` (unique index)
- `ownerUserId`
- `feature`
- `reservedCents`
- `status`: `reserved|settled|cancelled`
- `expiresAt` (TTL index)
- `createdAt`, `settledAt?`

3) `user_subscriptions`
- `ownerUserId`
- `tier`: `free|starter|pro|enterprise`
- `period`: monthly boundaries
- `monthlyCapCents`
- `dailyGuardrailCents?`
- `allowOverage` (bool)
- `status`

4) `usage_aggregates` (optional but very useful)
- `(ownerUserId, period)` summary docs
- precomputed totals: `spentCents`, `reservedCents`, `tokensByProviderModel`, etc.

### Indices (must-have)

- `usage_events.idempotencyKey` unique
- `usage_events.ownerUserId + timestamp`
- `usage_reservations.idempotencyKey` unique
- `usage_reservations.ownerUserId + status`
- `usage_reservations.expiresAt` TTL

---

## Quota decision policy (what to return to callers)

Your quota check should return a structured decision, not just allow/deny:

- `allow: boolean`
- `reason`: `ok|near_cap|hard_cap|rate_limited|invalid_tier|...`
- `degrade?`:
  - `maxTokensOverride?`
  - `forcedModel?`
  - `disableFeatures?: string[]` (e.g., `feed_comments`, `background_scans`)
  - `queueInsteadOfParallel?: boolean`
- `remainingCents`, `capCents`, `periodEnd`

This makes it easy for services like `agent-manager` to apply targeted degradation (like the existing `createComment=false`).

---

## Where to enforce in this repo (concrete mapping)

### AI Gateway (primary enforcement)

Enforce here because it is the boundary to external LLM providers.

Places to add quota calls later:
- Before `provider.generateResponse(...)` in:
  - `AiMessageCreatedListener` (chat replies)
  - `AgentReplyMessageCreatedListener` (reply-to-agent flow)
  - `AgentFeedScannedListener` (feed scan analysis)
  - draft revision flow (currently in `agent-feed-scanned-listener.ts`)

What to record:
- `ownerUserId` (already present in events / agent profile)
- `agentId`
- `feature` = one of: `chat_reply`, `reply_to_agent`, `feed_scan`, `draft_revision`
- provider/model + tokens from response

### Agent-manager (secondary enforcement / degradation)

Agent-manager is ideal for:
- turning off background features when user is near cap
- limiting “draft creation pressure” (already has max pending drafts, per-agent constraints)

Examples of cap-aware toggles:
- feed scans: set `createComment=false` when near cap (already done with a heuristic)
- reduce scan frequency per tier (scanInterval)
- pause agent presence/auto-actions when capped

### API Gateway / edge (abuse protection)

Even with spend caps, you still want:
- RPM / concurrency limits per user
- payload size limits (to avoid giant prompts)
- auth-based tiers and request shaping

---

## Monitoring: what to measure and how (without exploding cardinality)

### Two layers of monitoring

1) **Service-level metrics** (Prometheus/OpenTelemetry metrics)
- Don’t label by `userId` (too high-cardinality).
- Use labels like `provider`, `model`, `feature`, `status`.

2) **Per-user analytics** (ledger queries / OLAP)
- Store per-user usage in the ledger and query for dashboards.
- If volume grows: export to an OLAP store (ClickHouse/BigQuery/Snowflake).

### Recommended metrics (service-level)

AI Gateway:
- `ai_requests_total{provider,model,feature,status}`
- `ai_tokens_total{provider,model,feature,type=input|output}`
- `ai_cost_estimated_cents_total{provider,model,feature}`
- `ai_cost_actual_cents_total{provider,model,feature}`
- `ai_latency_ms_bucket{provider,model,feature}`
- `ai_quota_denied_total{feature,reason}`
- `ai_quota_degraded_total{feature,degrade_type}`

Agent-manager:
- `drafts_created_total{type=post|comment|reaction,source}`
- `drafts_rejected_total{reason}`
- `feed_scans_total{status}`

### Alerting (practical)

- **Global**: provider spend spikes vs baseline (per hour/day)
- **Tier**: sudden cap-hit increases (indicates UX or abuse)
- **Provider errors**: retries rising (double-spend risk)
- **Near-cap notifications**: batch notification jobs to avoid spam

---

## Monitoring future cloud costs per user (practical attribution)

Cloud bills don’t naturally break down per end-user unless you build attribution.

You can approach this in layers:

### Layer 1: Direct attribution (easy + accurate)

Where the request already knows the user:
- **Media storage/import**: record bytes stored per `ownerUserId`, plus downloads if served through your service.
- **Third-party APIs**: record calls per `ownerUserId` (image search/import, etc.).

This gives high-signal per-user cloud costs quickly.

### Layer 2: Proxy allocation (approximate but useful)

For shared infrastructure (Kafka, Mongo, K8s compute), allocate cost by proportional usage:
- **Compute**: allocate service cost by request count or CPU-time (if you instrument it)
- **DB**: allocate by read/write ops per user if you log query ownership at the app layer (sampling is fine)
- **Kafka**: allocate by produced bytes/events per user when producing messages with `ownerUserId` in payload

This is how many large apps do “unit economics” before perfect cost attribution exists.

### Layer 3: FinOps integration (later)

If you move to a mature FinOps setup:
- ensure workloads are tagged (env/service/team)
- export billing data daily
- combine with your ledger to produce “fully loaded cost per user”

---

## Guardrails that reduce cost without harming UX

These tend to have very high ROI:

- **Prompt size limits**: cap input length per tier; truncate/summary older context.
- **MaxTokens per feature**: feed scan analysis can use smaller completions; draft revision even smaller.
- **Cheaper model fallback**: allow downgrade near cap for non-critical actions.
- **Disable background actions by default** on free tier.
- **Queue instead of parallel** when near cap (reduces concurrency bursts).
- **Retry budgets**: limit retries per idempotencyKey; don’t retry non-retryable errors.
- **Circuit breakers**: stop calling provider when error rates spike (prevents spend + latency cascade).

---

## Suggested phased rollout (so this doesn’t stall product)

### Phase A — Visibility (1–2 days)

- Emit a `usage.ai.recorded` event from `aiGateway` after each provider call.
- Persist to `usage_events`.
- Add a basic admin/user report: tokens + estimated cost by day.

### Phase B — Soft caps + degradation (2–4 days)

- Implement quota “check only” API returning near-cap decisions.
- Apply degradation in:
  - `agent-manager` (pause background, keep user-triggered chat)
  - `aiGateway` (lower maxTokens / cheaper model)

### Phase C — Hard caps with reservations (4–10 days)

- Add reservations and settlement (idempotent).
- Enforce hard cap *before* provider calls in `aiGateway`.

### Phase D — Cloud attribution (ongoing)

- Add usage events for media import + storage bytes + egress (where measurable).
- Build “fully loaded per user” approximation by allocating shared costs.

---

## Open questions (decisions you’ll need soon)

- **Cap unit**: expose credits or dollars in UX? (Recommendation: “credits”, internally cents.)
- **Overage**: allow pay-as-you-go beyond cap or strictly deny?
- **Tier policy**: do paid tiers get cheaper models by default? can users override?
- **Agent allowances**: per-agent sub-budgets or just a shared user pool initially?
- **Data retention**: how long to keep raw usage events (90 days vs 1 year)?


