# Feedback Service Kafka Integration Test - Complete Setup Guide

## Overview

This test (`feedback-flow-kafka.test.ts`) demonstrates the new microservices testing approach using **Testcontainers** with **real Kafka events**. It's a complete example of testing cross-service flows with actual event publishing and consumption.

## What This Test Does

1. ✅ **Starts Real Infrastructure** (Testcontainers):
   - Kafka (Redpanda) - Real event broker
   - Redis - Real sliding window storage
   - MongoDB (in-memory) - Real data persistence

2. ✅ **Publishes Real Kafka Events**:
   - `agent.created` - Creates agent learning summary
   - `feedback.reaction.received` - Processes user reactions (3 events)

3. ✅ **Real Listeners Consume Events**:
   - `AgentCreatedListener` - Creates learning summary and aggregation
   - `FeedbackReactionReceivedListener` - Adds reactions to Redis batcher

4. ✅ **Verifies Complete Flow**:
   - Redis sliding window (max 3 items)
   - MongoDB aggregations updated
   - Learning summary updated with numeric scores
   - `agent.learning.updated` event published and received

## Key Features

### Real Infrastructure (Not Mocked)
- **Kafka**: Real events are actually published and consumed
- **Redis**: Real operations, real data structures
- **MongoDB**: Real queries, real persistence

### Real Event Flow
- Events are published to Kafka
- Listeners consume from Kafka
- Processing happens through real service logic
- Results are verified in real databases

## How to Run

### Prerequisites
```bash
# Ensure Docker is running
docker ps

# Install dependencies (if not already done)
cd backEnd/feedback
npm install
```

### Run the Test
```bash
# Run only the Kafka test (recommended to avoid Redis singleton issues)
cd backEnd/feedback
npx jest src/__tests__/integration/feedback-flow-kafka.test.ts --runInBand --no-cache
```

### Expected Output
```
🚀 Starting test infrastructure...
📦 Starting Redis container...
✅ Redis started at redis://localhost:XXXXX
📦 Starting Kafka (Redpanda) container...
✅ Kafka started at localhost:XXXXX
📦 Starting MongoDB (in-memory)...
✅ MongoDB started at mongodb://...
✅ MongoDB connected
✅ Redis connected
✅ Replaced redisFeedback with test Redis client
✅ Feedback Redis client verified
✅ Kafka connected
✅ Kafka listeners started
✅ Learning updated event listener started

📝 Step 1: Publishing agent.created event to Kafka...
✅ Agent created event published
✅ Agent learning summary created via Kafka event
✅ Agent feedback aggregation created via Kafka event

📝 Step 2: Publishing reaction feedback events to Kafka...
✅ User1 reaction (like) event published to Kafka
✅ User2 reaction (love) event published to Kafka
✅ User1 reaction (laugh) event published to Kafka

📝 Step 3: Verifying Redis sliding window...
✅ Redis window contains 3 items (max 3 expected)

📝 Step 4: Triggering batch flush...
✅ Batch flushed

📝 Step 5: Verifying MongoDB aggregations...
📊 Aggregation: { totalFeedback: 3, positiveCount: 3, ... }

📝 Step 6: Verifying learning summary updates...
📈 Learning Summary: { sentimentScore: 0.7, engagementScore: 0.65, ... }
✅ Learning summary verified with numeric scores!

📝 Step 7: Verifying agent.learning.updated event was published...
✅ agent.learning.updated event received

✅ Integration test with real Kafka events completed successfully!
```

## Test Duration

- **First Run**: ~60-90 seconds (downloads Docker images)
- **Subsequent Runs**: ~30-45 seconds (cached images)

## Troubleshooting

### Redis Connection Errors

**Error**: `getaddrinfo EAI_AGAIN redis-feedback-srv`

**Solution**: The test now replaces `redisFeedback` with the test Redis client, so this should be resolved. If you still see it:
- Ensure you're running only this test file (not all integration tests)
- Check that Docker is running
- Verify Testcontainers can start containers

### Kafka Connection Errors

**Error**: `Connection timeout` or `Broker not available`

**Solution**:
- Ensure Docker has enough resources (2GB+ RAM recommended)
- Check Docker logs: `docker ps` and `docker logs <container-id>`
- Increase timeout in test if needed

### Test Timeout

**Error**: `Timeout - Async callback was not invoked`

**Solution**:
- Increase timeout in test (currently 120 seconds)
- Check container startup logs
- Ensure no port conflicts

## Architecture

```
Test File
  ↓
Testcontainers
  ├── Kafka (Redpanda) Container
  ├── Redis Container
  └── MongoDB (In-Memory)
  ↓
Real Event Flow:
  Publisher → Kafka → Listener → Service Logic → Database
  ↓
Verification:
  - Redis queries
  - MongoDB queries
  - Kafka event consumption
```

## Comparison with Original Test

| Aspect | Original Test | Kafka Test |
|--------|--------------|------------|
| **Kafka** | ❌ Not tested (port-forward issues) | ✅ Real Kafka with Testcontainers |
| **Events** | ❌ Direct function calls | ✅ Real Kafka events |
| **Redis** | ⚠️ Port-forward required | ✅ Testcontainers |
| **MongoDB** | ✅ In-memory | ✅ In-memory |
| **Event Flow** | ❌ Bypassed | ✅ Full event flow |

## Next Steps

1. ✅ Test is ready to run
2. ⏳ Run and verify it works
3. ⏳ Add more test scenarios (replies, different reaction types)
4. ⏳ Create similar tests for other services

## Key Learnings

1. **Testcontainers solves Kafka testing issues**: No more port-forward problems
2. **Real events = Real confidence**: Tests actual event flow, not mocks
3. **Singleton pattern challenges**: Need to replace singletons in tests
4. **Infrastructure setup time**: First run is slower, but subsequent runs are fast

