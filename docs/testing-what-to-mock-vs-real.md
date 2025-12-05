# Testing: What to Mock vs What to Use Real Infrastructure

## Overview

This document clarifies what should be **mocked** vs what should use **real infrastructure** (Testcontainers) in tests.

## Key Principle

**Use Real Infrastructure For:**
- ✅ Services you own and control (Kafka, Redis, MongoDB)
- ✅ Internal event flows between your services
- ✅ Database operations
- ✅ Message queue operations

**Mock External Services:**
- ❌ Third-party APIs (OpenAI, Anthropic, Azure Storage)
- ❌ Cloud storage (AWS S3, Azure Blob, GCP Storage)
- ❌ Payment providers (Stripe, PayPal)
- ❌ Email services (SendGrid, SES)
- ❌ Any service that costs money or requires credentials

---

## Real Infrastructure (Testcontainers)

### ✅ Use Real Kafka/Redpanda

**Why:**
- Events are **actually published and consumed**
- Real consumer groups, partitions, offsets
- Tests real event flow between services
- No mocking needed

**Example:**
```typescript
// ✅ REAL Kafka - Events are actually published
await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
  id: 'msg-1',
  roomId: 'room-1',
  // ...
});

// Consumer actually receives the event
await new Promise(resolve => setTimeout(resolve, 2000));
// Event was processed by real consumer
```

### ✅ Use Real Redis

**Why:**
- Real Redis operations (GET, SET, INCR, etc.)
- Real sliding windows, rate limiting
- Tests actual Redis behavior

**Example:**
```typescript
// ✅ REAL Redis - Operations are real
await redisClient.set('key', 'value');
const value = await redisClient.get('key'); // Real Redis operation
```

### ✅ Use Real MongoDB

**Why:**
- Real database operations
- Real queries, aggregations, indexes
- Tests actual data persistence

**Example:**
```typescript
// ✅ REAL MongoDB - Data is actually stored
await Session.create({ roomId: 'room-1', ... });
const session = await Session.findOne({ roomId: 'room-1' }); // Real query
```

---

## Mock External Services

### ❌ Mock Azure Storage / AWS S3 / GCP Storage

**Why:**
- Costs money per operation
- Requires credentials
- Slow network calls
- Not part of your core system

**How to Mock:**
```typescript
// ❌ Mock Azure Storage
jest.mock('../../storage/azureStorageGateway', () => ({
  AzureStorageGateway: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue({
      url: 'https://mock-storage.com/file.jpg',
      signedUrl: 'https://mock-storage.com/file.jpg?signature=mock',
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    generateSignedUrl: jest.fn().mockResolvedValue('https://mock-storage.com/file.jpg?signature=mock'),
  })),
}));
```

**Test Example:**
```typescript
it('should upload file and return signed URL', async () => {
  const storage = new AzureStorageGateway('account', 'key');
  const result = await storage.uploadFile('file.jpg', Buffer.from('data'));
  
  expect(result.url).toBe('https://mock-storage.com/file.jpg');
  expect(storage.uploadFile).toHaveBeenCalledWith('file.jpg', expect.any(Buffer));
});
```

### ❌ Mock AI Providers (OpenAI, Anthropic, Cohere)

**Why:**
- Costs money per API call
- Requires API keys
- Slow (network latency)
- Rate limits in tests
- Unpredictable responses

**How to Mock:**
```typescript
// ❌ Mock OpenAI Provider
jest.mock('../../providers/openai-provider', () => ({
  OpenAIProvider: jest.fn().mockImplementation(() => ({
    generateResponse: jest.fn().mockResolvedValue({
      content: 'Mock AI response',
      model: 'gpt-4',
      usage: { promptTokens: 10, completionTokens: 5 },
    }),
    createAssistant: jest.fn().mockResolvedValue({
      assistantId: 'mock-assistant-id',
      threadId: 'mock-thread-id',
    }),
  })),
}));
```

**Test Example:**
```typescript
it('should generate AI response', async () => {
  const provider = new OpenAIProvider('mock-api-key');
  const response = await provider.generateResponse('Hello', { agentId: 'agent-1' });
  
  expect(response.content).toBe('Mock AI response');
  expect(provider.generateResponse).toHaveBeenCalledWith('Hello', { agentId: 'agent-1' });
});
```

### ❌ Mock Payment Providers

**Why:**
- Costs money (even test transactions)
- Requires credentials
- Complex setup

**How to Mock:**
```typescript
// ❌ Mock Stripe
jest.mock('stripe', () => ({
  Stripe: jest.fn().mockImplementation(() => ({
    charges: {
      create: jest.fn().mockResolvedValue({ id: 'ch_mock', status: 'succeeded' }),
    },
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_mock' }),
    },
  })),
}));
```

---

## Hybrid Approach: Real Infrastructure + Mocked External Services

### Example: Chat History Service Test

```typescript
describe('Chat History Service Integration', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // ✅ Real infrastructure
    infra = await startTestInfrastructure({ includeKafka: true });
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // ❌ Mock external services
    jest.mock('../../storage/azureStorageGateway', () => ({
      AzureStorageGateway: jest.fn().mockImplementation(() => ({
        generateSignedUrl: jest.fn().mockResolvedValue('https://mock.com/file.jpg'),
      })),
    }));
  });
  
  it('should process message event and create session', async () => {
    // ✅ Real Kafka event
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-1',
      roomId: 'room-1',
      // ...
    });
    
    // ✅ Real MongoDB query
    await new Promise(resolve => setTimeout(resolve, 2000));
    const sessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    expect(sessions.sessions.length).toBe(1);
    
    // ❌ Storage operations are mocked (no real Azure calls)
  });
});
```

---

## Complete Test Example: AI Gateway Service

```typescript
describe('AI Gateway Service Integration', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // ✅ Real infrastructure
    infra = await startTestInfrastructure({ includeKafka: true });
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // ❌ Mock AI providers
    jest.mock('../../providers/openai-provider', () => ({
      OpenAIProvider: jest.fn().mockImplementation(() => ({
        generateResponse: jest.fn().mockResolvedValue({
          content: 'Mock AI response',
          model: 'gpt-4',
        }),
      })),
    }));
    
    jest.mock('../../providers/anthropic-provider', () => ({
      AnthropicProvider: jest.fn().mockImplementation(() => ({
        generateResponse: jest.fn().mockResolvedValue({
          content: 'Mock Claude response',
          model: 'claude-3-opus',
        }),
      })),
    }));
  });
  
  it('should process AI message and generate response', async () => {
    // ✅ Real Kafka: Publish AI message event
    await new AiMessageCreatedPublisher(kafkaWrapper.producer).publish({
      messageId: 'msg-1',
      roomId: 'room-1',
      agentId: 'agent-1',
      content: 'Hello',
      // ...
    });
    
    // ✅ Real Kafka: Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // ✅ Real Kafka: Verify response event was published
    // (Check that ai.message.reply event was published)
    
    // ❌ AI provider was mocked (no real API calls)
    // ❌ No costs incurred
    // ❌ Fast test execution
  });
});
```

---

## Decision Matrix

| Service | Mock or Real? | Reason |
|---------|---------------|--------|
| **Kafka/Redpanda** | ✅ Real (Testcontainers) | Own infrastructure, need real events |
| **Redis** | ✅ Real (Testcontainers) | Own infrastructure, need real operations |
| **MongoDB** | ✅ Real (Testcontainers) | Own infrastructure, need real queries |
| **Azure Storage** | ❌ Mock | External, costs money, requires credentials |
| **AWS S3** | ❌ Mock | External, costs money, requires credentials |
| **GCP Storage** | ❌ Mock | External, costs money, requires credentials |
| **OpenAI API** | ❌ Mock | External, costs money, slow, rate limits |
| **Anthropic API** | ❌ Mock | External, costs money, slow, rate limits |
| **Cohere API** | ❌ Mock | External, costs money, slow, rate limits |
| **Stripe** | ❌ Mock | External, costs money, requires credentials |
| **SendGrid** | ❌ Mock | External, costs money, requires credentials |

---

## Best Practices

### 1. Mock External Services at the Interface Level

```typescript
// ✅ Good: Mock the gateway interface
jest.mock('../../storage/storageGateway', () => ({
  StorageGateway: jest.fn().mockImplementation(() => ({
    uploadFile: jest.fn().mockResolvedValue({ url: 'mock-url' }),
  })),
}));

// ❌ Bad: Mock the entire Azure SDK
jest.mock('@azure/storage-blob'); // Too low-level
```

### 2. Use Real Infrastructure for Core Flows

```typescript
// ✅ Good: Test real event flow
it('should process message.created event', async () => {
  await publishEvent(); // Real Kafka
  await waitForProcessing();
  await verifyResult(); // Real MongoDB
});

// ❌ Bad: Mock everything
it('should process message.created event', async () => {
  mockKafka.publish.mockResolvedValue(undefined); // Mocked
  mockMongo.findOne.mockResolvedValue({}); // Mocked
  // Doesn't test real flow
});
```

### 3. Mock External Services, Test Real Integration

```typescript
// ✅ Good: Mock external, test real integration
it('should upload file and create media record', async () => {
  const mockStorage = {
    uploadFile: jest.fn().mockResolvedValue({ url: 'mock-url' }),
  };
  
  // Real MongoDB
  const media = await Media.create({
    url: 'mock-url',
    // ...
  });
  
  expect(media.url).toBe('mock-url');
  expect(mockStorage.uploadFile).toHaveBeenCalled();
});
```

---

## Summary

### ✅ Use Real Infrastructure (Testcontainers)
- **Kafka/Redpanda**: Real events, real consumer groups
- **Redis**: Real operations, real data structures
- **MongoDB**: Real queries, real persistence

### ❌ Mock External Services
- **Storage**: Azure, AWS, GCP (costs money, requires credentials)
- **AI Providers**: OpenAI, Anthropic, Cohere (costs money, slow, rate limits)
- **Payment**: Stripe, PayPal (costs money, requires credentials)
- **Email**: SendGrid, SES (costs money, requires credentials)

### Result
- **Real event flows** between your services ✅
- **Real database operations** ✅
- **No external API costs** ✅
- **Fast test execution** ✅
- **No credential management** ✅

---

## Example: Complete Test Setup

```typescript
describe('Service Integration Test', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // ✅ Start real infrastructure
    infra = await startTestInfrastructure({ includeKafka: true });
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.REDIS_URL = infra.redisUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // ❌ Mock external services
    jest.mock('../../storage/azureStorageGateway');
    jest.mock('../../providers/openai-provider');
    
    // Connect to real infrastructure
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
  });
  
  it('should process real events with mocked external services', async () => {
    // ✅ Real Kafka event
    await publishEvent();
    
    // ✅ Real MongoDB query
    const result = await Model.findOne({});
    
    // ❌ Storage operations are mocked (no real Azure calls)
    // ❌ AI operations are mocked (no real OpenAI calls)
  });
});
```

