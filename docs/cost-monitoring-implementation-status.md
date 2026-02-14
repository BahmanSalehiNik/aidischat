# Cost Monitoring — Implementation Status

**Last updated:** 2026-02-13  
**Owner:** Engineering  
**Scope:** Phase 1 (Foundation)

---

## Phase 1 — Foundation

### What Phase 1 means (per docs)
- **Persist** per-call LLM usage (tokens) and **estimated cost**
- Add **tier limits** (start with Free hard caps)
- Ensure the system is **idempotent enough** to avoid obvious double-counting on retries

### Status

- **Schema / storage**
  - [x] Add Mongo/Mongoose collections for cost tracking in `aiGateway`
    - `TokenRate` (pricebook overrides)
    - `SubscriptionTier` / `UserSubscription` (tier config)
    - `LlmInteraction` (raw per-call ledger, idempotent via `idempotencyKey`)
    - `UserDailyUsage` (daily aggregates for quick cap checks)

- **Cost tracking middleware (LLM call wrapper)**
  - [x] Wrap LLM calls in `backEnd/ai/aiGateway` to record:
    - provider + model
    - prompt/completion/total tokens (when available)
    - estimated cost (USD micros)
    - duration + metadata
  - [x] Integrated in these LLM call sites:
    - `AiMessageCreatedListener` (chat replies)
    - `AgentReplyMessageCreatedListener` (reply-to-agent flow)
    - `AgentFeedScannedListener` (feed analysis)
    - `AgentDraftRevisionRequestListener` (draft revision)
    - `ARMessageRequestListener` (**non-stream fallback only**)

- **Basic tier limits (hard caps)**
  - [x] Add Free tier daily hard-cap checks (optional enforcement)
  - [ ] Add reservations/settlement for concurrency-safe hard caps (planned Phase 2/3)

---

## Configuration knobs (current)

- **Monitoring on/off**
  - `COST_MONITORING_ENABLED`
    - default: enabled (any value except `'false'`)

- **Enforcement on/off**
  - `COST_MONITORING_ENFORCE_LIMITS`
    - default: disabled
    - set to `'true'` to enforce Free-tier hard caps

- **Auto-seeding defaults**
  - `COST_MONITORING_AUTO_SEED`
    - when `'true'`, seeds default `TokenRate` and Free `SubscriptionTier` entries if missing

- **Default tier for users without a `UserSubscription`**
  - `DEFAULT_SUBSCRIPTION_TIER`
    - default: `'free'`

---

## Known limitations (expected in Phase 1)

- **Streaming token usage**: streaming provider paths generally don’t return token usage in this repo yet, so costs may be missing for true streaming responses (AR streaming path).
- **Hard caps under concurrency**: Phase 1 uses a simple “check current totals” method. Multiple concurrent requests can still overshoot until we implement reservations.
- **No user/admin dashboard yet**: Phase 1 focuses on capture + persistence; surfacing usage will be handled in later phases (Usage APIs + UI).
- **Pricing updates are manual**: Token pricing can change and varies by model/provider. Phase 1 relies on `TokenRate` entries in Mongo (plus a small baked-in fallback) and a manual seed script; later phases should add an admin UI + scheduled sync job.

---

## Next steps (recommended)

- Add minimal **Usage Query API** (e.g., `GET /api/usage/current`) in a service that already exposes HTTP (likely `api-gateway`).
- Add **reservation + settlement** flow to make hard caps concurrency-safe.
- Expand pricebook coverage to all models currently used in production.
- Add a periodic “pricing sync” job (or admin workflow) to insert new `TokenRate` rows when providers update pricing.
- Proceed to **Phase 2 (Monitoring & Alerts)**: expose usage APIs + basic alerting.

### Token pricing model (how rate changes are handled)

- `TokenRate` is **versioned by `effectiveDate`** (you can store multiple rows per `{provider, modelName}`).
- At runtime, cost calculation picks the latest rate where `effectiveDate <= interaction.startedAt`.
- Because each interaction stores `estimatedCostMicros`, totals naturally sum across rate/model changes (e.g., 230 tokens at old rate + 340 tokens at new rate).

---

## Phase 2 — Monitoring & Alerts (in progress)

### Status

- **Real-time aggregation**
  - [x] Add `UserMonthlyUsage` aggregate (month-to-date totals)
  - [x] Update `aiGateway` cost-tracking to increment both `UserDailyUsage` and `UserMonthlyUsage`

- **Usage APIs (HTTP)**
  - [x] Add HTTP server to `aiGateway` (port 3000, behind `api-gateway` route `/api/ai-gateway/*`)
  - [x] Add endpoints:
    - `GET /api/ai-gateway/usage/current`
    - `GET /api/ai-gateway/usage/history?days=30`
    - `GET /api/ai-gateway/usage/breakdown?from=<iso>&to=<iso>&limit=50`
    - `GET /api/ai-gateway/usage/forecast`

- **Alerts (foundation)**
  - [x] Add `CostAlert` collection (deduped per `{ownerUserId, day, metric, threshold}`)
  - [x] Add monitoring job (disabled by default)
  - [x] Add endpoint:
    - `GET /api/ai-gateway/alerts?days=7`

### New configuration (Phase 2)

- **JWT auth for aiGateway HTTP endpoints**
  - `JWT_DEV` (same secret as other services; required for authenticated endpoints)

- **Alert monitoring job**
  - `COST_MONITORING_ALERTS_ENABLED`
    - default: disabled
    - set to `'true'` to enable periodic threshold checks
  - `COST_MONITORING_ALERTS_INTERVAL_MS`
    - default: 900000 (15 minutes)



