# Testing Implementation Plan

## Overview

This document provides a step-by-step plan to implement cross-service testing using Testcontainers, solving the Kafka/Redpanda testing issues.

## Phase 1: Setup Testcontainers (Week 1)

### Step 1: Install Dependencies

```bash
# In each service that needs testing
cd backEnd/feedback
npm install --save-dev testcontainers @testcontainers/kafka @testcontainers/redis

cd backEnd/chat-history
npm install --save-dev testcontainers @testcontainers/kafka @testcontainers/mongo

# In root for shared test utilities
npm install --save-dev testcontainers @testcontainers/kafka @testcontainers/redis @testcontainers/mongo
```

### Step 2: Create Test Infrastructure Helper

Create `test-setup/test-infrastructure.ts` (see example above)

### Step 3: Update Existing Tests

Update `feedback/src/__tests__/integration/feedback-flow.test.ts`:
- Replace port-forward Redis with Testcontainers
- Add Kafka support (optional for now)

---

## Phase 2: Cross-Service Tests (Week 2)

### Step 1: Create Cross-Service Test Suite

Create `__tests__/cross-service/` directory with:
- `message-session-flow.test.ts`
- `user-post-feed-flow.test.ts`
- `agent-chat-flow.test.ts`

### Step 2: Test Message → Session Flow

Verify chat service events create sessions in chat-history service.

### Step 3: Test User → Post → Feed Flow

Verify user creation → post creation → feed update flow.

---

## Phase 3: Contract Testing (Week 3)

### Step 1: Install Pact

```bash
npm install --save-dev @pact-foundation/pact
```

### Step 2: Define Event Contracts

Create contracts for:
- `message.created`
- `user.created`
- `post.created`
- `friendship.accepted`

### Step 3: Add Contract Tests

- Producer tests (verify event shape)
- Consumer tests (verify consumption)

---

## Phase 4: E2E Tests (Week 4)

### Step 1: Set Up E2E Environment

- Docker Compose for local
- KIND cluster for CI

### Step 2: Create E2E Scenarios

- Complete user journeys
- Multi-service workflows

---

## Quick Start: Update Feedback Test

### Current Test (Port-Forward)

```typescript
// ❌ Kafka not tested due to port-forward limitations
const TEST_REDIS_URL = process.env.REDIS_FEEDBACK_URL || 'redis://localhost:6379';
```

### Updated Test (Testcontainers)

```typescript
// ✅ Kafka and Redis work perfectly
import { startTestInfrastructure, stopTestInfrastructure } from '../setup/test-infrastructure';

let infra: TestInfrastructure;

beforeAll(async () => {
  infra = await startTestInfrastructure({ includeKafka: true });
  process.env.REDIS_FEEDBACK_URL = infra.redisUrl;
  process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
  process.env.MONGO_URI = infra.mongoUri;
});

afterAll(async () => {
  await stopTestInfrastructure(infra);
});
```

---

## Test Classification Summary

| Test Type | Scope | Infrastructure | Speed | When to Use |
|-----------|-------|---------------|-------|-------------|
| **Unit** | Single service, single module | Mocked | Fast (<100ms) | Every commit |
| **Integration** | Single service + real DB/Kafka | Testcontainers | Medium (5-30s) | Every commit |
| **Contract** | Event schemas between services | Pact/AsyncAPI | Medium (1-5s) | Every commit |
| **Cross-Service** | 2-3 services + events | Testcontainers | Medium (10-60s) | Before merge |
| **E2E** | All services + full cluster | K8s/Docker Compose | Slow (30s-5min) | Before release |

---

## Answer to Your Questions

### Q: Are these E2E tests or Integration tests?

**Answer:**
- **Cross-service tests with Testcontainers = Integration Tests**
  - Test 2-3 services together
  - Use Testcontainers for infrastructure
  - Medium speed (10-60s)
  - Run on every commit
  
- **Full cluster tests = E2E Tests**
  - Test all services
  - Use K8s or Docker Compose
  - Slow (30s-5min)
  - Run before releases

### Q: How do big companies test between services?

**Answer:**
1. **Netflix**: Testcontainers + Pact + E2E cluster
2. **Uber**: Service mesh testing + Contract tests
3. **Meta**: Property-based testing + Contract tests + E2E

**Common Pattern:**
- Integration tests with Testcontainers (most common)
- Contract tests for events (critical)
- E2E tests for user journeys (selective)

### Q: How to solve Kafka/Redpanda testing problem?

**Answer:**
- **Use Testcontainers** (not port-forwarding)
- Real Kafka in Docker container
- Proper metadata and consumer groups
- Works in CI/CD

---

## Next Steps

1. ✅ Install Testcontainers
2. ✅ Create test infrastructure helper
3. ⏳ Update feedback service test
4. ⏳ Create cross-service test suite
5. ⏳ Add contract tests
6. ⏳ Set up E2E environment

