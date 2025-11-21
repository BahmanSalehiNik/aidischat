# Friendship Projection Analysis

## Current Architecture ✅

**Both services are event-driven and do NOT call other services directly:**
- ✅ Friend-suggestions: Only listens to Kafka events (`FriendshipAccepted`, `FriendshipRequested`, `UserCreated`, `ProfileUpdated`)
- ✅ Search: Only queries its own MongoDB search projections
- ✅ No HTTP calls, no service-to-service communication
- ✅ All data comes from Kafka events or local database

## Current State: Friend-Suggestions Service

### What We Have Now:
1. **`MutualSuggestion` Model**: Stores `{userId, candidateId, mutualCount}`
   - This is a **denormalized cache**, not a full friendship graph
   - Gets updated when `FriendshipRequested` events arrive
   - Gets deleted when `FriendshipAccepted` events arrive (friendship becomes real)

2. **Problem**: The current implementation **cannot compute mutual friends** because:
   - It doesn't store the full friendship graph (who is friends with whom)
   - It only stores pre-computed mutual counts, but those aren't actually computed
   - To compute mutuals, you need: `friendsOf(userA) ∩ friendsOf(userB)`

## Option 1: Full Friendship Graph Projection

### What It Means:
Store every friendship relationship in friend-suggestions service:
```typescript
FriendshipProjection {
  userId: string;
  friendId: string;
  status: 'accepted' | 'requested';
  createdAt: Date;
}
```

### Pros ✅:
1. **Can compute mutual friends locally** - No need to query friendship service
2. **Fast queries** - All data is local, no network latency
3. **Independent scaling** - Friend-suggestions can scale without affecting friendship service
4. **Eventual consistency is fine** - Suggestions don't need real-time accuracy
5. **Can show "X mutual friends" in search results** (if search service also has projection)
6. **No service coupling** - Services remain decoupled via events

### Cons ❌:
1. **Data duplication** - Friendship service is source of truth, this is a copy
2. **Storage overhead** - Need to store all friendships (could be millions)
3. **Event processing overhead** - Must process every `FriendshipAccepted`/`FriendshipRequested` event
4. **Potential inconsistency** - If events are missed/delayed, projection is stale
5. **More complex maintenance** - Need to handle event replay, catch-up logic
6. **Memory usage** - Large graph in memory for fast lookups

### Implementation:
```typescript
// New model
FriendshipProjection {
  userId: string;      // Indexed
  friendId: string;    // Indexed
  status: string;
  createdAt: Date;
}

// Event listener updates
FriendshipAcceptedListener:
  - Insert: {userId: requester, friendId: recipient, status: 'accepted'}
  - Insert: {userId: recipient, friendId: requester, status: 'accepted'}

// Mutual friend computation
async getMutualFriends(userId: string, candidateId: string): Promise<number> {
  const userFriends = await FriendshipProjection.find({ userId, status: 'accepted' });
  const candidateFriends = await FriendshipProjection.find({ userId: candidateId, status: 'accepted' });
  const userFriendIds = new Set(userFriends.map(f => f.friendId));
  return candidateFriends.filter(f => userFriendIds.has(f.friendId)).length;
}
```

## Option 2: Keep Current Approach (No Full Projection)

### What We Have:
- Only store pre-computed mutual counts in `MutualSuggestion`
- Don't store the full graph

### Pros ✅:
1. **Minimal storage** - Only store suggestions, not all friendships
2. **Simple** - Less code, less complexity
3. **Lower event processing** - Only process events for active suggestions
4. **No data duplication** - Friendship service remains single source of truth

### Cons ❌:
1. **Cannot compute mutual friends** - Need full graph to compute intersection
2. **Limited functionality** - Can only show pre-computed suggestions
3. **Cannot show mutual count in search** - Search service has no friendship data
4. **Less accurate** - Mutual counts might be stale or missing

## Option 3: Hybrid Approach (Recommended)

### What It Means:
- Store a **lightweight friendship graph** optimized for mutual friend computation
- Only store `accepted` friendships (not requests)
- Use efficient data structures (indexed lookups)

### Implementation:
```typescript
// Lightweight projection - only what we need
FriendshipEdge {
  userId: string;      // Indexed
  friendId: string;     // Indexed
  createdAt: Date;
}

// Indexes: {userId: 1}, {friendId: 1}, {userId: 1, friendId: 1}

// Event listener
FriendshipAcceptedListener:
  - Upsert both directions: (userId, friendId) and (friendId, userId)

// Mutual computation (fast with indexes)
async getMutualCount(userId: string, candidateId: string): Promise<number> {
  const [userFriends, candidateFriends] = await Promise.all([
    FriendshipEdge.find({ userId }).select('friendId').lean(),
    FriendshipEdge.find({ userId: candidateId }).select('friendId').lean(),
  ]);
  
  const userFriendSet = new Set(userFriends.map(f => f.friendId));
  return candidateFriends.filter(f => userFriendSet.has(f.friendId)).length;
}
```

### Pros ✅:
1. **Can compute mutuals** - Has full graph for accepted friendships
2. **Efficient storage** - Only stores accepted friendships (bidirectional)
3. **Fast queries** - Indexed lookups, no full scans
4. **Eventual consistency** - Fine for suggestions
5. **No service calls** - Fully event-driven

### Cons ❌:
1. **Still data duplication** - But minimal (only accepted friendships)
2. **Event processing** - Must process all `FriendshipAccepted` events
3. **Storage grows** - With user base, but manageable with proper indexing

## Recommendation: Option 3 (Hybrid)

**Why:**
1. ✅ Solves the mutual friend computation problem
2. ✅ Keeps services decoupled (event-driven)
3. ✅ Efficient storage (only accepted friendships, indexed)
4. ✅ Can extend to search service later if needed
5. ✅ Scales well with proper MongoDB indexes

**For Search Service:**
- **Don't add friendship projection** unless you need "mutual friends" in search results
- Search service should remain focused on text search
- If you need mutual friends in search, add the same lightweight projection

## Implementation Plan

1. **Create `FriendshipEdge` model** in friend-suggestions service
2. **Update `FriendshipAcceptedListener`** to maintain bidirectional edges
3. **Add `FriendshipDeleted` event listener** (if friendship service publishes it)
4. **Update mutual friend computation** in `rankingEngine.ts`
5. **Add indexes** for fast lookups
6. **Optional**: Add to search service if mutual friends needed in results

## Storage Estimate

For 1M users with average 200 friends each:
- 200M friendship edges
- Each edge: ~50 bytes (userId + friendId + createdAt)
- Total: ~10GB (manageable with MongoDB sharding if needed)

## Event Processing

- `FriendshipAccepted`: 2 writes (bidirectional)
- `FriendshipDeleted`: 2 deletes (if event exists)
- Processing time: ~1ms per event (with indexes)
- Throughput: Can handle 1000+ events/second easily

