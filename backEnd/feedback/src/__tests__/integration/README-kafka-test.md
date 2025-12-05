# Kafka Integration Test - Status

## Test File
`feedback-flow-kafka.test.ts` - Tests feedback service with real Kafka events using Testcontainers

## Current Issue

The `redisFeedback` singleton is created at module import time, which means it may try to connect to the default URL (`redis-feedback-srv:6379`) before we can set the test Redis URL.

## Solution Applied

1. **Test Infrastructure Setup**: Modified `test-infrastructure.ts` to start Redis FIRST and set `REDIS_FEEDBACK_URL` environment variable immediately
2. **Dynamic Imports**: Using dynamic imports for modules that depend on `redisFeedback` to ensure they load after the env var is set
3. **Reconnection Logic**: Added logic to disconnect and reconnect `redisFeedback` if it's connected to the wrong URL

## How to Run

```bash
cd backEnd/feedback
npm run test:integration -- feedback-flow-kafka.test.ts
```

## Expected Behavior

1. Testcontainers starts Kafka (Redpanda), Redis, and MongoDB
2. Environment variables are set
3. Real Kafka events are published (`agent.created`, `feedback.reaction.received`)
4. Real listeners consume events and process them
5. Redis sliding window is verified
6. MongoDB aggregations are updated
7. `agent.learning.updated` event is published and verified

## Known Issues

- If `redisFeedback` singleton is already created (from other test files), it may need to be disconnected and reconnected
- The test may take 1-2 minutes to start due to container initialization

## Next Steps

If the test still fails with Redis connection errors:
1. Ensure no other test files import `redis-client` before this test runs
2. Consider modifying `redis-client.ts` to support reconnection or lazy initialization
3. Or use Jest's `--runInBand` flag to ensure tests run sequentially

