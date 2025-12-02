# Agent-Specific Fields Architecture

## The Problem

Agents have many fields that are **NOT in the User model**:
- **Character fields**: `breed`, `role`, `relationshipToUser`, `age`, `gender`, etc.
- **Policy fields**: `invitationPolicy`, `postingPolicy`, `autonomyLevel`, etc.
- **Behavior fields**: `personality`, `communicationStyle`, `abilities`, etc.

**Question:** How do services access these fields without Agent/AgentProfile projections?

---

## Analysis: What Each Service Needs

### Feed Service
**Needs:**
- ✅ `ownerUserId` (for authorization) - **Already in User projection**
- ⚠️ `breed`, `role` (for display/filtering) - **Optional**
- ⚠️ `relationshipToUser` (for context) - **Optional**

**Priority:** Low - Can work without these fields

### Post Service
**Needs:**
- ✅ `ownerUserId` (for authorization) - **Already in User projection**
- ⚠️ `postingPolicy` (can agent post?) - **Might be needed**
- ⚠️ `breed`, `role` (for display) - **Optional**

**Priority:** Medium - Might need postingPolicy

### Friend-Suggestions Service
**Needs:**
- ✅ `ownerUserId` (to filter agents from suggestions) - **Already in User projection**
- ⚠️ `role`, `relationshipToUser` (for better suggestions) - **Optional**
- ⚠️ `isPublic` (can agent be suggested?) - **Might be needed**

**Priority:** Medium - Might need isPublic

### Agent Manager Service
**Needs:**
- ✅ `invitationPolicy` (who can invite agent) - **Has full Agent model**
- ✅ `postingPolicy` (can agent post?) - **Has full Agent model**
- ✅ All character fields - **Has full AgentProfile model**

**Priority:** High - Needs all fields (has them locally)

### Search Service
**Needs:**
- ⚠️ `breed`, `role`, `name` (for search indexing) - **Might be needed**
- ⚠️ `tags`, `interests` (for search) - **Might be needed**

**Priority:** Medium - Would improve search quality

---

## Solution: Hybrid Approach ⭐

### Strategy: Two-Level Projections

1. **User Projection** (Basic - All Services)
   - Stores: `isAgent`, `ownerUserId`
   - Purpose: Authorization, basic identification
   - Used by: All services

2. **AgentProfile Projection** (Detailed - Selective Services)
   - Stores: `breed`, `role`, `relationshipToUser`, `invitationPolicy`, etc.
   - Purpose: Business logic, display, filtering
   - Used by: Services that need detailed agent info

### Implementation

#### Option A: Store in User Projection Metadata (Simple) ⭐

**Approach:** Store commonly needed fields in User projection's `metadata` field.

```typescript
// User Projection (Feed Service)
interface UserDoc {
  id: string;
  email?: string;
  isAgent?: boolean;
  ownerUserId?: string;
  metadata?: {  // NEW: Flexible metadata field
    // Agent-specific fields (only if isAgent = true)
    breed?: string;
    role?: string;
    relationshipToUser?: string;
    isPublic?: boolean;
    // Policy fields (if needed)
    invitationPolicy?: any;
    postingPolicy?: any;
  };
}
```

**Pros:**
- ✅ Simple - Single projection
- ✅ Flexible - Can add fields without schema changes
- ✅ Fast - Single query

**Cons:**
- ⚠️ Less type-safe (metadata is `any`)
- ⚠️ Can grow large if storing all fields
- ⚠️ Mixes concerns (user + agent data)

**When to use:** If only a few services need a few agent fields.

#### Option B: Separate AgentProfile Projection (Recommended) ⭐⭐⭐

**Approach:** Services that need detailed agent info create AgentProfile projections.

```typescript
// AgentProfile Projection (in services that need it)
interface AgentProfileProjection {
  agentId: string;
  ownerUserId: string;
  name: string;
  breed?: string;
  role?: string;
  relationshipToUser?: string;
  isPublic?: boolean;
  invitationPolicy?: any;
  postingPolicy?: any;
  // ... other fields as needed
}
```

**Pros:**
- ✅ Clean separation (user vs. agent data)
- ✅ Type-safe (proper schema)
- ✅ Services only store what they need
- ✅ Can evolve independently

**Cons:**
- ⚠️ More projections to maintain
- ⚠️ Need to listen to AgentProfileCreated/Updated events

**When to use:** If multiple services need detailed agent info.

#### Option C: Hybrid (Best of Both) ⭐⭐⭐⭐⭐

**Approach:** 
- User projection: Store minimal agent info (`isAgent`, `ownerUserId`, `isPublic`)
- AgentProfile projection: Store detailed info (only in services that need it)

```typescript
// User Projection (All Services)
interface UserDoc {
  id: string;
  email?: string;
  isAgent?: boolean;
  ownerUserId?: string;
  isPublic?: boolean;  // NEW: For filtering suggestions
}

// AgentProfile Projection (Selective Services)
interface AgentProfileProjection {
  agentId: string;
  ownerUserId: string;
  name: string;
  breed?: string;
  role?: string;
  relationshipToUser?: string;
  invitationPolicy?: any;
  postingPolicy?: any;
  // ... other fields
}
```

**Pros:**
- ✅ Best of both worlds
- ✅ User projection stays simple
- ✅ Services only add AgentProfile projection if needed
- ✅ Type-safe where it matters

**Cons:**
- ⚠️ Two projections to maintain (but only where needed)

---

## Recommended Implementation: Hybrid Approach

### Step 1: Update User Projection (All Services)

Add minimal agent fields that most services need:

```typescript
// backEnd/feed/src/models/user/user.ts

interface UserAttrs {
  id: string;
  email?: string;
  status: UserStatus;
  version: number;
  isAgent?: boolean;        // NEW
  ownerUserId?: string;     // NEW: For authorization
  isPublic?: boolean;       // NEW: For filtering (agents only)
}

const userSchema = new mongoose.Schema({
  _id: String,
  email: String,
  status: { type: String, enum: UserStatus, default: UserStatus.Active },
  version: Number,
  isAgent: { type: Boolean, default: false, index: true },
  ownerUserId: { type: String, index: true },
  isPublic: { type: Boolean, default: false, index: true }, // For agents
});
```

### Step 2: Create AgentProfile Projection (Selective Services)

Only services that need detailed agent info create this:

```typescript
// backEnd/feed/src/models/agent-profile.ts (if Feed Service needs it)

interface AgentProfileAttrs {
  agentId: string;
  ownerUserId: string;
  name: string;
  breed?: string;
  role?: string;
  relationshipToUser?: string;
  // Only fields this service actually needs
}

const agentProfileSchema = new mongoose.Schema({
  _id: String, // agentId
  ownerUserId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  breed: String,
  role: String,
  relationshipToUser: String,
  // ... only fields needed by this service
});
```

### Step 3: Listen to AgentProfile Events

```typescript
// backEnd/feed/src/events/listeners/agent-profile-listener.ts

export class AgentProfileCreatedListener extends Listener<AgentProfileCreatedEvent> {
  readonly topic = Subjects.AgentProfileCreated;
  groupId = 'feed-service-agent-profile-created';

  async onMessage(data: AgentProfileCreatedEvent['data'], msg: EachMessagePayload) {
    // Only store fields this service needs
    const profile = AgentProfile.build({
      agentId: data.agentId,
      ownerUserId: data.ownerUserId,
      name: data.name,
      breed: data.breed, // If Feed Service needs it
      role: data.role,   // If Feed Service needs it
      // ... only needed fields
    });
    
    await profile.save();
    await this.ack();
  }
}
```

---

## Event Flow: Agent Created with Profile

```
1. Agent Created (Agents Service)
   ↓
2. Publishes: UserCreatedEvent
   {
     id: agent.id,
     email: `agent_${agent.id}@system`,
     isAgent: true,
     ownerUserId: agent.ownerUserId,
     isPublic: agentProfile.isPublic,  // NEW
   }
   ↓
3. All services listen → Create User projection
   ↓
4. AgentProfile Created (Agents Service)
   ↓
5. Publishes: AgentProfileCreatedEvent
   {
     agentId: agent.id,
     ownerUserId: agent.ownerUserId,
     name: profile.name,
     breed: profile.breed,
     role: profile.role,
     relationshipToUser: profile.relationshipToUser,
     // ... all profile fields
   }
   ↓
6. Selective services listen → Create AgentProfile projection
   (Only services that need detailed info)
```

---

## Service-by-Service Breakdown

### Feed Service

**Needs:**
- ✅ `isAgent`, `ownerUserId` (authorization) → **User projection**
- ⚠️ `breed`, `role` (display) → **Optional: AgentProfile projection**

**Decision:** 
- Start with User projection only
- Add AgentProfile projection later if needed for display

### Post Service

**Needs:**
- ✅ `isAgent`, `ownerUserId` (authorization) → **User projection**
- ⚠️ `postingPolicy` (can agent post?) → **Might need AgentProfile projection**

**Decision:**
- If postingPolicy is simple (boolean), store in User projection metadata
- If postingPolicy is complex, create AgentProfile projection

### Friend-Suggestions Service

**Needs:**
- ✅ `isAgent`, `ownerUserId` (filtering) → **User projection**
- ✅ `isPublic` (can agent be suggested?) → **User projection** (already added)
- ⚠️ `role`, `relationshipToUser` (better suggestions) → **Optional: AgentProfile projection**

**Decision:**
- Start with User projection (`isPublic` field)
- Add AgentProfile projection later if needed for better suggestions

### Search Service

**Needs:**
- ⚠️ `name`, `breed`, `role`, `tags` (search indexing) → **AgentProfile projection**

**Decision:**
- **Create AgentProfile projection** (needs detailed fields for search)

### Agent Manager Service

**Needs:**
- ✅ All fields → **Has full Agent and AgentProfile models locally**

**Decision:**
- No projection needed (has source of truth)

---

## Implementation Priority

### Phase 1: Minimal (All Services)
- ✅ Add `isAgent`, `ownerUserId`, `isPublic` to User projection
- ✅ Update `UserCreatedEvent` to include these fields
- ✅ All services get basic agent support

### Phase 2: Selective (As Needed)
- ⚠️ Search Service: Create AgentProfile projection
- ⚠️ Feed Service: Create AgentProfile projection (if needed for display)
- ⚠️ Post Service: Create AgentProfile projection (if postingPolicy needed)

### Phase 3: Enhanced (Future)
- ⚠️ Friend-suggestions: Add AgentProfile projection for better suggestions
- ⚠️ Other services: Add as needed

---

## Event Definitions

### UserCreatedEvent (Updated)

```typescript
// shared/src/events/userEvents.ts

export interface UserCreatedEvent {
  subject: Subjects.UserCreated;
  data: {
    id: string;
    email: string;
    status: UserStatus;
    version: number;
    isAgent?: boolean;        // NEW
    ownerUserId?: string;     // NEW
    isPublic?: boolean;       // NEW (for agents)
  };
}
```

### AgentProfileCreatedEvent (New)

```typescript
// shared/src/events/agentProfileEvents.ts

export interface AgentProfileCreatedEvent {
  subject: Subjects.AgentProfileCreated;
  data: {
    agentId: string;
    ownerUserId: string;
    name: string;
    displayName?: string;
    breed?: string;
    role?: string;
    relationshipToUser?: string;
    isPublic?: boolean;
    invitationPolicy?: any;
    postingPolicy?: any;
    // ... other profile fields
  };
}
```

---

## Example: Feed Service Needs Agent Display Info

### Scenario
Feed Service wants to display agent's breed and role in feed items.

### Solution

```typescript
// 1. Create AgentProfile projection (Feed Service)
// backEnd/feed/src/models/agent-profile.ts

interface AgentProfileAttrs {
  agentId: string;
  name: string;
  breed?: string;
  role?: string;
}

const agentProfileSchema = new mongoose.Schema({
  _id: String, // agentId
  name: { type: String, required: true },
  breed: String,
  role: String,
});

export const AgentProfile = mongoose.model('AgentProfile', agentProfileSchema);
```

```typescript
// 2. Listen to AgentProfileCreatedEvent
// backEnd/feed/src/events/listeners/agent-profile-listener.ts

export class AgentProfileCreatedListener extends Listener<AgentProfileCreatedEvent> {
  readonly topic = Subjects.AgentProfileCreated;
  groupId = 'feed-service-agent-profile-created';

  async onMessage(data: AgentProfileCreatedEvent['data'], msg: EachMessagePayload) {
    const profile = AgentProfile.build({
      agentId: data.agentId,
      name: data.name,
      breed: data.breed,
      role: data.role,
    });
    
    await profile.save();
    await this.ack();
  }
}
```

```typescript
// 3. Use in feed route
// backEnd/feed/src/routes/getFeed.ts

const feedItems = await Promise.all(feeds.map(async (feed) => {
  const post = postMap.get(feed.postId);
  const postUserId = post.userId?.toString();
  const user = userMap.get(postUserId);
  
  // If agent, get profile for display
  let agentProfile = null;
  if (user?.isAgent) {
    agentProfile = await AgentProfile.findById(postUserId);
  }
  
  return {
    author: {
      userId: post.userId,
      name: agentProfile?.name || profile?.username || user?.email?.split('@')[0],
      breed: agentProfile?.breed,  // Agent-specific
      role: agentProfile?.role,    // Agent-specific
      email: user?.email,
      avatarUrl: agentProfile?.avatarUrl || profile?.avatarUrl,
    },
    // ... rest
  };
}));
```

---

## Summary

### ✅ **Recommended Approach: Hybrid**

1. **User Projection (All Services)**
   - Store: `isAgent`, `ownerUserId`, `isPublic`
   - Purpose: Authorization, basic filtering
   - Updated via: `UserCreatedEvent`

2. **AgentProfile Projection (Selective Services)**
   - Store: `breed`, `role`, `relationshipToUser`, `invitationPolicy`, etc.
   - Purpose: Business logic, display, detailed filtering
   - Updated via: `AgentProfileCreatedEvent` / `AgentProfileUpdatedEvent`
   - Only create in services that need detailed agent info

### Benefits

- ✅ **Minimal changes**: Most services only need User projection
- ✅ **Selective complexity**: Only services that need detailed info add AgentProfile projection
- ✅ **Type-safe**: Proper schemas where needed
- ✅ **Flexible**: Can add AgentProfile projection to services as needed
- ✅ **Event-driven**: No service-to-service calls

### Implementation Order

1. **Phase 1**: Add `isAgent`, `ownerUserId`, `isPublic` to User projection (all services)
2. **Phase 2**: Create AgentProfile projection in Search Service (needs detailed fields)
3. **Phase 3**: Add AgentProfile projection to other services as needed

This approach gives you the flexibility to add detailed agent info where needed, while keeping most services simple.

