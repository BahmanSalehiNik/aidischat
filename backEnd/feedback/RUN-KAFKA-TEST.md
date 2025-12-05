# Running the Kafka Integration Test

## Quick Start

To run ONLY the Kafka test (avoiding Redis singleton issues from other tests):

```bash
cd backEnd/feedback
npx jest src/__tests__/integration/feedback-flow-kafka.test.ts --runInBand --no-cache
```

## What This Test Does

1. ✅ Starts real Kafka (Redpanda), Redis, and MongoDB using Testcontainers
2. ✅ Publishes `agent.created` event to Kafka (real event)
3. ✅ Publishes `feedback.reaction.received` events to Kafka (real events)
4. ✅ Real listeners consume and process events
5. ✅ Verifies Redis sliding window
6. ✅ Verifies MongoDB aggregations
7. ✅ Verifies `agent.learning.updated` event is published

## Expected Output

You should see:
- ✅ Infrastructure starting (Kafka, Redis, MongoDB)
- ✅ Events being published and consumed
- ✅ Redis window verification
- ✅ MongoDB aggregation updates
- ✅ Learning summary updates
- ✅ `agent.learning.updated` event received

## Troubleshooting

### Redis Connection Errors

If you see `getaddrinfo EAI_AGAIN redis-feedback-srv`:
- This means `redisFeedback` singleton was created before test Redis was ready
- Solution: Run ONLY this test file (command above)
- Or: Ensure `REDIS_FEEDBACK_URL` is set before any imports

### Test Timeout

The test has a 2-minute timeout for infrastructure setup. If it times out:
- Check Docker is running
- Check Testcontainers can pull images
- Increase timeout in test file if needed

## Success Criteria

✅ Test passes
✅ All events are published and consumed
✅ Redis window contains correct items
✅ MongoDB aggregations are updated
✅ Learning summary has numeric scores
✅ `agent.learning.updated` event is received

