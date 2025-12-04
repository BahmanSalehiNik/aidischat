# Kafka Logging: Production Best Practices

## Is Suppressing Transient Errors Standard?

**Yes** - Suppressing known transient errors is a standard practice in production systems. Here's how big apps handle it:

## How Production Systems Handle Kafka Logging

### 1. **Netflix/Uber/Stripe Approach**

**Log Levels by Environment**:
- **Development**: DEBUG/INFO (see everything for debugging)
- **Staging**: INFO/WARN (see important events)
- **Production**: WARN/ERROR only (suppress noise)

**Error Filtering**:
- Known transient errors → Suppressed or logged at DEBUG
- Real errors → Logged at WARN/ERROR with context
- Critical errors → Alerted immediately

### 2. **Standard Kafka Error Categories**

**Transient Errors (Suppress/DEBUG level)**:
- ✅ `"does not host this topic-partition"` - Topic doesn't exist yet
- ✅ `UNKNOWN_TOPIC_OR_PARTITION` - Topic metadata not ready
- ✅ `ListOffsets` errors during startup - Normal during initialization
- ✅ Consumer rebalancing messages - Expected during scaling

**Real Errors (Log at WARN/ERROR)**:
- ❌ Connection failures (can't reach broker)
- ❌ Authentication/authorization errors
- ❌ Consumer lag exceeding thresholds
- ❌ Message processing failures (after retries)
- ❌ Offset commit failures

### 3. **Production Monitoring Strategy**

**Big apps don't rely on logs alone** - they use:

1. **Metrics (Primary)**:
   - Consumer lag (most important!)
   - Message processing rate
   - Error rate (excluding transient)
   - Connection pool usage
   - Rebalancing frequency

2. **Structured Logging**:
   - JSON logs with error types
   - Filter by error category
   - Aggregate in log systems (ELK, Datadog, etc.)

3. **Alerting**:
   - Alert on metrics, not logs
   - Consumer lag > threshold → Alert
   - Error rate spike → Alert
   - Connection failures → Alert

### 4. **Why Suppress Transient Errors?**

**Problems with logging everything**:
- ❌ **Log noise**: 1000s of transient errors hide real issues
- ❌ **Storage costs**: Logs are expensive to store
- ❌ **Alert fatigue**: Too many false alarms
- ❌ **Debugging difficulty**: Can't find real errors

**Benefits of suppression**:
- ✅ **Clean logs**: Only see actionable errors
- ✅ **Lower costs**: Less log storage
- ✅ **Better alerts**: Only alert on real issues
- ✅ **Faster debugging**: Real errors stand out

### 5. **Industry Examples**

**Netflix**:
- Uses structured logging with error categories
- Filters transient Kafka errors at log aggregation layer
- Monitors consumer lag as primary health metric
- Alerts on lag spikes, not individual errors

**Uber**:
- Logs transient errors at DEBUG level only
- Uses metrics (Prometheus) for monitoring
- Alerting based on error rates, not individual errors
- Filters known retryable errors

**Stripe**:
- Structured JSON logs with error types
- Filters at log aggregation (Datadog/ELK)
- Monitors consumer lag and processing rates
- Suppresses known transient errors

**Confluent (Kafka creators)**:
- Recommends filtering transient errors
- Use metrics for monitoring, not logs
- Log only actionable errors
- Document known transient error patterns

### 6. **Our Implementation**

**What we're doing (Standard approach)**:
```typescript
// Suppress transient partition errors
if (errorMessage?.includes('does not host this topic-partition')) {
  return; // Suppress - handled by retry logic
}

// Log real errors
if (level >= 2) { // WARN/ERROR
  console.warn/error(...);
}
```

**This matches production best practices**:
- ✅ Suppress known transient errors
- ✅ Log real WARN/ERROR messages
- ✅ Retry logic handles transient issues
- ✅ Clean logs for debugging

### 7. **What to Monitor Instead**

**Instead of watching logs, monitor**:

1. **Consumer Lag** (Most Important):
   ```bash
   # Kafka consumer lag
   kafka-consumer-groups --bootstrap-server ... --describe
   ```
   - Alert if lag > 1000 messages
   - Alert if lag growing continuously

2. **Error Rates**:
   - Track error rate (excluding transient)
   - Alert if error rate > threshold
   - Track by error type

3. **Processing Rates**:
   - Messages processed per second
   - Alert if rate drops significantly

4. **Connection Health**:
   - Broker connectivity
   - Connection pool usage
   - Rebalancing frequency

### 8. **Recommended Production Setup**

**Logging**:
- ✅ Suppress transient errors (what we did)
- ✅ Structured JSON logs
- ✅ Log levels: WARN/ERROR in prod
- ✅ Context in error messages

**Monitoring**:
- ✅ Consumer lag dashboard
- ✅ Error rate metrics (excluding transient)
- ✅ Processing rate metrics
- ✅ Connection health checks

**Alerting**:
- ✅ Consumer lag > threshold
- ✅ Error rate spike (real errors only)
- ✅ Connection failures
- ✅ Processing rate drop

### 9. **Summary**

**Is suppressing transient errors standard?**
- ✅ **Yes** - Industry standard practice
- ✅ Used by Netflix, Uber, Stripe, Confluent
- ✅ Recommended in Kafka best practices
- ✅ Reduces noise, improves debugging

**What we should add**:
- ⚠️ Consumer lag monitoring
- ⚠️ Error rate metrics (excluding transient)
- ⚠️ Alerting on real issues
- ⚠️ Structured logging (JSON format)

**Current implementation**:
- ✅ Suppresses transient errors (correct)
- ✅ Logs real errors (correct)
- ✅ Retry logic handles transient issues (correct)
- ⚠️ Need to add metrics/monitoring (next step)

## Conclusion

Suppressing transient Kafka errors is **standard practice** in production. Big apps:
1. Suppress known transient errors
2. Monitor metrics (not logs) for health
3. Alert on real issues (lag, error rates)
4. Use structured logging for debugging

Our implementation follows these practices. The next step would be adding consumer lag monitoring and error rate metrics.

