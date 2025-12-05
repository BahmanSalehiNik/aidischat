# Cross-Service Test Examples

## Overview

This document provides concrete examples of cross-service integration tests for common flows in the system.

## Example 1: Message → Session Flow

### Test: Chat Service → Chat History Service

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
    
    // Setup chat-history service
    process.env.MONGO_URI = infra.mongoUri;
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'chat-history-test');
    
    // Start listener
    new MessageCreatedListener(kafkaWrapper.consumer('test-group')).listen();
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  beforeEach(async () => {
    // Clean database
    await mongoose.connection.db.dropDatabase();
  });
  
  it('should create session when message is published', async () => {
    // 1. Chat service publishes message.created event
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'msg-1',
      roomId: 'room-1',
      senderId: 'user-1',
      senderType: 'human',
      senderName: 'Alice',
      content: 'Hello!',
      attachments: [],
      reactions: [],
      createdAt: new Date().toISOString(),
      dedupeKey: 'test-key-1',
    });
    
    // 2. Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Verify session was created
    const sessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    expect(sessions.sessions.length).toBe(1);
    expect(sessions.sessions[0].firstMessageId).toBe('msg-1');
    expect(sessions.sessions[0].roomId).toBe('room-1');
    expect(sessions.sessions[0].messageCount).toBe(1);
  });
  
  it('should update session when multiple messages are sent', async () => {
    // Send 3 messages
    for (let i = 1; i <= 3; i++) {
      await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
        id: `msg-${i}`,
        roomId: 'room-1',
        senderId: 'user-1',
        senderType: 'human',
        senderName: 'Alice',
        content: `Message ${i}`,
        attachments: [],
        reactions: [],
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        dedupeKey: `test-key-${i}`,
      });
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify single session with 3 messages
    const sessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    expect(sessions.sessions.length).toBe(1);
    expect(sessions.sessions[0].messageCount).toBe(3);
    expect(sessions.sessions[0].lastMessageId).toBe('msg-3');
  });
});
```

---

## Example 2: User → Post → Feed Flow

### Test: User Service → Post Service → Feed Service

```typescript
// __tests__/cross-service/user-post-feed-flow.test.ts
import { startTestInfrastructure, stopTestInfrastructure } from '../../test-setup/test-infrastructure';
import { kafkaWrapper } from '../../user/src/kafka-client';
import { PostCreatedPublisher } from '../../post/src/events/publishers/post-created-publisher';
import { UserCreatedPublisher } from '../../user/src/events/publishers/user-created-publisher';
import { PostCreatedListener } from '../../feed/src/events/listeners/post-created-listener';
import { UserCreatedListener } from '../../feed/src/events/listeners/user-created-listener';
import mongoose from 'mongoose';

describe('Cross-Service: User Post Feed Flow', () => {
  let infra: TestInfrastructure;
  
  beforeAll(async () => {
    infra = await startTestInfrastructure();
    
    // Setup feed service
    process.env.MONGO_URI = infra.mongoUri;
    process.env.KAFKA_BROKER_URL = infra.kafkaBrokerUrl;
    await mongoose.connect(infra.mongoUri);
    await kafkaWrapper.connect([infra.kafkaBrokerUrl], 'feed-test');
    
    // Start listeners
    new UserCreatedListener(kafkaWrapper.consumer('feed-test-user')).listen();
    new PostCreatedListener(kafkaWrapper.consumer('feed-test-post')).listen();
  });
  
  afterAll(async () => {
    await stopTestInfrastructure(infra);
    await mongoose.connection.close();
  });
  
  it('should update feed when user creates post', async () => {
    const userId = 'user-123';
    
    // 1. Create user
    await new UserCreatedPublisher(kafkaWrapper.producer).publish({
      id: userId,
      email: 'test@example.com',
      username: 'testuser',
      createdAt: new Date().toISOString(),
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Create post
    await new PostCreatedPublisher(kafkaWrapper.producer).publish({
      id: 'post-456',
      userId,
      content: 'Test post',
      visibility: 'public',
      createdAt: new Date().toISOString(),
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Verify feed was updated
    const feedItems = await FeedItem.find({ userId });
    expect(feedItems.length).toBeGreaterThan(0);
  });
});
```

---

## Example 3: Agent Chat → History Flow

### Test: Chat Service → Agent Service → Chat History Service

```typescript
// __tests__/cross-service/agent-chat-history-flow.test.ts
describe('Cross-Service: Agent Chat History Flow', () => {
  it('should create sessions for both user and agent', async () => {
    // 1. User sends message
    await publishMessageCreated({
      senderId: 'user-1',
      senderType: 'human',
      roomId: 'room-1',
    });
    
    // 2. Agent responds
    await publishMessageCreated({
      senderId: 'agent-1',
      senderType: 'agent',
      roomId: 'room-1',
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 3. Verify both sessions exist
    const userSessions = await SessionManager.getSessionsByParticipant('user-1', 'human');
    const agentSessions = await SessionManager.getSessionsByParticipant('agent-1', 'agent');
    
    expect(userSessions.sessions.length).toBe(1);
    expect(agentSessions.sessions.length).toBe(1);
  });
});
```

---

## Example 4: Complete User Journey (E2E)

### Test: User Registration → Post Creation → Feed → Search

```typescript
// __tests__/e2e/complete-user-journey.test.ts
describe('E2E: Complete User Journey', () => {
  it('should handle user registration to feed viewing', async () => {
    // 1. Register user
    const user = await registerUser({
      email: 'test@example.com',
      password: 'password123',
    });
    
    // 2. Create post
    const post = await createPost(user.token, {
      content: 'My first post',
      visibility: 'public',
    });
    
    // 3. Wait for propagation
    await waitForEventProcessing(5000);
    
    // 4. Verify feed
    const feed = await getFeed(user.token);
    expect(feed.posts.some(p => p.id === post.id)).toBe(true);
    
    // 5. Verify search
    const searchResults = await search(user.token, 'first post');
    expect(searchResults.posts.some(p => p.id === post.id)).toBe(true);
  });
});
```

---

## Test Utilities

### Helper Functions

```typescript
// test-utils/event-helpers.ts
export async function waitForEventProcessing(ms: number = 2000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Condition not met within timeout');
}

export async function publishMessageCreated(data: MessageCreatedEvent['data']) {
  await new MessageCreatedPublisher(kafkaWrapper.producer).publish(data);
}
```

---

## Best Practices

1. **Isolation**: Each test gets clean infrastructure
2. **Waiting**: Always wait for async event processing
3. **Verification**: Verify both producer and consumer sides
4. **Cleanup**: Clean data between tests, not containers
5. **Timeouts**: Use appropriate timeouts for event processing

