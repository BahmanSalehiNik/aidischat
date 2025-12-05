# Microservices Testing Strategy

## Overview

This document outlines a comprehensive testing strategy for microservices with event-driven architecture, addressing how to test flows between services, solve Kafka/Redpanda testing issues, and implement production-grade test patterns used by companies like Netflix, Uber, and Meta.

## The Problem: Testing Between Services

### Current Limitations
- ✅ **Single-service tests**: Each service tests in isolation with mocked dependencies
- ❌ **No cross-service tests**: Can't verify event flows between services
- ❌ **Kafka testing issues**: Port-forwarding doesn't work (metadata problems)
- ❌ **No contract validation**: Services might break event contracts silently

### Why This Matters
- Services depend on each other via events
- Breaking changes in event schemas break downstream services
- Integration bugs only appear in production
- Hard to verify end-to-end flows

---

## Test Pyramid for Microservices

```
           E2E Tests (<5%)
        ───────────────────────
       Contract Tests (15%)
    ─────────────────────────────
   Integration Tests (30%)
──────────────────────────────────────
Unit Tests (50%)
──────────────────────────────────────
```

### Breakdown

1. **Unit Tests (50%)**: Fast, isolated, mocked dependencies
2. **Integration Tests (30%)**: Service + real DB + real Kafka/Redis
3. **Contract Tests (15%)**: Event schema validation between services
4. **E2E Tests (<5%)**: Full cluster, all services, real infrastructure

---

## Solution 1: Integration Tests with Testcontainers

### Problem: Kafka/Redpanda Port-Forwarding Issues

**Why port-forwarding fails:**
- Kafka needs proper broker metadata
- Consumer groups require stable broker addresses
- Partition assignment fails with dynamic ports
- Metadata requests fail across port-forward boundaries

### Solution: Testcontainers

**Testcontainers** spins up real Docker containers for dependencies:
- Real Kafka/Redpanda in Docker
- Real Redis in Docker
- Real MongoDB in Docker
- All services connect to containers via Docker network

**Benefits:**
- ✅ Real Kafka behavior (no mocking)
- ✅ Proper metadata and consumer groups
- ✅ Isolated test environment
- ✅ Fast startup (~5-10 seconds)
- ✅ Works in CI/CD

### Implementation

```typescript
// Example: Integration test with Testcontainers
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { KafkaContainer } from '@testcontainers/kafka';
import { RedisContainer } from '@testcontainers/redis';
import { MongoContainer } from '@testcontainers/mongo';

describe('Chat History Service Integration', () => {
  let kafkaContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let mongoContainer: StartedTestContainer;
  
  beforeAll(async () => {
    // Start Kafka (Redpanda)
    kafkaContainer = await new GenericContainer('docker.redpanda.com/redpandadata/redpanda:latest')
      .withExposedPorts(9092)
      .withCommand(['redpanda', 'start', '--mode', 'dev-container', '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092'])
      .start();
    
    const kafkaHost = kafkaContainer.getHost();
    const kafkaPort = kafkaContainer.getMappedPort(9092);
    process.env.KAFKA_BROKER_URL = `${kafkaHost}:${kafkaPort}`;
    
    // Start Redis
    redisContainer = await new RedisContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    
    const redisHost = redisContainer.getHost();
    const redisPort = redisContainer.getMappedPort(6379);
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;
    
    // Start MongoDB
    mongoContainer = await new MongoContainer('mongo:7')
      .withExposedPorts(27017)
      .start();
    
    const mongoHost = mongoContainer.getHost();
    const mongoPort = mongoContainer.getMappedPort(27017);
    process.env.MONGO_URI = `mongodb://${mongoHost}:${mongoPort}/test`;
  });
  
  afterAll(async () => {
    await kafkaContainer.stop();
    await redisContainer.stop();
    await mongoContainer.stop();
  });
  
  it('should process message.created event and create session', async () => {
    // Test implementation
  });
});
```

---

## Solution 2: Contract Testing

### What is Contract Testing?

**Contract tests** validate that services agree on event schemas:
- Producer publishes event with schema X
- Consumer expects event with schema X
- Tests fail if schemas don't match

### Tools

1. **Pact** (Recommended)
   - Consumer-driven contracts
   - Validates event schemas
   - Detects breaking changes

2. **AsyncAPI Schema Validation**
   - JSON Schema validation
   - Type checking
   - Version compatibility

3. **Custom Schema Validator**
   - Lightweight option
   - TypeScript type checking
   - Runtime validation

### Implementation with Pact

```typescript
// chat-service (Producer) - Contract Definition
import { Pact } from '@pact-foundation/pact';

describe('Message Created Event Contract', () => {
  const provider = new Pact({
    consumer: 'chat-service',
    provider: 'chat-history-service',
    port: 1234,
    log: './pact-logs',
    dir: './pacts',
  });

  beforeAll(() => provider.setup());
  afterAll(() => provider.finalize());

  it('publishes message.created event', async () => {
    await provider.addInteraction({
      state: 'a message exists',
      uponReceiving: 'a message.created event',
      withRequest: {
        method: 'POST',
        path: '/message.created',
        headers: { 'Content-Type': 'application/json' },
        body: {
          id: like('message-123'),
          roomId: like('room-456'),
          senderId: like('user-789'),
          senderType: 'human',
          content: like('Hello'),
          createdAt: iso8601DateTime(),
        },
      },
      willRespondWith: { status: 200 },
    });
  });
});

// chat-history-service (Consumer) - Contract Verification
describe('Message Created Event Consumer', () => {
  it('consumes message.created event correctly', async () => {
    const event = {
      id: 'message-123',
      roomId: 'room-456',
      senderId: 'user-789',
      senderType: 'human',
      content: 'Hello',
      createdAt: '2024-01-01T12:00:00Z',
    };
    
    // Verify event matches contract
    await verifyMessageCreatedContract(event);
  });
});
```

---

## Solution 3: Cross-Service Integration Tests

### Architecture

**Test multiple services together with real infrastructure:**

```
Test Container Network
├── Kafka/Redpanda Container
├── Redis Container
├── MongoDB Container
├── Chat Service (Test Instance)
├── Chat History Service (Test Instance)
└── Room Service (Test Instance)
```

### Implementation Pattern

```typescript
// __tests__/cross-service/message-to-session-flow.test.ts
import { GenericContainer } from 'testcontainers';
import { KafkaContainer } from '@testcontainers/kafka';
import mongoose from 'mongoose';
import { kafkaWrapper } from '../../chat/src/kafka-client';
import { SessionManager } from '../../chat-history/src/services/session-manager';

describe('Cross-Service: Message to Session Flow', () => {
  let kafkaContainer: StartedTestContainer;
  let mongoContainer: StartedTestContainer;
  
  beforeAll(async () => {
    // Start infrastructure
    kafkaContainer = await new KafkaContainer().start();
    mongoContainer = await new MongoContainer().start();
    
    // Connect services to containers
    await kafkaWrapper.connect([`${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9092)}`], 'test-client');
    await mongoose.connect(mongoContainer.getConnectionString());
    
    // Start service listeners
    new MessageCreatedListener(kafkaWrapper.consumer('test-group')).listen();
  });
  
  it('should create session when message is created', async () => {
    // 1. Publish message.created event (simulating chat service)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-1',
      senderType: 'human',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    });
    
    // 2. Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Verify session was created
    const sessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    expect(sessions.sessions.length).toBe(1);
    expect(sessions.sessions[0].firstMessageId).toBe('msg-1');
  });
});
```

---

## Solution 4: E2E Tests with Full Cluster

### When to Use E2E Tests

- ✅ Critical user journeys
- ✅ Multi-service flows
- ✅ Production-like scenarios
- ✅ Before major releases

### E2E Test Architecture

**Option A: Local KIND Cluster**
```bash
# Start local Kubernetes cluster
kind create cluster --name test-cluster

# Deploy all services
skaffold run

# Run E2E tests
npm run test:e2e

# Cleanup
kind delete cluster --name test-cluster
```

**Option B: Docker Compose (Simpler)**
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  kafka:
    image: docker.redpanda.com/redpandadata/redpanda:latest
    # ... config
  
  redis:
    image: redis:7-alpine
  
  mongodb:
    image: mongo:7
  
  chat-service:
    build: ./backEnd/chat
    depends_on: [kafka, mongodb]
  
  chat-history-service:
    build: ./backEnd/chat-history
    depends_on: [kafka, mongodb]
  
  # ... other services
```

### E2E Test Example

```typescript
// __tests__/e2e/chat-history-flow.test.ts
describe('E2E: Chat History Flow', () => {
  beforeAll(async () => {
    // Start all services via Docker Compose or K8s
    await startTestCluster();
  });
  
  it('should create session and show in history', async () => {
    // 1. Create user
    const user = await createTestUser();
    
    // 2. Create room
    const room = await createTestRoom(user.id);
    
    // 3. Send message via API
    await fetch(`${API_BASE_URL}/api/rooms/${room.id}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({ content: 'Hello' }),
    });
    
    // 4. Wait for event processing
    await waitForEventProcessing(2000);
    
    // 5. Query chat history
    const sessions = await fetch(`${API_BASE_URL}/api/sessions`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    
    expect(sessions.sessions.length).toBe(1);
  });
});
```

---

## Test Classification

### Integration Tests vs E2E Tests

| Aspect | Integration Tests | E2E Tests |
|--------|------------------|-----------|
| **Scope** | 2-3 services | All services |
| **Infrastructure** | Testcontainers | Full cluster (K8s/Docker Compose) |
| **Speed** | Medium (5-30s) | Slow (30s-5min) |
| **Frequency** | Run on every commit | Run before releases |
| **Purpose** | Verify service interactions | Verify user journeys |
| **Cost** | Low (containers) | High (full cluster) |

### Recommendation

**Use Integration Tests for:**
- Service-to-service event flows
- Database operations
- Kafka consumer/producer behavior
- Redis operations

**Use E2E Tests for:**
- Complete user journeys
- API Gateway routing
- Multi-service workflows
- Production-like scenarios

---

## Solving the Kafka/Redpanda Problem

### Problem: Port-Forwarding Limitations

**Issues:**
- Kafka metadata requests fail
- Consumer groups don't work
- Partition assignment fails
- Broker discovery breaks

### Solution: Testcontainers

**Why it works:**
- Real Kafka in Docker container
- Proper network isolation
- Stable broker addresses
- Full Kafka functionality

### Implementation

```typescript
// test-setup/kafka-container.ts
import { GenericContainer, StartedTestContainer } from 'testcontainers';

export async function startKafkaContainer(): Promise<StartedTestContainer> {
  const container = await new GenericContainer('docker.redpanda.com/redpandadata/redpanda:latest')
    .withExposedPorts(9092)
    .withCommand([
      'redpanda',
      'start',
      '--mode', 'dev-container',
      '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092',
      '--advertise-kafka-addr', 'PLAINTEXT://localhost:9092',
    ])
    .withWaitStrategy(Wait.forLogMessage(/Started Redpanda/))
    .start();
  
  return container;
}

// Usage in tests
beforeAll(async () => {
  kafkaContainer = await startKafkaContainer();
  const brokerUrl = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9092)}`;
  process.env.KAFKA_BROKER_URL = brokerUrl;
});
```

---

## Recommended Test Structure

### Directory Organization

```
backEnd/
├── __tests__/
│   ├── unit/              # Fast, mocked
│   ├── integration/      # Service + real DB/Kafka
│   ├── contract/          # Event schema validation
│   └── e2e/               # Full cluster tests
│
└── shared/
    └── __tests__/
        ├── cross-service/ # Multi-service integration
        └── e2e/           # Full system E2E
```

### Test Scenarios

#### Scenario 1: Message → Session Flow
```typescript
// __tests__/cross-service/message-session-flow.test.ts
describe('Message to Session Flow', () => {
  it('should create session when message is created', async () => {
    // 1. Chat service publishes message.created
    // 2. Chat-history service consumes event
    // 3. Session is created
    // 4. Verify session exists
  });
});
```

#### Scenario 2: User → Post → Feed → Search
```typescript
// __tests__/e2e/user-post-feed-search.test.ts
describe('E2E: User Post Flow', () => {
  it('should propagate post through all services', async () => {
    // 1. Create user
    // 2. Create post
    // 3. Verify feed updated
    // 4. Verify search indexed
    // 5. Verify trending updated
  });
});
```

#### Scenario 3: Agent Chat Flow
```typescript
// __tests__/e2e/agent-chat-flow.test.ts
describe('E2E: Agent Chat Flow', () => {
  it('should handle agent responses and create sessions', async () => {
    // 1. User sends message
    // 2. Agent responds
    // 3. Sessions created for both
    // 4. History shows both sessions
  });
});
```

---

## Implementation Plan

### Phase 1: Testcontainers Setup (Week 1)

1. **Install Testcontainers**
   ```bash
   npm install --save-dev testcontainers @testcontainers/kafka @testcontainers/redis @testcontainers/mongo
   ```

2. **Create Test Infrastructure Helper**
   ```typescript
   // test-setup/infrastructure.ts
   export async function startTestInfrastructure() {
     // Start Kafka, Redis, MongoDB
   }
   ```

3. **Update Existing Integration Tests**
   - Replace port-forward with Testcontainers
   - Update feedback service test
   - Update chat-history service test

### Phase 2: Contract Testing (Week 2)

1. **Install Pact**
   ```bash
   npm install --save-dev @pact-foundation/pact
   ```

2. **Define Event Contracts**
   - message.created
   - user.created
   - post.created
   - friendship.accepted

3. **Add Contract Tests**
   - Producer tests (verify event shape)
   - Consumer tests (verify consumption)

### Phase 3: Cross-Service Tests (Week 3)

1. **Create Cross-Service Test Suite**
   - Message → Session flow
   - User → Post → Feed flow
   - Agent → Chat → History flow

2. **Set Up Test Orchestration**
   - Start multiple services
   - Connect via Testcontainers network
   - Verify event flows

### Phase 4: E2E Tests (Week 4)

1. **Set Up E2E Environment**
   - Docker Compose for local
   - KIND cluster for CI

2. **Create E2E Test Scenarios**
   - Critical user journeys
   - Multi-service workflows

---

## Tools & Dependencies

### Required Packages

```json
{
  "devDependencies": {
    "testcontainers": "^10.0.0",
    "@testcontainers/kafka": "^10.0.0",
    "@testcontainers/redis": "^10.0.0",
    "@testcontainers/mongo": "^10.0.0",
    "@pact-foundation/pact": "^12.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration
      # Testcontainers works in GitHub Actions (Docker-in-Docker)
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:e2e
```

---

## Best Practices from Big Companies

### Netflix Approach
- **Contract Testing**: Heavy use of Pact
- **Integration Tests**: Testcontainers for dependencies
- **E2E Tests**: Full cluster in CI, run nightly
- **Chaos Testing**: Random failures in tests

### Uber Approach
- **Service Mesh Testing**: Test with Envoy/Istio
- **Event Sourcing**: Test event replay
- **Contract Testing**: Schema validation
- **Performance Tests**: Load testing in E2E

### Meta Approach
- **Property-Based Testing**: Generate test cases
- **Fuzzing**: Random input testing
- **Contract Testing**: Strong schema validation
- **E2E Tests**: Full production-like environment

---

## What to Mock vs What to Use Real Infrastructure

### ✅ Use Real Infrastructure (Testcontainers)
- **Kafka/Redpanda**: Real events are actually published and consumed
- **Redis**: Real operations, real data structures
- **MongoDB**: Real queries, real persistence

### ❌ Mock External Services
- **Storage**: Azure Blob, AWS S3, GCP Storage (costs money, requires credentials)
- **AI Providers**: OpenAI, Anthropic, Cohere (costs money, slow, rate limits)
- **Payment**: Stripe, PayPal (costs money, requires credentials)
- **Email**: SendGrid, SES (costs money, requires credentials)

**Key Point**: Testcontainers provides **real infrastructure** for your own services (Kafka, Redis, MongoDB), but **external third-party services** should still be mocked.

See `docs/testing-what-to-mock-vs-real.md` for detailed examples.

## Summary

### Test Types

1. **Unit Tests (50%)**: Fast, isolated, mocked
2. **Integration Tests (30%)**: Service + real DB/Kafka via Testcontainers + mocked external services
3. **Contract Tests (15%)**: Event schema validation (Pact)
4. **E2E Tests (<5%)**: Full cluster, all services (external services still mocked)

### Key Solutions

1. **Testcontainers**: Solves Kafka/Redpanda testing issues, provides real infrastructure
2. **Mocking External Services**: Prevents costs, speeds up tests, no credential management
3. **Contract Testing**: Prevents breaking changes
4. **Cross-Service Tests**: Verify event flows with real Kafka
5. **E2E Tests**: Validate user journeys

### Next Steps

1. Install Testcontainers
2. Update existing integration tests
3. Add contract tests for events
4. Create cross-service test suite
5. Set up E2E test environment

