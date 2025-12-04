# Feedback Service Pod Coordination - How Pods Share Batch State

## The Problem

With multiple pods (instances) of the feedback service:
- **Each pod has its own in-memory batches**
- Same `agentId` can receive events in **different pods**
- Result: **Separate batches** for the same agentId across pods
- **Batching doesn't work correctly** - batches are split across pods

## Current Architecture Issue

```
Pod A: agentId=123 → batch=[item1, item2] (2 items)
Pod B: agentId=123 → batch=[item3, item4] (2 items)

Problem: Two separate batches for same agentId!
- Pod A won't flush until it gets 10 items (or timeout)
- Pod B won't flush until it gets 10 items (or timeout)
- Batching threshold never reached properly
```

## Solution Options

### Option 1: Kafka Partition Keys (RECOMMENDED) ✅

**How it works:**
- Use `agentId` as Kafka partition key
- Kafka ensures same `agentId` always goes to **same partition**
- With consumer groups, same partition → **same pod**
- Result: Same `agentId` always processed by **same pod**

**Architecture:**
```
Chat Service publishes feedback.reply.received
    ↓
Kafka Topic (with partition key = agentId)
    ├─ Partition 0: agentId=123, agentId=456, agentId=123...
    ├─ Partition 1: agentId=789, agentId=123, agentId=789...
    └─ Partition 2: agentId=111, agentId=222...
    ↓
Feedback Service Pods (consumer group)
    ├─ Pod A ← Partition 0 (all agentId=123 events)
    ├─ Pod B ← Partition 1
    └─ Pod C ← Partition 2
```

**Implementation:**
```typescript
// In chat service, when publishing feedback events:
await producer.send({
  topic: 'feedback.reply.received',
  messages: [{
    key: data.agentId,  // ← Partition key!
    value: JSON.stringify(data)
  }]
});
```

**Benefits:**
- ✅ No shared state needed (Kafka handles it)
- ✅ Automatic load balancing
- ✅ No Redis dependency
- ✅ Works with current in-memory batching
- ✅ Simple to implement

**Limitations:**
- ⚠️ Pod restarts cause partition reassignment (batches lost, but Kafka redelivers)
- ⚠️ Need enough partitions for load distribution

---

### Option 2: Redis Shared State (Like Room Service) 🔄

**How it works:**
- Store batches in Redis (not in-memory)
- All pods read/write same Redis keys
- Key: `feedback:batch:{agentId}`
- Redis provides shared state across pods

**Architecture:**
```
Chat Service → Kafka → Feedback Service Pods
                              ↓
                         Redis (shared batches)
                         ├─ feedback:batch:123 → [item1, item2]
                         ├─ feedback:batch:456 → [item3]
                         └─ feedback:batch:789 → [item4, item5, item6]
```

**Implementation:**
```typescript
// Store batch in Redis
await redis.lpush(`feedback:batch:${agentId}`, JSON.stringify(item));

// Check batch size
const batchSize = await redis.llen(`feedback:batch:${agentId}`);
if (batchSize >= BATCH_SIZE) {
  await flushBatch(agentId);
}

// Flush: get all items, save to MongoDB, clear Redis
const items = await redis.lrange(`feedback:batch:${agentId}`, 0, -1);
await redis.del(`feedback:batch:${agentId}`);
```

**Benefits:**
- ✅ True shared state (all pods see same batches)
- ✅ Survives pod restarts
- ✅ Works with any number of pods
- ✅ Similar to room service pattern (familiar)

**Limitations:**
- ❌ Redis dependency (additional infrastructure)
- ❌ Network latency (Redis calls)
- ❌ More complex than partition keys
- ❌ Need Redis connection pooling

---

### Option 3: MongoDB Shared State 📊

**How it works:**
- Store pending batches in MongoDB collection
- All pods read/write same documents
- Document: `{ agentId, items: [...], createdAt }`

**Architecture:**
```
Chat Service → Kafka → Feedback Service Pods
                              ↓
                         MongoDB (shared batches)
                         Collection: pending_feedback_batches
```

**Benefits:**
- ✅ Uses existing MongoDB (no new dependency)
- ✅ Persistent (survives restarts)
- ✅ Familiar pattern

**Limitations:**
- ❌ Slower than Redis (disk I/O)
- ❌ More complex queries
- ❌ Not ideal for high-frequency updates

---

## Comparison: Room Service vs Feedback Service

### Room Service Pattern (Redis Pub/Sub)
```
Kafka → ONE pod consumes
    ↓
Redis Pub/Sub → ALL pods receive
    ↓
Each pod checks: "Do I have sockets for this room?"
    ├─ Yes → Send to sockets
    └─ No → Ignore (another pod handles it)
```

**Why Redis works here:**
- Broadcasting to all pods (pub/sub)
- Each pod has local state (sockets)
- No coordination needed (each pod decides independently)

### Feedback Service Pattern (Batching)
```
Kafka → Multiple pods consume
    ↓
Problem: Same agentId in different pods
    ↓
Need: Same agentId → Same pod (for batching)
```

**Why Redis is different here:**
- Not broadcasting (need coordination)
- Need shared state (batches)
- Or use partition keys (simpler!)

---

## Recommended Solution: Kafka Partition Keys

**Why partition keys are better:**
1. **Simpler**: No Redis needed, works with current code
2. **Faster**: No network calls to Redis
3. **Automatic**: Kafka handles load balancing
4. **Reliable**: Kafka guarantees partition assignment

**Implementation Steps:**

1. **Update Chat Service Publishers** (add partition key):
```typescript
// feedback-reply-received-publisher.ts
await producer.send({
  topic: 'feedback.reply.received',
  messages: [{
    key: data.agentId,  // ← Add this!
    value: JSON.stringify(data)
  }]
});

// feedback-reaction-received-publisher.ts
await producer.send({
  topic: 'feedback.reaction.received',
  messages: [{
    key: data.agentId,  // ← Add this!
    value: JSON.stringify(data)
  }]
});
```

2. **Ensure Topic Has Enough Partitions**:
```bash
# Create topic with multiple partitions for load distribution
kafka-topics --create \
  --topic feedback.reply.received \
  --partitions 10 \
  --replication-factor 3
```

3. **Current Feedback Service Code Works As-Is**:
- In-memory batching already works
- Same agentId → same pod (via partition key)
- No code changes needed!

---

## When to Use Each Approach

### Use Kafka Partition Keys When:
- ✅ You want simplicity
- ✅ You don't want Redis dependency
- ✅ Batching is per-agent (current use case)
- ✅ Pod restarts are acceptable (Kafka redelivers)

### Use Redis When:
- ✅ You need true shared state across pods
- ✅ You need to survive pod restarts without data loss
- ✅ You already have Redis infrastructure
- ✅ You need complex coordination logic

### Use MongoDB When:
- ✅ You want persistence without Redis
- ✅ Batch data needs to survive restarts
- ✅ You're already using MongoDB heavily

---

## Current State

**Current Implementation:**
- ❌ No partition keys → events distributed randomly
- ❌ In-memory batching → batches split across pods
- ⚠️ **Batching doesn't work correctly with multiple pods**

**Fix Needed:**
- ✅ Add partition keys to feedback event publishers
- ✅ Ensure topic has enough partitions
- ✅ Current batcher code will work correctly!

---

## Summary

**Answer to your question:**
> "How would different pods know about other pods rooms and agentId reactions?"

**Current answer:** They DON'T - that's the problem! Same agentId can have batches in multiple pods.

**Solution:** Use Kafka partition keys (like room service uses Redis, but simpler):
- Partition key = `agentId`
- Same agentId → same partition → same pod
- No shared state needed (Kafka handles it)
- Works with current in-memory batching

**Alternative:** Use Redis (like room service) for true shared state, but partition keys are simpler for this use case.

