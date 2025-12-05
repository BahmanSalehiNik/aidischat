# Testcontainers Setup Guide

## Overview

This guide shows how to set up Testcontainers to solve Kafka/Redpanda testing issues and enable cross-service integration tests.

## Problem: Why Port-Forwarding Fails

### Kafka/Redpanda Issues with Port-Forwarding

1. **Metadata Problems**
   - Kafka needs stable broker addresses
   - Port-forwarding creates dynamic addresses
   - Consumer groups fail to initialize
   - Partition assignment breaks

2. **Network Isolation**
   - Services can't discover brokers
   - Metadata requests fail
   - Consumer group coordination breaks

3. **Consumer Group Issues**
   - Groups require stable broker connections
   - Rebalancing fails with dynamic ports
   - Messages get stuck or lost

### Solution: Testcontainers

**Testcontainers** provides:
- Real Kafka/Redpanda in Docker containers
- Stable network addresses
- Proper metadata handling
- Full Kafka functionality

---

## Installation

### 1. Install Dependencies

```bash
npm install --save-dev testcontainers @testcontainers/kafka @testcontainers/redis @testcontainers/mongo
```

### 2. Install Docker

Testcontainers requires Docker to be running:
```bash
# Verify Docker is running
docker ps
```

---

## Basic Setup

### Create Test Infrastructure Helper

```typescript
// test-setup/test-infrastructure.ts
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { RedisContainer } from '@testcontainers/redis';
import { MongoContainer } from '@testcontainers/mongo';

export interface TestInfrastructure {
  kafka: StartedTestContainer;
  redis: StartedTestContainer;
  mongo: StartedTestContainer;
  kafkaBrokerUrl: string;
  redisUrl: string;
  mongoUri: string;
}

export async function startTestInfrastructure(): Promise<TestInfrastructure> {
  console.log('🚀 Starting test infrastructure...');
  
  // Start Kafka (Redpanda)
  console.log('📦 Starting Kafka container...');
  const kafkaContainer = await new GenericContainer('docker.redpanda.com/redpandadata/redpanda:latest')
    .withExposedPorts(9092)
    .withCommand([
      'redpanda',
      'start',
      '--mode', 'dev-container',
      '--smp', '1',
      '--overprovisioned',
      '--node-id', '0',
      '--kafka-addr', 'PLAINTEXT://0.0.0.0:9092',
      '--advertise-kafka-addr', 'PLAINTEXT://localhost:9092',
      '--memory', '512M',
    ])
    .withWaitStrategy(Wait.forLogMessage(/Started Redpanda/))
    .withStartupTimeout(60000)
    .start();
  
  const kafkaHost = kafkaContainer.getHost();
  const kafkaPort = kafkaContainer.getMappedPort(9092);
  const kafkaBrokerUrl = `${kafkaHost}:${kafkaPort}`;
  
  console.log(`✅ Kafka started at ${kafkaBrokerUrl}`);
  
  // Start Redis
  console.log('📦 Starting Redis container...');
  const redisContainer = await new RedisContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
  
  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  
  console.log(`✅ Redis started at ${redisUrl}`);
  
  // Start MongoDB
  console.log('📦 Starting MongoDB container...');
  const mongoContainer = await new MongoContainer('mongo:7')
    .withExposedPorts(27017)
    .withWaitStrategy(Wait.forLogMessage(/Waiting for connections/))
    .start();
  
  const mongoHost = mongoContainer.getHost();
  const mongoPort = mongoContainer.getMappedPort(27017);
  const mongoUri = `mongodb://${mongoHost}:${mongoPort}/test`;
  
  console.log(`✅ MongoDB started at ${mongoUri}`);
  
  return {
    kafka: kafkaContainer,
    redis: redisContainer,
    mongo: mongoContainer,
    kafkaBrokerUrl,
    redisUrl,
    mongoUri,
  };
}

export async function stopTestInfrastructure(infra: TestInfrastructure): Promise<void> {
  console.log('🛑 Stopping test infrastructure...');
  await Promise.all([
    infra.kafka.stop(),
    infra.redis.stop(),
    infra.mongo.stop(),
  ]);
  console.log('✅ Test infrastructure stopped');
}
```

---

## Updated Integration Test Example

### Before (Port-Forward - Broken)

```typescript
// ❌ This doesn't work with Kafka
const TEST_REDIS_URL = process.env.REDIS_FEEDBACK_URL || 'redis://localhost:6379';
// Kafka not tested due to port-forward limitations
```

### After (Testcontainers - Works)

```typescript
// ✅ This works perfectly
import { startTestInfrastructure, stopTestInfrastructure } from '../test-setup/test-infrastructure';

describe('Feedback Service Integration Test', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    infra = await startTestInfrastructure();
    
    // Set environment variables
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.REDIS_FEEDBACK_URL = infra.redisUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // Connect services
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  it('should process Kafka events correctly', async () => {
    // Now Kafka works perfectly!
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-1',
      roomId: 'room-1',
      // ...
    });
    
    // Wait for consumer to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify processing
    // ...
  });
});
```

---

## Cross-Service Test Example

```typescript
// __tests__/cross-service/message-session-flow.test.ts
import { startTestInfrastructure, stopTestInfrastructure } from '../../test-setup/test-infrastructure';
import { kafkaWrapper } from '../../chat/src/kafka-client';
import { SessionManager } from '../../chat-history/src/services/session-manager';
import { MessageCreatedListener } from '../../chat-history/src/events/listeners/message-created-listener';
import { MessageCreatedPublisher } from '../../chat/src/events/publishers/message-created-publisher';
import mongoose from 'mongoose';

describe('Cross-Service: Message to Session Flow', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    infra = await startTestInfrastructure();
    
    // Connect chat-history service
    process.env.MONGO_URI = infra.mongoUri;
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
    
    // Start listener
    new MessageCreatedListener(kafkaWrapper.consumer('test-group')).listen();
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  it('should create session when chat service publishes message', async () => {
    // 1. Chat service publishes event (simulated)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-123',
      roomId: 'room-456',
      senderId: 'user-789',
      senderType: 'human',
      content: 'Hello world',
      createdAt: new Date().toISOString(),
    });
    
    // 2. Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Verify session was created
    const sessions = await SessionManager.getSessionsByParticipant('user-789', 'human');
    expect(sessions.sessions.length).toBe(1);
    expect(sessions.sessions[0].firstMessageId).toBe('msg-123');
  });
});
```

---

## Performance Considerations

### Container Startup Time

- **First run**: ~30-60 seconds (download images)
- **Subsequent runs**: ~5-10 seconds (cached images)
- **Parallel tests**: Share containers across tests

### Optimization Tips

1. **Reuse Containers**
   ```typescript
   // Share containers across test files
   let sharedInfra: TestInfrastructure;
   
   beforeAll(async () => {
     if (!sharedInfra) {
       sharedInfra = await startTestInfrastructure();
     }
   });
   ```

2. **Parallel Test Execution**
   - Use separate containers per test file
   - Or use container reuse with proper cleanup

3. **Fast Cleanup**
   ```typescript
   afterEach(async () => {
     // Clean data, not containers
     await mongoose.connection.db.dropDatabase();
   });
   ```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration
      # Testcontainers works in GitHub Actions (Docker-in-Docker)
```

### Docker-in-Docker

GitHub Actions supports Docker-in-Docker:
- Testcontainers works automatically
- No special configuration needed
- Containers run in isolated environment

---

## Troubleshooting

### Issue: Containers Not Starting

**Solution:**
```bash
# Check Docker is running
docker ps

# Check Docker permissions
docker info

# Increase Docker memory (if needed)
# Docker Desktop → Settings → Resources → Memory
```

### Issue: Port Conflicts

**Solution:**
- Testcontainers automatically assigns random ports
- No port conflicts possible
- Use `getMappedPort()` to get actual port

### Issue: Slow Startup

**Solution:**
- Pre-pull images: `docker pull docker.redpanda.com/redpandadata/redpanda:latest`
- Use smaller images (alpine variants)
- Reuse containers across tests

---

## Migration Guide

### Step 1: Update Existing Tests

```typescript
// Before
const TEST_REDIS_URL = process.env.REDIS_FEEDBACK_URL || 'redis://localhost:6379';
// Kafka not tested

// After
const infra = await startTestInfrastructure();
process.env.REDIS_FEEDBACK_URL = infra.redisUrl;
process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
// Kafka now works!
```

### Step 2: Add Kafka Tests

```typescript
it('should process Kafka events', async () => {
  // Now you can test Kafka!
  await publishEvent();
  await waitForProcessing();
  await verifyResult();
});
```

### Step 3: Create Cross-Service Tests

```typescript
// Test multiple services together
describe('Cross-Service Flow', () => {
  // Test service A → Kafka → Service B
});
```

---

## Benefits

✅ **Solves Kafka Issues**: Real Kafka, proper metadata
✅ **Fast**: Containers start in 5-10 seconds
✅ **Isolated**: Each test gets clean environment
✅ **CI/CD Ready**: Works in GitHub Actions
✅ **Real Behavior**: No mocking, real Kafka behavior
✅ **Cross-Service**: Test multiple services together

---

## Next Steps

1. Install Testcontainers
2. Create test infrastructure helper
3. Update existing integration tests
4. Add Kafka event tests
5. Create cross-service test suite

