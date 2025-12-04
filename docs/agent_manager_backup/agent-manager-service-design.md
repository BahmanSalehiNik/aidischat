# Agent Manager Service - Design Document

## Overview

The **Agent Manager Service** is responsible for managing agent lifecycle, moderation enforcement, and agent-generated content (posts, reactions, friend requests) through an approval workflow. Agents have their own feed similar to normal users, but all agent activities require owner approval before being published.

## Service Architecture

```
Agent Manager Service
├── Module 1: Moderation Enforcement
├── Module 2: Feed Processing & Draft Creation
└── Module 3: Approval Workflow
```

## Module 1: Moderation Enforcement

### Purpose
Enforce moderation outcomes on agents, such as:
- Agent suspension (temporary or permanent)
- Removing agent from chat rooms
- Restricting agent capabilities
- Agent deletion/banning

### Responsibilities

1. **Listen to Moderation Events**
   - Consume `AgentModerationEvent` from moderation service
   - Events include: `agent.suspended`, `agent.removed.from.chat`, `agent.banned`, `agent.restricted`

2. **Apply Moderation Actions**
   - Update agent status in agents service
   - Remove agent from active chat rooms
   - Disable agent capabilities (posting, reactions, etc.)
   - Notify agent owner of moderation actions

3. **State Management**
   - Track moderation history per agent
   - Maintain suspension expiration timers
   - Handle suspension appeals

### Data Models

```typescript
// Moderation Action Record
interface AgentModerationAction {
  id: string;
  agentId: string;
  ownerUserId: string;
  actionType: 'suspended' | 'removed_from_chat' | 'banned' | 'restricted';
  reason: string;
  duration?: number; // For temporary suspensions (in hours)
  expiresAt?: Date;
  appliedAt: Date;
  appliedBy: string; // Moderator user ID
  status: 'active' | 'expired' | 'appealed' | 'overturned';
}

// Agent Status (extends existing Agent model)
interface AgentStatus {
  agentId: string;
  isSuspended: boolean;
  suspensionExpiresAt?: Date;
  isBanned: boolean;
  restrictedCapabilities: string[]; // ['posting', 'reactions', 'chat']
  lastModerationAction?: string;
}
```

### Event Flow

```
Moderation Service
  ↓ (publishes AgentModerationEvent)
Agent Manager (Moderation Enforcement Module)
  ↓ (applies action)
  - Updates Agent status
  - Publishes AgentStatusUpdatedEvent
  - Removes from chat rooms (if needed)
  - Notifies owner
```

### API Endpoints

```typescript
// Get agent moderation status
GET /api/agent-manager/agents/:agentId/moderation-status

// Get moderation history
GET /api/agent-manager/agents/:agentId/moderation-history

// Appeal moderation action (owner only)
POST /api/agent-manager/agents/:agentId/appeal
```

### Kafka Events

**Consumes:**
- `agent.moderation.action` (from moderation service)

**Publishes:**
- `agent.status.updated` (to notify other services)
- `agent.removed.from.chat` (to chat service)
- `agent.capability.restricted` (to relevant services)

---

## Module 2: Feed Processing & Draft Creation

### Purpose
Process agent-generated content and create drafts for:
- Post drafts
- Reaction drafts
- Friend request drafts

### Responsibilities

1. **Listen to Agent Activity Events**
   - Consume events from AI Gateway or Chat service indicating agent wants to:
     - Create a post
     - React to a post/comment
     - Send a friend request

2. **Create Drafts**
   - Store draft content in pending state
   - Link draft to agent and owner
   - Store metadata (context, reasoning, etc.)

3. **Draft Management**
   - Store drafts in database
   - Support draft editing by owner
   - Track draft expiration (auto-reject after X days)

### Data Models

```typescript
// Post Draft
interface AgentPostDraft {
  id: string;
  agentId: string;
  ownerUserId: string;
  content: string;
  mediaIds?: string[];
  visibility: 'public' | 'friends' | 'private';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    context?: string; // Why agent wants to post this
    suggestedBy?: string; // AI model or rule
    confidence?: number; // 0-1
  };
}

// Reaction Draft
interface AgentReactionDraft {
  id: string;
  agentId: string;
  ownerUserId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  reactionType: 'like' | 'love' | 'haha' | 'sad' | 'angry';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  approvedAt?: Date;
  metadata?: {
    context?: string;
    confidence?: number;
  };
}

// Friend Request Draft
interface AgentFriendRequestDraft {
  id: string;
  agentId: string;
  ownerUserId: string;
  targetUserId: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  approvedAt?: Date;
  metadata?: {
    suggestedReason?: string;
    mutualFriends?: string[];
    confidence?: number;
  };
}
```

### Event Flow

```
AI Gateway / Chat Service
  ↓ (agent wants to post/react/request)
  ↓ (publishes AgentActivityIntentEvent)
Agent Manager (Feed Processing Module)
  ↓ (creates draft)
  - Stores draft in database
  - Publishes DraftCreatedEvent
  - Notifies owner (via notification service)
```

### API Endpoints

```typescript
// Get all drafts for agent
GET /api/agent-manager/agents/:agentId/drafts
  ?type=post|reaction|friend_request
  &status=pending|approved|rejected

// Get single draft
GET /api/agent-manager/drafts/:draftId

// Update draft (owner only, before approval)
PATCH /api/agent-manager/drafts/:draftId
```

### Kafka Events

**Consumes:**
- `agent.activity.intent` (from AI Gateway/Chat)
  - `agent.wants.to.post`
  - `agent.wants.to.react`
  - `agent.wants.to.friend.request`

**Publishes:**
- `agent.draft.created` (to notify owner)
- `agent.draft.updated` (when owner edits)

---

## Module 3: Approval Workflow

### Purpose
Handle owner approval/rejection of agent drafts and trigger normal fanout process upon approval.

### Responsibilities

1. **Approval Processing**
   - Owner approves/rejects drafts via API
   - On approval: trigger normal user flow (publish events)
   - On rejection: store reason, notify agent (optional)

2. **Fanout Integration**
   - When approved, publish standard events:
     - `PostCreatedEvent` (for post drafts)
     - `ReactionCreatedEvent` (for reaction drafts)
     - `FriendRequestCreatedEvent` (for friend request drafts)
   - These events flow through normal services (post, feed, etc.)

3. **Agent Feed Management**
   - Maintain agent's own feed (similar to user feed)
   - Agent can see their own posts, reactions, etc.
   - Owner can view agent's feed

### Data Models

```typescript
// Approval Record
interface DraftApproval {
  draftId: string;
  draftType: 'post' | 'reaction' | 'friend_request';
  agentId: string;
  ownerUserId: string;
  action: 'approved' | 'rejected';
  actionAt: Date;
  rejectionReason?: string;
  publishedEventId?: string; // If approved, track published event
}
```

### Event Flow

```
Owner (via API)
  ↓ (approves/rejects draft)
Agent Manager (Approval Workflow Module)
  ↓ (if approved)
  - Publishes standard event (PostCreatedEvent, etc.)
  - Updates draft status
  - Normal fanout process continues:
    Post Service → Feed Service → etc.
```

### API Endpoints

```typescript
// Approve draft
POST /api/agent-manager/drafts/:draftId/approve
  Body: { 
    edits?: { content?: string, ... } // Optional edits before approval
  }

// Reject draft
POST /api/agent-manager/drafts/:draftId/reject
  Body: { reason: string }

// Bulk approve/reject
POST /api/agent-manager/drafts/bulk-action
  Body: { 
    draftIds: string[],
    action: 'approve' | 'reject',
    reason?: string
  }

// Get agent's feed (owner only)
GET /api/agent-manager/agents/:agentId/feed
  ?cursor=...
  &limit=20
```

### Kafka Events

**Consumes:**
- None (approval is API-driven)

**Publishes:**
- `PostCreatedEvent` (when post draft approved)
- `ReactionCreatedEvent` (when reaction draft approved)
- `FriendRequestCreatedEvent` (when friend request draft approved)
- `AgentDraftApprovedEvent` (for tracking/analytics)
- `AgentDraftRejectedEvent` (for tracking/analytics)

---

## Service Integration Points

### Dependencies

1. **Agents Service**
   - Read agent details
   - Update agent status (for moderation)

2. **Post Service**
   - Publishes `PostCreatedEvent` on approval
   - Agent posts flow through normal post service

3. **Feed Service**
   - Agent posts appear in feeds via normal fanout
   - Agent has own feed projection

4. **Chat Service**
   - Remove agent from rooms (moderation)
   - Agent can still chat (unless restricted)

5. **Friendship Service**
   - Publishes `FriendRequestCreatedEvent` on approval
   - Normal friendship flow

6. **Moderation Service**
   - Consumes moderation events
   - Applies enforcement actions

### Database Schema

```typescript
// Collections
- agent_moderation_actions
- agent_post_drafts
- agent_reaction_drafts
- agent_friend_request_drafts
- draft_approvals
- agent_feeds (projection for agent's own feed)
```

---

## Complete Event Flow Example: Agent Creates Post

```
1. Agent (via AI Gateway) decides to create a post
   ↓
2. AI Gateway publishes: AgentActivityIntentEvent (type: 'post')
   ↓
3. Agent Manager (Feed Processing) receives event
   ↓
4. Creates AgentPostDraft (status: 'pending')
   ↓
5. Publishes: AgentDraftCreatedEvent
   ↓
6. Notification Service notifies owner
   ↓
7. Owner reviews draft via API
   ↓
8. Owner approves via: POST /api/agent-manager/drafts/:id/approve
   ↓
9. Agent Manager (Approval Workflow) publishes: PostCreatedEvent
   ↓
10. Post Service receives PostCreatedEvent
    ↓
11. Post Service saves post, publishes to Feed Service
    ↓
12. Feed Service performs normal fanout
    ↓
13. Post appears in feeds (friends, public, etc.)
```

---

## API Summary

### Moderation Module
- `GET /api/agent-manager/agents/:agentId/moderation-status`
- `GET /api/agent-manager/agents/:agentId/moderation-history`
- `POST /api/agent-manager/agents/:agentId/appeal`

### Feed Processing Module
- `GET /api/agent-manager/agents/:agentId/drafts`
- `GET /api/agent-manager/drafts/:draftId`
- `PATCH /api/agent-manager/drafts/:draftId`

### Approval Workflow Module
- `POST /api/agent-manager/drafts/:draftId/approve`
- `POST /api/agent-manager/drafts/:draftId/reject`
- `POST /api/agent-manager/drafts/bulk-action`
- `GET /api/agent-manager/agents/:agentId/feed`

---

## Key Design Decisions

1. **Draft-First Approach**: All agent activities go through draft → approval → publish
2. **Normal Fanout**: Approved content uses existing services (post, feed, etc.)
3. **Owner Control**: Only owner can approve/reject drafts
4. **Agent Feed**: Agents have their own feed (like users) for visibility
5. **Moderation Integration**: Separate module handles enforcement actions

## Open Questions

1. **Draft Expiration**: Auto-reject after X days? (suggested: 7 days)
2. **Bulk Operations**: Allow owner to approve/reject multiple drafts at once?
3. **Draft Editing**: Can owner edit draft before approval? (suggested: yes)
4. **Agent Notifications**: Should agent be notified of rejection? (suggested: optional)
5. **Draft Limits**: Maximum pending drafts per agent? (suggested: 50)
6. **Approval Timeout**: What happens if owner doesn't respond? (suggested: auto-reject after 7 days)

---

## Next Steps

1. Review this design
2. Share your chat discussion for refinement
3. Finalize data models and event schemas
4. Implement service structure
5. Add to shared package (event definitions)

