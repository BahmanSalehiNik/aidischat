# Feedback Service Redis Implementation

## Overview

The feedback service now uses **Redis-based batching with a worker pattern** for distributed coordination across multiple pods. This ensures that batches for the same `agentId` are properly aggregated even when events are processed by different pods.

## Architecture

```
Chat Service → Kafka → Feedback Service Pods
                              ↓
                    Redis (shared batches)
                    ├─ feedback:batch:123 → [item1, item2, ...]
                    ├─ feedback:batch:456 → [item3, item4, ...]
                    └─ feedback:batch:789 → [item5, item6, ...]
                              ↓
                    Batch Worker (all pods)
                    ├─ Checks for stale batches (time threshold)
                    ├─ Flushes batches that exceed threshold
                    └─ Saves to MongoDB + Publishes events
```

## Components

### 1. Redis Client (`src/redis-client.ts`)
- Creates Redis connection with error handling
- Defines Redis key patterns for batches
- Environment variable: `REDIS_FEEDBACK_URL` (defaults to `REDIS_URL`)

### 2. Redis Batcher (`src/services/feedback-batcher-redis.ts`)
- Stores batches in Redis lists
- Tracks batch metadata (createdAt, lastItemAt, itemCount)
- Maintains index set of all active batches
- Flushes when batch size OR time threshold reached
- Uses MongoDB bulk operations for efficiency

**Redis Keys:**
- `feedback:batch:{agentId}` - List of pending items
- `feedback:batch:{agentId}:meta` - Batch metadata (JSON)
- `feedback:batches:index` - Set of all active batch agentIds

### 3. Batch Worker (`src/workers/feedback-batch-worker.ts`)
- Runs on all pods
- Periodically checks for stale batches (exceeds time threshold)
- Flushes stale batches automatically
- Prevents concurrent processing using `flushInProgress` Set

**Configuration:**
- `FEEDBACK_WORKER_CHECK_INTERVAL_MS` - How often to check (default: 60s)
- `FEEDBACK_BATCH_TIME_MS` - Time threshold (default: 5 minutes)

### 4. Event Listeners
- Updated to use `feedbackBatcherRedis` instead of in-memory batcher
- Add items to Redis batches
- Batches flush automatically when thresholds reached

## Data Flow

### Adding Feedback Item
```
1. Event received (feedback.reply.received or feedback.reaction.received)
2. Add item to Redis list: LPUSH feedback:batch:{agentId} {item}
3. Update metadata: SET feedback:batch:{agentId}:meta {metadata}
4. Add to index: SADD feedback:batches:index {agentId}
5. Check if batch size reached → flush immediately
```

### Flushing Batch
```
1. Get all items from Redis: LRANGE feedback:batch:{agentId} 0 -1
2. Process batch:
   - MongoDB bulkWrite (upsert operations)
   - Fetch saved documents
   - Publish feedback.created events
3. Clear Redis:
   - DEL feedback:batch:{agentId}
   - DEL feedback:batch:{agentId}:meta
   - SREM feedback:batches:index {agentId}
```

### Worker Processing
```
1. Worker runs every 60 seconds (configurable)
2. Get all active batches: SMEMBERS feedback:batches:index
3. Check each batch metadata for staleness
4. Flush batches that exceed time threshold
```

## Configuration

### Environment Variables

```env
# Redis Configuration
REDIS_FEEDBACK_URL=redis://redis-feedback-srv:6379  # Optional, defaults to REDIS_URL

# Batching Configuration
FEEDBACK_BATCH_SIZE=10                              # Items per batch
FEEDBACK_BATCH_TIME_MS=300000                      # 5 minutes in milliseconds

# Worker Configuration
FEEDBACK_WORKER_CHECK_INTERVAL_MS=60000            # 1 minute in milliseconds
```

## Benefits

### ✅ Distributed Coordination
- All pods share the same Redis state
- Same `agentId` batches are properly aggregated across pods
- No need for partition keys or sticky sessions

### ✅ Fault Tolerance
- Batches survive pod restarts (stored in Redis)
- Worker on any pod can flush stale batches
- Automatic cleanup via TTL

### ✅ Scalability
- Horizontal scaling (add more pods)
- Redis handles concurrent access
- MongoDB bulk operations for efficiency

### ✅ Monitoring
- `getStats()` method provides batch statistics
- Can query Redis directly for debugging
- Index set shows all active batches

## Comparison: In-Memory vs Redis

| Feature | In-Memory | Redis |
|---------|-----------|-------|
| Pod Coordination | ❌ No (batches split) | ✅ Yes (shared state) |
| Fault Tolerance | ❌ Lost on restart | ✅ Survives restarts |
| Horizontal Scaling | ❌ Single instance | ✅ Multiple pods |
| Complexity | ✅ Simple | ⚠️ More complex |
| Performance | ✅ Faster (no network) | ⚠️ Network latency |
| Infrastructure | ✅ No deps | ❌ Redis required |

## Migration Notes

### Removed
- `src/services/feedback-batcher.ts` - Old in-memory batcher

### Added
- `src/redis-client.ts` - Redis connection
- `src/services/feedback-batcher-redis.ts` - Redis-based batcher
- `src/workers/feedback-batch-worker.ts` - Batch worker

### Updated
- Event listeners now use `feedbackBatcherRedis`
- `index.ts` starts worker and connects to Redis
- Graceful shutdown flushes all batches

## Testing

### Manual Testing
```bash
# Check Redis batches
redis-cli SMEMBERS feedback:batches:index

# View batch items
redis-cli LRANGE feedback:batch:{agentId} 0 -1

# View batch metadata
redis-cli GET feedback:batch:{agentId}:meta
```

### Monitoring
```typescript
// Get batch statistics
const stats = await feedbackBatcherRedis.getStats();
console.log(stats);
// {
//   totalBatches: 5,
//   totalItems: 23,
//   batches: [...]
// }
```

## Future Enhancements

1. **Metrics Export**: Add Prometheus metrics for batch operations
2. **Dead Letter Queue**: Handle failed batch flushes with retry logic
3. **Batch Prioritization**: Flush high-priority batches first
4. **Redis Cluster**: Support Redis cluster for high availability
5. **Batch Compression**: Compress large batches in Redis

## Troubleshooting

### Batches Not Flushing
- Check worker is running: Look for `[FeedbackBatchWorker]` logs
- Check Redis connection: `redis-cli PING`
- Check batch metadata: `redis-cli GET feedback:batch:{agentId}:meta`

### High Memory Usage
- Reduce `FEEDBACK_BATCH_SIZE` to flush more frequently
- Reduce `FEEDBACK_BATCH_TIME_MS` to flush sooner
- Check for stuck batches in Redis

### Concurrent Flush Issues
- `flushInProgress` Set prevents concurrent flushes
- Redis operations are atomic
- Worker processes batches in batches of 10

