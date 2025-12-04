# Kafka Consumer Production Configuration

## Problem: Message Loss During Rebalancing

**Issue**: Messages can be lost during consumer group rebalancing if auto-commit is enabled.

**Root Cause**: 
- KafkaJS defaults to `autoCommit: true` with `autoCommitInterval: 5000ms`
- During rebalancing, offsets may be committed before message processing completes
- This causes message loss even though processing failed

## Production-Grade Solution

### 1. Disable Auto-Commit

```typescript
consumer.run({
  autoCommit: false, // CRITICAL: Manual commits only
  eachMessage: async (payload) => {
    // Process message
    // Only commit offset after successful processing via manual ack()
  }
});
```

### 2. Configure Consumer Timeouts

```typescript
consumer({
  groupId,
  sessionTimeout: 30000,      // 30s - time before consumer considered dead
  heartbeatInterval: 3000,     // 3s - heartbeat frequency
  maxInFlightRequests: 1,      // Process one at a time for ordering
  allowAutoTopicCreation: false,
  retry: {
    retries: 8,
    initialRetryTime: 100,
    maxRetryTime: 30000,
    multiplier: 2,
  }
});
```

### 3. Manual Offset Commits

- Offsets are only committed when `ack()` is explicitly called
- Failed messages are automatically redelivered after session timeout
- Ensures at-least-once delivery semantics

### 4. Additional Production Practices

**Idempotent Processing**:
- Make handlers idempotent so redelivery is safe
- Use correlation IDs or version numbers to detect duplicates

**Dead Letter Queues**:
- After N retries, move messages to DLQ for manual inspection
- Prevents infinite retry loops

**Monitoring**:
- Track consumer lag
- Alert on high lag or processing failures
- Monitor rebalancing frequency

**Recovery Mechanisms**:
- Periodic job to check for stuck messages
- Reprocess failed events based on correlation IDs
- Health checks to detect and recover from missed events

## How Production Systems Handle This

1. **Netflix/Uber/Stripe**: All disable auto-commit, use manual commits only
2. **Event Sourcing Systems**: Use idempotent handlers + correlation IDs
3. **Financial Systems**: Add transaction logs + reconciliation jobs
4. **High-Volume Systems**: Use consumer lag monitoring + auto-scaling

## Current Implementation Status

✅ **Fixed**: Disabled auto-commit in base listener
✅ **Fixed**: Added production-grade consumer configuration
⚠️ **TODO**: Add idempotent processing checks
⚠️ **TODO**: Add dead letter queue support
⚠️ **TODO**: Add consumer lag monitoring
⚠️ **TODO**: Add recovery mechanisms for missed events

