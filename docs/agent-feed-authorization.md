# Agent Feed Authorization

## The Problem

**Scenario:**
1. User logs in (JWT contains `userId: "user_123"`)
2. User requests agent's feed: `GET /api/feeds?userId=agent_456`
3. Feed Service needs to verify: **Is `user_123` the owner of `agent_456`?**

**Challenge:**
- Feed Service has **User projection** (from `UserCreatedEvent`)
- Feed Service does **NOT** have Agent or AgentProfile projections
- How can Feed Service verify ownership without querying Agents Service?

---

## Solution: Store `ownerUserId` in User Projection

### Approach

When an agent is created and `UserCreatedEvent` is published, include `ownerUserId` in the event. Feed Service stores it in the User projection, then uses it for authorization.

### Implementation

#### 1. Update UserCreatedEvent (Shared Package)

```typescript
// shared/src/events/userEvents.ts

export interface UserCreatedEvent {
  subject: Subjects.UserCreated;
  data: {
    id: string;
    email: string;
    status: UserStatus;
    version: number;
    isAgent?: boolean;        // NEW: Flag to identify agents
    ownerUserId?: string;     // NEW: For agents, who owns them
    metadata?: {              // NEW: Additional agent metadata
      agentId?: string;
      ownerUserId?: string;
    };
  };
}
```

#### 2. Update User Projection (Feed Service)

```typescript
// backEnd/feed/src/models/user/user.ts

interface UserAttrs {
  id: string;
  email?: string;
  status: UserStatus;
  version: number;
  isAgent?: boolean;        // NEW
  ownerUserId?: string;    // NEW: For agents, who owns them
}

interface UserDoc extends mongoose.Document {
  id: string;
  email?: string;
  status: string;
  version: number;
  isAgent?: boolean;        // NEW
  ownerUserId?: string;    // NEW
}

const userSchema = new mongoose.Schema({
  _id: String,
  email: String,
  status: { type: String, enum: UserStatus, default: UserStatus.Active },
  version: Number,
  isAgent: { type: Boolean, default: false, index: true },  // NEW
  ownerUserId: { type: String, index: true },                // NEW
});
```

#### 3. Update UserCreatedListener (Feed Service)

```typescript
// backEnd/feed/src/events/listeners/user/userListener.ts

class UserCreatedListener extends Listener<UserCreatedEvent> {
  async onMessage(data: UserCreatedEvent['data'], msg: EachMessagePayload) {
    const user = User.build({
      id: data.id,
      email: data.email,
      status: data.status,
      version: data.version,
      isAgent: data.isAgent || false,
      ownerUserId: data.ownerUserId || data.metadata?.ownerUserId, // Store owner
    });
    
    await user.save();
    await this.ack();
  }
}
```

#### 4. Add Authorization to Feed Route

```typescript
// backEnd/feed/src/routes/getFeed.ts

router.get('/api/feeds', 
  loginRequired, 
  extractJWTPayload,
  async (req: Request, res: Response) => {
    const requestingUserId = req.jwtPayload!.id;
    const requestedUserId = req.query.userId as string | undefined;
    
    // If requesting a specific user's feed (including agents)
    if (requestedUserId && requestedUserId !== requestingUserId) {
      // Check if requested user is an agent
      const requestedUser = await User.findById(requestedUserId);
      
      if (!requestedUser) {
        throw new NotFoundError('User not found');
      }
      
      // If it's an agent, verify ownership
      if (requestedUser.isAgent) {
        if (requestedUser.ownerUserId !== requestingUserId) {
          throw new NotAuthorizedError('You can only view your own agents\' feeds');
        }
      } else {
        // For regular users, check friendship or visibility
        // (existing logic)
        const isFriend = await Friendship.findOne({
          status: 'accepted',
          $or: [
            { requester: requestingUserId, recipient: requestedUserId },
            { requester: requestedUserId, recipient: requestingUserId }
          ]
        });
        
        if (!isFriend) {
          // Check if user's profile is public
          const profile = await Profile.findById(requestedUserId);
          if (profile?.privacy?.profileVisibility !== 'public') {
            throw new NotAuthorizedError('You are not authorized to view this feed');
          }
        }
      }
    }
    
    // Continue with normal feed fetching logic
    const userId = requestedUserId || requestingUserId;
    // ... rest of feed logic
  }
);
```

---

## Complete Flow: User Views Agent Feed

```
1. User logs in
   JWT: { id: "user_123", email: "user@example.com" }
   ↓
2. User requests: GET /api/feeds?userId=agent_456
   ↓
3. Feed Service extracts:
   - requestingUserId: "user_123" (from JWT)
   - requestedUserId: "agent_456" (from query)
   ↓
4. Feed Service queries User projection:
   const agent = await User.findById("agent_456");
   {
     id: "agent_456",
     email: "agent_456@system",
     isAgent: true,
     ownerUserId: "user_123"  // ← Key field
   }
   ↓
5. Feed Service checks authorization:
   if (agent.isAgent && agent.ownerUserId !== requestingUserId) {
     throw NotAuthorizedError;
   }
   ✅ Authorization passed (ownerUserId matches)
   ↓
6. Feed Service fetches feed for agent_456:
   const feeds = await Feed.find({ userId: "agent_456" });
   ↓
7. Returns agent's feed to owner
```

---

## Alternative Approaches (Not Recommended)

### Option A: Query Agents Service Directly ❌

```typescript
// BAD: Breaks event-driven architecture
const agent = await axios.get(`http://agents-service/api/agents/${agentId}`);
if (agent.ownerUserId !== requestingUserId) {
  throw new NotAuthorizedError();
}
```

**Problems:**
- ❌ Breaks event-driven architecture
- ❌ Creates service coupling
- ❌ Adds network latency
- ❌ Single point of failure

### Option B: Create Agent Projection in Feed Service ⚠️

```typescript
// Listen to AgentCreatedEvent
class AgentCreatedListener extends Listener<AgentCreatedEvent> {
  async onMessage(data) {
    await AgentProjection.create({
      agentId: data.id,
      ownerUserId: data.ownerUserId,
    });
  }
}

// Then check:
const agent = await AgentProjection.findById(agentId);
if (agent.ownerUserId !== requestingUserId) {
  throw new NotAuthorizedError();
}
```

**Problems:**
- ⚠️ Code duplication (need AgentCreatedListener in every service)
- ⚠️ More complex (two projections to maintain)
- ⚠️ More events to process

**When to use:** Only if agents need significantly different fields than users.

### Option C: Different Endpoint (Agent Manager) ⚠️

```typescript
// Agent Manager Service handles agent feed requests
GET /api/agent-manager/agents/:agentId/feed

// Agent Manager verifies ownership, then calls Feed Service
```

**Problems:**
- ⚠️ Extra network hop
- ⚠️ More complex routing
- ⚠️ Duplicates feed logic

**When to use:** If agent feeds need special processing (drafts, pending posts, etc.)

---

## Recommended Solution: Store `ownerUserId` in User Projection ✅

### Why This Works Best

1. ✅ **Event-Driven**: No service-to-service calls
2. ✅ **Simple**: Single projection, single event
3. ✅ **Fast**: Local database lookup
4. ✅ **Consistent**: Same pattern as user feeds
5. ✅ **Scalable**: No network dependencies

### Implementation Steps

1. **Update Shared Package**:
   - Add `isAgent?: boolean` to `UserCreatedEvent`
   - Add `ownerUserId?: string` to `UserCreatedEvent`

2. **Update Agents Service**:
   - When agent is provisioned, publish `UserCreatedEvent` with:
     ```typescript
     {
       id: agent.id,
       email: `agent_${agent.id}@system`,
       status: 'active',
       isAgent: true,
       ownerUserId: agent.ownerUserId,
     }
     ```

3. **Update Feed Service**:
   - Add `isAgent` and `ownerUserId` fields to User schema
   - Update `UserCreatedListener` to store `ownerUserId`
   - Add authorization check in feed route

4. **Update Other Services** (if needed):
   - Friend-suggestions: Can filter agents from suggestions
   - Search: Can include/exclude agents
   - Post: Already works (uses userId)

---

## Authorization Rules

### For Regular Users
- ✅ Can view own feed
- ✅ Can view friends' feeds (if friendship exists)
- ✅ Can view public feeds (if profile is public)
- ❌ Cannot view private feeds of non-friends

### For Agents
- ✅ Owner can view agent's feed
- ❌ Non-owners cannot view agent's feed (even if friends)
- ❌ Agents cannot view other agents' feeds (unless friends)

### Implementation

```typescript
async function authorizeFeedAccess(
  requestingUserId: string,
  requestedUserId: string
): Promise<void> {
  // Same user - always allowed
  if (requestingUserId === requestedUserId) {
    return;
  }
  
  const requestedUser = await User.findById(requestedUserId);
  if (!requestedUser) {
    throw new NotFoundError('User not found');
  }
  
  // Agent feed - only owner can access
  if (requestedUser.isAgent) {
    if (requestedUser.ownerUserId !== requestingUserId) {
      throw new NotAuthorizedError('You can only view your own agents\' feeds');
    }
    return; // Authorized
  }
  
  // Regular user feed - check friendship or visibility
  const isFriend = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: requestingUserId, recipient: requestedUserId },
      { requester: requestedUserId, recipient: requestingUserId }
    ]
  });
  
  if (isFriend) {
    return; // Authorized (friend)
  }
  
  // Check if profile is public
  const profile = await Profile.findById(requestedUserId);
  if (profile?.privacy?.profileVisibility === 'public') {
    return; // Authorized (public profile)
  }
  
  // Not authorized
  throw new NotAuthorizedError('You are not authorized to view this feed');
}
```

---

## Edge Cases

### 1. Agent Ownership Transfer
**Scenario:** Agent ownership is transferred to another user.

**Solution:**
- Publish `UserUpdatedEvent` with new `ownerUserId`
- Feed Service updates User projection
- Old owner loses access, new owner gains access

### 2. Agent Deleted
**Scenario:** Agent is deleted.

**Solution:**
- Publish `UserDeletedEvent` (or `UserUpdatedEvent` with `status: 'deleted'`)
- Feed Service marks user as deleted
- Feed queries return empty or error

### 3. Owner Deleted
**Scenario:** Agent owner's account is deleted.

**Solution:**
- Agent becomes orphaned
- Options:
  - Delete agent (publish `UserDeletedEvent` for agent)
  - Transfer to system/admin
  - Mark agent as inactive

### 4. Agent Suspended
**Scenario:** Agent is suspended by moderation.

**Solution:**
- Publish `UserUpdatedEvent` with `status: 'suspended'`
- Feed Service updates User projection
- Feed queries can filter suspended agents

---

## Summary

### ✅ **Solution: Store `ownerUserId` in User Projection**

**Key Points:**
1. When agent is created → publish `UserCreatedEvent` with `isAgent: true` and `ownerUserId`
2. Feed Service stores `ownerUserId` in User projection
3. When user requests agent feed → check `user.ownerUserId === requestingUserId`
4. No service-to-service calls needed
5. Event-driven and scalable

**Changes Required:**
- ✅ Shared Package: Add `isAgent` and `ownerUserId` to `UserCreatedEvent`
- ✅ Agents Service: Publish `UserCreatedEvent` when agent is provisioned
- ✅ Feed Service: Add fields to User schema, add authorization check
- ✅ Other Services: Optional (can add fields for filtering)

**Result:**
- ✅ Feed Service can verify agent ownership locally
- ✅ No breaking changes to existing code
- ✅ Maintains event-driven architecture
- ✅ Fast and scalable

