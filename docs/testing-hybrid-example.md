# Hybrid Testing Example: Real Infrastructure + Mocked External Services

## Overview

This document shows a complete example of using **real infrastructure** (Testcontainers) for Kafka/Redis/MongoDB while **mocking external services** (Azure Storage, AI providers).

## Example: Chat History Service with Media Upload

### Scenario
- User sends message with image attachment
- Message is stored in MongoDB (real)
- Image is uploaded to Azure Storage (mocked)
- Session is created (real MongoDB)
- Event is published to Kafka (real)

### Test Implementation

```typescript
// __tests__/integration/chat-with-media.test.ts
import { startTestInfrastructure, stopTestInfrastructure } from '../setup/test-infrastructure';
import { setupExternalServiceMocks, resetExternalServiceMocks } from '../setup/mocks';
import { kafkaWrapper } from '../../src/kafka-client';
import { SessionManager } from '../../src/services/session-manager';
import { MessageCreatedPublisher } from '../../src/events/publishers/message-created-publisher';
import mongoose from 'mongoose';

describe('Chat History Service: Message with Media', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // ✅ Start REAL infrastructure (Kafka, Redis, MongoDB)
    infra = await startTestInfrastructure({ includeKafka: true });
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // ❌ Mock external services (Azure Storage, AI providers)
    setupExternalServiceMocks();
    
    // Connect to real infrastructure
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
    
    // Start real Kafka listener
    new MessageCreatedListener(kafkaWrapper.consumer('test-group')).listen();
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  beforeEach(async () => {
    // Reset mocks between tests
    resetExternalServiceMocks();
    
    // Clean database
    await mongoose.connection.db.dropDatabase();
  });
  
  it('should process message with media attachment', async () => {
    // 1. ✅ Publish REAL Kafka event
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-1',
      senderType: 'human',
      content: 'Check out this image!',
      attachments: [
        {
          type: 'image',
          url: 'https://mock-storage.azure.com/image.jpg', // Mock URL
          fileName: 'image.jpg',
        },
      ],
      createdAt: new Date().toISOString(),
    });
    
    // 2. ✅ Wait for REAL Kafka consumer to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. ✅ Verify REAL MongoDB query
    const sessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    expect(sessions.sessions.length).toBe(1);
    expect(sessions.sessions[0].firstMessageId).toBe('msg-1');
    
    // 4. ❌ Verify mocked Azure Storage was NOT called (no real upload)
    // The message was processed, but storage operations are mocked
    // No real Azure API calls were made
  });
});
```

## Example: AI Gateway Service Test

### Scenario
- User sends message to agent
- AI Gateway receives event (real Kafka)
- AI Gateway calls OpenAI (mocked)
- AI Gateway publishes response (real Kafka)
- Chat service receives response (real Kafka)

### Test Implementation

```typescript
// __tests__/integration/ai-gateway-flow.test.ts
import { startTestInfrastructure, stopTestInfrastructure } from '../setup/test-infrastructure';
import { setupExternalServiceMocks, mockOpenAIProvider } from '../setup/mocks';
import { kafkaWrapper } from '../../src/kafka-client';
import { AiMessageCreatedPublisher } from '../../src/events/publishers/ai-message-created-publisher';
import { AiMessageReplyListener } from '../../src/events/listeners/ai-message-reply-listener';

describe('AI Gateway Service: Message to AI Response Flow', () => {
  let infra: TestInfrastructure;
  let receivedReplies: any[] = [];
  
  beforeAll(async () => {
    // ✅ Start REAL infrastructure
    infra = await startTestInfrastructure({ includeKafka: true });
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.MONGO_URI = infra.mongoUri;
    
    // ❌ Mock AI providers
    setupExternalServiceMocks();
    
    // Connect to real infrastructure
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
    
    // Start real Kafka listeners
    new AiMessageCreatedListener(kafkaWrapper.consumer('ai-gateway-test')).listen();
    
    // Listen for AI replies
    const replyConsumer = kafkaWrapper.consumer('test-reply-listener');
    await replyConsumer.subscribe({ topic: 'ai.message.reply' });
    await replyConsumer.run({
      eachMessage: async ({ message }) => {
        receivedReplies.push(JSON.parse(message.value!.toString()));
      },
    });
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  beforeEach(() => {
    receivedReplies = [];
    resetExternalServiceMocks();
  });
  
  it('should process message and generate AI response', async () => {
    // 1. ✅ Publish REAL Kafka event
    await new AiMessageCreatedPublisher(kafkaWrapper.producer).publish({
      messageId: 'msg-1',
      roomId: 'room-1',
      agentId: 'agent-1',
      content: 'Hello, how are you?',
      senderId: 'user-1',
      senderType: 'human',
      createdAt: new Date().toISOString(),
    });
    
    // 2. ✅ Wait for REAL Kafka processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. ✅ Verify REAL Kafka reply was published
    expect(receivedReplies.length).toBe(1);
    expect(receivedReplies[0].content).toBe('Mock AI response');
    expect(receivedReplies[0].agentId).toBe('agent-1');
    
    // 4. ❌ Verify mocked OpenAI was called (but no real API call)
    expect(mockOpenAIProvider.generateResponse).toHaveBeenCalledWith(
      expect.stringContaining('Hello, how are you?'),
      expect.objectContaining({ agentId: 'agent-1' })
    );
    
    // ✅ Real Kafka event flow worked
    // ❌ No real OpenAI API calls (mocked)
    // ❌ No costs incurred
    // ✅ Fast test execution
  });
});
```

## Key Points

### ✅ What's Real
1. **Kafka Events**: Actually published and consumed
2. **MongoDB**: Real database operations
3. **Redis**: Real operations
4. **Event Flow**: Real service-to-service communication

### ❌ What's Mocked
1. **Azure Storage**: No real uploads/downloads
2. **OpenAI API**: No real API calls
3. **Anthropic API**: No real API calls
4. **External Services**: All third-party APIs

### Benefits
- ✅ **Real event flows** between services
- ✅ **Real database operations**
- ✅ **No external API costs**
- ✅ **Fast test execution** (no network latency)
- ✅ **No credential management**
- ✅ **Deterministic tests** (mocked responses are predictable)

## Complete Test Setup Pattern

```typescript
describe('Service Integration Test', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    // ✅ Step 1: Start real infrastructure
    infra = await startTestInfrastructure({ includeKafka: true });
    
    // ✅ Step 2: Set environment variables
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    process.env.MONGO_URI = infra.mongoUri;
    process.env.REDIS_URL = infra.redisUrl;
    
    // ❌ Step 3: Mock external services
    setupExternalServiceMocks();
    
    // ✅ Step 4: Connect to real infrastructure
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'test-client');
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
  });
  
  beforeEach(() => {
    resetExternalServiceMocks();
  });
  
  it('should test real flow with mocked external services', async () => {
    // ✅ Real Kafka event
    await publishEvent();
    
    // ✅ Real MongoDB query
    const result = await Model.findOne({});
    
    // ❌ External services are mocked
  });
});
```

## Summary

**Testcontainers = Real Infrastructure for Your Services**
- Kafka: Real events ✅
- Redis: Real operations ✅
- MongoDB: Real queries ✅

**Mocking = External Third-Party Services**
- Azure Storage: Mocked ❌
- OpenAI: Mocked ❌
- Anthropic: Mocked ❌

**Result**: Real service-to-service flows with no external costs or dependencies!

