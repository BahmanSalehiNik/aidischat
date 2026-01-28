# AI Comment Drafts Throttling (Design)

## Goal

Enable AI agents to **suggest comment drafts** in a controlled way during feed scanning, without overwhelming a post’s discussion.

**Primary constraint:**

- For any post \(P\), the number of **AI-authored comments** on \(P\) must not exceed:
  \[
  \text{humanComments}(P) + 3
  \]

Where **humanComments(P)** counts comments authored by **non-agent users**.

**Per-agent constraint (fairness / diversity):**

- If the cap is not reached, **each agent may create at most 1 comment draft per post**.
- Any remaining budget is intentionally left for other agents (now or in future scans).

**Eligibility constraint:**

- An agent may only create a comment draft for a post if the post is **unseen** for that agent at scan time (i.e., included in that agent’s `agent.feed.scanned` payload).

## Non-goals

- No synchronous HTTP calls between services during the scan/draft pipeline.
- No attempt to retroactively “fix” existing over-limit posts in historical data (handled separately if needed).

## Existing Building Blocks (Already in Repo)

- **Feed scan pipeline** (event-driven): `agent.feed.scanned` → `agent.feed.answer.received` → `agent.draft.*.created`
  - See: `docs/agent-feed-scanning-architecture.md`
- **Comment drafts already exist**
  - `AgentDraftCommentCreatedEvent`: `agent.draft.comment.created`
  - `AgentDraftCommentApprovedEvent`: `agent.draft.comment.approved`
  - Agent Manager already creates comment drafts from `agent.feed.answer.received` in:
    - `backEnd/agent-manager/src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts`

## Key Problem

Today the system can’t reliably enforce “humanComments + 3” because the Feed Service only tracks a single `commentsCount` in the Post projection, not a **human vs AI** breakdown.

## Proposed Approach (Event-Driven, No Direct Calls)

### 1) Emit “author type” on comment events

Extend comment events to include an author-type flag:

- **Add** `authorIsAgent?: boolean` to `CommentCreatedEvent` (and ideally to `CommentDeletedEvent` as well for decrement correctness).
  - Source of truth: User projection in Comment/Post service (same pattern used for posts).
  - Backward compatible: field is optional; consumers treat missing as `false` (human).

### 2) Feed Service maintains per-post comment counts by author type

In Feed Service Post projection (`feed.posts`), maintain:

- `humanCommentsCount` (default 0)
- `aiCommentsCount` (default 0)
- Keep existing `commentsCount` as total for UI/backwards compatibility.

Update Feed Service comment listeners:

- On `comment.created`:
  - `commentsCount++`
  - if `authorIsAgent` then `aiCommentsCount++` else `humanCommentsCount++`
- On `comment.deleted`:
  - `commentsCount--` (floor at 0)
  - decrement the correct bucket using `authorIsAgent` (if missing, decrement human)

### 3) Include counts in feed scan payload

Extend the scan payload (Feed Service → Agent Manager → AI Gateway) to include:

- `humanCommentsCount`
- `aiCommentsCount`
- Optionally: a computed `remainingAiCommentsAllowed = max(0, humanCommentsCount + 3 - aiCommentsCount)`

This is still “no direct calls” because it’s derived from Feed Service’s local projections.

### 4) AI Gateway: make the model aware (soft constraint)

Update the feed-analysis prompt to include the per-post remaining budget and instruct the model:

- Only suggest comments for a post if `remainingAiCommentsAllowed > 0`
- Suggest **at most 1** comment per post (per agent), even if remaining budget is higher

**Important:** This is only guidance. Final enforcement is in Agent Manager.

### 5) Agent Manager: enforce hard constraint when creating drafts

When Agent Manager consumes `agent.feed.answer.received`:

For each target post \(P\):

1. Read `humanCommentsCount` and `aiCommentsCount` from the scan payload.
2. Compute:
   \[
   \text{maxAiAllowed}(P) = \text{humanCommentsCount}(P) + 3
   \]
3. Compute “current AI load”:
   - `aiCommentsCount` from Feed projection (published AI comments)
   - plus **pending AI comment drafts** for that post (stored in Agent Manager DB)
4. Remaining capacity:
   \[
   \text{remaining}(P) = \max(0, \text{maxAiAllowed}(P) - \text{aiPublished}(P) - \text{aiDraftsPending}(P))
   \]
5. **Unseen rule:** only consider posts that are present in the scan payload (those were **unseen** for this agent at scan time).
6. **Per-agent rule:** if `remaining(P) > 0`, create **at most 1** comment draft for that post for this agent; otherwise create 0.

This guarantees that even if the model returns too many suggestions, we still respect the cap.

## End-to-End Flow (No Direct Calls)

```
┌───────────────────────────────────────────────────────────────┐
│ Comment/Post Service                                           │
│ - Publishes comment.created with authorIsAgent                 │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ Feed Service                                                   │
│ - Updates Post projection: humanCommentsCount / aiCommentsCount │
│ - Agent Feed Scanner reads unseen Feed entries + Post projection│
│ - Publishes agent.feed.scanned                                 │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ Agent Manager                                                  │
│ - Signs media URLs, republishes agent.feed.scanned              │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ AI Gateway                                                     │
│ - Generates suggestions (posts/comments/reactions)              │
│ - Publishes agent.feed.answer.received                          │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ Agent Manager                                                  │
│ - Enforces per-post AI comment cap (human + 3)                  │
│ - Creates AgentDraftComment records                             │
│ - Publishes agent.draft.comment.created                         │
└───────────────────────────────────────────────────────────────┘
                    ↓
┌───────────────────────────────────────────────────────────────┐
│ Owner approves in UI → Agent Manager publishes                  │
│ agent.draft.comment.approved → Comment creation listener        │
└───────────────────────────────────────────────────────────────┘
```

## Implementation Plan (Incremental)

### Phase 1 — Data availability (author type + projection counts)

- Add `authorIsAgent?: boolean` to shared `CommentCreatedEvent` (and `CommentDeletedEvent`).
- Set `authorIsAgent` in comment publisher (source: User projection `isAgent`).
- Extend Feed Service Post projection schema with `humanCommentsCount` / `aiCommentsCount`.
- Update Feed Service `CommentCreatedListener` / `CommentDeletedListener` to maintain these counts.

### Phase 2 — Enforcement (Agent Manager)

- Extend scan payload to carry `humanCommentsCount` / `aiCommentsCount`.
- In `AgentFeedAnswerReceivedListener`, enforce:
  - per-post remaining capacity = `human + 3 - aiPublished - aiDraftsPending`
  - **at most 1 comment draft per agent per post** when capacity > 0 and the post was unseen

### Phase 3 — UX + model guidance (Optional)

- Include “remaining comment budget” in the AI Gateway prompt to reduce wasted suggestions.
- Add telemetry counters:
  - `comment_drafts_dropped_due_to_cap`
  - `comment_drafts_created`

## Edge Cases / Notes

- **Missing authorIsAgent in events**: treat as human (`false`) for backward compatibility.
- **Spam protection**: this cap is post-local; we may also want an agent-global budget later (e.g., max drafts per scan).
- **Race conditions**: enforcement uses “published counts” from projections + “draft counts” in Agent Manager DB; this remains safe under retries because draft creation should be idempotent per `(agentId, scanId, postId, contentHash)` (recommended).

## UI/UX: Separate Draft Pages (Posts vs Comments)

### Current state (mobile app)

- Mobile already supports filtering drafts by type via query params:
  - `GET /agent-manager/agents/:agentId/drafts?type=post|comment|reaction`
  - Client wrapper: `agentManagerApi.getDrafts(agentId, { type })` in `client/mobile-app/utils/api.ts`
- Current screen `client/mobile-app/app/(main)/AgentDraftsScreen.tsx` is hard-coded to:
  - `getDrafts(agentId, { type: 'post' })`
  - and approve/reject as `type='post'`

### Desired UI design

Create a **separate Comment Drafts page** so post drafts and comment drafts are not mixed:

- **Agent Detail → Drafts**
  - Keep a single “Drafts” button, but on press open a **bottom sheet picker** so the user chooses which draft page to open.

#### Comment Drafts screen content (recommended)

- **Header**: “Comment Drafts”
- **List item** shows:
  - **Post context** (required): postId + a short preview (“Replying to…”) and/or navigate to the post detail screen
  - **Draft status** badge (pending/approved/rejected/expired)
  - **Draft text** (comment content)
- **Actions**:
  - Approve (calls `/drafts/:id/approve?type=comment`)
  - Reject (calls `/drafts/:id/reject?type=comment`)
  - Edit draft text before approve (optional; uses `/drafts/:id?type=comment`)

### App implementation options (pros/cons)

#### Chosen approach: Option A + bottom sheet (separate pages, no “hub” screen)

- When the user presses the **Drafts** button in `AgentDetailScreen`, open a bottom sheet with:
  - **Post Drafts**
  - **Comment Drafts**
  - (Optional later) **Reaction Drafts**
- Selecting an item navigates directly to the corresponding page:
  - `AgentDraftsScreen` → `getDrafts(agentId, { type: 'post' })`
  - `AgentCommentDraftsScreen` → `getDrafts(agentId, { type: 'comment' })`

Optional UX improvement:
- Remember the last selected draft type per agent/user and default to that next time; provide “Change” via the sheet.

**Pros**
- Separate pages (no mixing), clear mental model
- No extra intermediate “hub” navigation
- Minimal backend changes (already supported today via `?type=...`)

**Cons**
- Requires either a second screen or a shared DraftList component + route param
- Slightly more UI complexity (modal state)

#### Alternative: Option B — One Drafts screen with top tabs / segmented control

- Keep one route (e.g., `AgentDraftsScreen`) but add a UI switch:
  - Tabs: Posts | Comments | Reactions
- When switching, refetch with `type=<selected>`

**Pros**
- Single entry point, avoids multiple routes
- Easy to add reaction drafts later

**Cons**
- Still “one page”, but separated sections (user asked separate page; tabs might be acceptable)

#### Alternative: Option C — Client-side split (fetch all once, then filter locally)

- Call `getDrafts(agentId)` with no `type` filter
- Split into sections/pages locally

**Pros**
- Fewer network requests

**Cons**
- Larger payload, more memory, more polling work
- Harder to maintain correctness when counts grow

### Backend/API options

You already have the best option: **single endpoint with `type` filter**.

If you ever want stronger separation, you can add convenience endpoints:

- `/agent-manager/agents/:agentId/drafts/posts`
- `/agent-manager/agents/:agentId/drafts/comments`

But functionally it’s the same as `?type=...`.


