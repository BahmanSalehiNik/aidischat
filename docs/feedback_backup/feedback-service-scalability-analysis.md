# Feedback Service Scalability Analysis

## Current Implementation Concerns

### 1. **Per-Agent Batching Memory Growth**
- **Issue**: Each agent gets its own batch in memory
- **Scale**: With 10,000 active agents, we have 10,000 batches + 10,000 timers
- **Memory**: ~1-2KB per batch = 10-20MB minimum (plus items)
- **Risk**: Medium - manageable but not optimal

### 2. **Timer Overhead**
- **Issue**: One `setTimeout` per agent batch
- **Scale**: 10,000 timers active simultaneously
- **Risk**: Low-Medium - Node.js handles this well, but cleanup is important

### 3. **MongoDB Query Inefficiency**
- **Issue**: Individual `findOne` queries per item (even in batches)
- **Scale**: With batch size 10, that's 10 queries per flush
- **Risk**: **HIGH** - This is the biggest bottleneck

### 4. **Single Instance Limitation**
- **Issue**: In-memory batching doesn't scale horizontally
- **Scale**: Can't distribute load across instances
- **Risk**: **HIGH** - Single point of failure, can't scale out

### 5. **Memory Leaks**
- **Issue**: Batches that never flush (inactive agents)
- **Scale**: Could accumulate indefinitely
- **Risk**: Medium - Need cleanup mechanism

## Scalability Improvements Needed

### Critical: MongoDB Bulk Operations
Replace individual queries with bulk operations:
```typescript
// Instead of:
for (const item of itemsToProcess) {
    const existing = await Feedback.findOne({...});
    // save individually
}

// Use:
const bulkOps = itemsToProcess.map(item => ({
    updateOne: {
        filter: { userId: item.userId, agentId: item.agentId, sourceId: item.sourceId, source: item.source },
        update: { $set: { value: item.value, metadata: item.metadata, updatedAt: new Date() } },
        upsert: true
    }
}));
await Feedback.bulkWrite(bulkOps);
```

### High Priority: Global Batching (or Hybrid)
Instead of per-agent batching, use global batching:
- Single batch for all agents
- Flushes when total items reach threshold OR time threshold
- Reduces memory overhead significantly

### High Priority: Redis for Horizontal Scaling
For millions of users, need Redis-based batching:
- Allows multiple service instances
- Shared state across instances
- Better for high-throughput scenarios

### Medium Priority: Memory Limits & Eviction
- Maximum batches limit
- Evict oldest batches when limit reached
- Periodic cleanup of stale batches

### Medium Priority: Timer Pool Management
- Single global timer instead of per-batch timers
- Periodic flush check instead of individual timers

