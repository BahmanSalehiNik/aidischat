# Feedback Service Refactor Proposal

## Current Architecture

Currently, the feedback service processes events immediately:
1. Receives `feedback.reply.received` or `feedback.reaction.received` events
2. Saves to MongoDB immediately
3. Publishes `feedback.created` event immediately

## Proposed Architecture: Single Lightweight Service with Batching

### Requirements
- Batch reactions and replies based on:
  - **Batch size threshold**: e.g., 10 items
  - **Time threshold**: e.g., 5 minutes
- Create JSON payload from batched items
- Publish single `feedback.created` event with batched data
- Single lightweight service (no separate worker service)

## Option Comparison

### Option 1: In-Memory Batching (RECOMMENDED)

**Architecture:**
- Store pending feedback items in memory (Map/Set)
- Use Node.js `setTimeout` for time-based flushing
- Flush when batch size OR time threshold reached
- Create JSON and publish event on flush

**Pros:**
- ✅ Lightweight - no external dependencies
- ✅ Fast - no network latency
- ✅ Simple - minimal code complexity
- ✅ Low operational overhead
- ✅ Perfect for transient data (reactions/replies are processed quickly)

**Cons:**
- ❌ Data loss on service restart (but Kafka events are durable, so can reprocess)
- ❌ Single instance limitation (unless using sticky sessions in load balancer)
- ❌ Memory usage (but minimal for typical batch sizes)

**Best For:**
- Single instance deployments
- Short time thresholds (minutes)
- High throughput scenarios
- When simplicity is prioritized

### Option 2: Redis + Worker

**Architecture:**
- Store pending feedback items in Redis (sorted sets or lists)
- Separate worker process polls Redis periodically
- Worker checks batch size and time thresholds
- Worker creates JSON and publishes events

**Pros:**
- ✅ Persistence - survives service restarts
- ✅ Distributed - can scale horizontally
- ✅ Shared state across instances
- ✅ Better for long time thresholds

**Cons:**
- ❌ Additional infrastructure dependency
- ❌ Network latency (Redis calls)
- ❌ More complex - requires Redis setup/maintenance
- ❌ Higher operational overhead
- ❌ Overkill for short-lived batches

**Best For:**
- Multi-instance deployments
- Long time thresholds (hours)
- When persistence is critical
- When you already have Redis infrastructure

## Recommendation: In-Memory Approach

**Rationale:**
1. **Lightweight**: No Redis dependency aligns with "lightweight service" requirement
2. **Time Threshold**: Typically short (5 minutes), so data loss on restart is minimal
3. **Kafka Durability**: Events are already persisted in Kafka, so can reprocess if needed
4. **Simplicity**: Easier to maintain and debug
5. **Performance**: Faster processing without network calls

**Implementation Strategy:**
- Use in-memory Map keyed by `agentId` to batch per-agent feedback
- Each agent has a batch buffer and timer
- Flush when:
  - Buffer reaches batch size (e.g., 10 items)
  - Time threshold expires (e.g., 5 minutes)
- On flush: create JSON payload, publish event, clear buffer

**Handling Restarts:**
- Kafka consumer offset ensures no events are lost
- On restart, service will reprocess events from last committed offset
- Batches will rebuild naturally

## Implementation Plan

1. Create `FeedbackBatcher` class to manage in-memory batching
2. Refactor listeners to use batcher instead of immediate publish
3. Add configuration for batch size and time threshold
4. Add graceful shutdown to flush pending batches
5. Add metrics/logging for batch operations

## Configuration

```typescript
const BATCH_SIZE = parseInt(process.env.FEEDBACK_BATCH_SIZE || '10', 10);
const BATCH_TIME_THRESHOLD_MS = parseInt(process.env.FEEDBACK_BATCH_TIME_MS || '300000', 10); // 5 minutes
```

## Event Structure

The batched `feedback.created` event will include an array of feedback items:

```typescript
interface FeedbackCreatedEvent {
  subject: Subjects.FeedbackCreated;
  data: {
    batchId: string; // UUID for this batch
    items: Array<{
      feedbackType: 'explicit' | 'implicit' | 'reaction';
      source: 'chat' | 'post' | 'comment' | 'profile';
      sourceId: string;
      agentId: string;
      userId: string;
      roomId?: string;
      value: number;
      metadata?: Record<string, any>;
      createdAt: string;
    }>;
    batchSize: number;
    batchCreatedAt: string;
  };
}
```

