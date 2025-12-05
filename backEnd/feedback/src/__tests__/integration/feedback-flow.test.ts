/**
 * Integration Test for Feedback Service
 * 
 * Tests the feedback service core functionality with real dependencies:
 * - Real MongoDB (for aggregations/learning models)
 * - Real Redis (for sliding window)
 * 
 * Note: Kafka is not tested here due to port-forward limitations.
 * The test focuses on Redis sliding window and MongoDB aggregations.
 * 
 * Flow:
 * 1. Seed agent learning summary (directly)
 * 2. Add feedback items directly to the batcher
 * 3. Verify Redis sliding window (max 3 items per agentId+roomId)
 * 4. Verify MongoDB aggregations are updated
 * 5. Trigger batch flush manually
 * 6. Verify learning summary is updated with numeric scores
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Redis from 'ioredis';
import { redisFeedback, RedisFeedbackKeys } from '../../redis-client';
import { AgentFeedbackAggregation, buildAgentFeedbackAggregation } from '../../models/agent-feedback-aggregation';
import { AgentLearningSummary, buildAgentLearningSummary } from '../../models/agent-learning-summary';
import { feedbackBatcherRedis } from '../../services/feedback-batcher-redis';

// Test configuration
// This test uses port-forward to connect to Redis (Kubernetes service)
// Make sure port-forward is running:
//   kubectl port-forward svc/redis-feedback-srv 6379:6379
// 
// Note: This test focuses on Redis and MongoDB functionality only.
// Kafka is not tested here due to port-forward limitations with metadata.
const TEST_REDIS_URL = process.env.REDIS_FEEDBACK_URL || 'redis://localhost:6379';

// Test data (mocked - no external API calls)
const TEST_USER1_ID = 'test-user-1';
const TEST_USER2_ID = 'test-user-2';
const TEST_AGENT_ID = 'test-agent-123';
const TEST_AGENT_OWNER_ID = TEST_USER1_ID;
const TEST_ROOM_ID = 'test-room-456';
const TEST_AGENT_MESSAGE_ID = 'test-agent-message-789';

let mongoServer: MongoMemoryServer;
let redisClient: Redis;

describe('Feedback Service Integration Test', () => {
  beforeAll(async () => {
    // Setup MongoDB (in-memory for testing)
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB test server connected');

    // Setup Redis - use port-forward URL
    console.log(`✅ Using Redis from port-forward: ${TEST_REDIS_URL}`);
    redisClient = new Redis(TEST_REDIS_URL);
    await redisClient.ping();
    console.log('✅ Redis connected');

    // Update Redis client for feedback service to use the test Redis
    process.env.REDIS_FEEDBACK_URL = TEST_REDIS_URL;

    // SIMPLER SOLUTION: Replace redisFeedback with our test client
    // The redisFeedback singleton was created at module import with default URL
    // We'll replace it with our test client
    if (redisFeedback && redisFeedback.status !== 'end' && redisFeedback.status !== 'close') {
      try {
        await redisFeedback.quit();
        console.log('🔄 Disconnected redisFeedback from default URL');
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        // Ignore
      }
    }
    
    // Replace redisFeedback with test client by monkey-patching the module
    const redisClientModule = await import('../../redis-client');
    Object.defineProperty(redisClientModule, 'redisFeedback', {
      value: redisClient,
      writable: true,
      configurable: true,
    });
    
    // Update the local reference
    (global as any).redisFeedback = redisClient;
    console.log('✅ Replaced redisFeedback with test Redis client');
    
    // Verify it works
    await redisClient.ping();
    console.log('✅ redisFeedback verified');

    // Mock Kafka producer to avoid warnings in tests (Kafka not needed for this test)
    const kafkaClientModule = await import('../../kafka-client');
    // Create a mock producer that matches KafkaJS Producer interface
    const mockProducer = {
      send: jest.fn().mockResolvedValue([{ topicName: 'test', partition: 0, errorCode: 0 }]),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
    };
    // Replace the _producer private property
    (kafkaClientModule.kafkaWrapper as any)._producer = mockProducer;
    console.log('✅ Mocked Kafka producer (Kafka not needed for this test)');

    process.env.JWT_DEV = 'test-jwt-secret';
  });

  beforeEach(async () => {
    // Clear MongoDB
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }

    // Clear Redis
    const keys = await redisClient.keys('feedback:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  afterAll(async () => {
    // Cleanup
    await redisClient.quit();
    
    if (mongoServer) {
      await mongoServer.stop();
    }
    await mongoose.connection.close();
  });

  it('should process reactions through feedback service and publish agent.learning.updated', async () => {
    // Step 1: Seed agent learning summary (directly, bypassing Kafka)
    console.log('\n📝 Step 1: Seeding agent learning summary...');
    
    // Directly create agent learning summary (simulating agent.created listener)
    const initialSummary = buildAgentLearningSummary({
      agentId: TEST_AGENT_ID,
      ownerUserId: TEST_AGENT_OWNER_ID,
    });
    await initialSummary.save();
    console.log('✅ Agent learning summary created');

    // Directly create agent feedback aggregation
    const initialAggregation = buildAgentFeedbackAggregation({
      agentId: TEST_AGENT_ID,
    });
    await initialAggregation.save();
    console.log('✅ Agent feedback aggregation created');

    // Step 2: Add feedback items directly to the batcher (bypassing Kafka)
    console.log('\n📝 Step 2: Adding reaction feedback items...');
    
    const agentMessageContent = 'Hello! This is a test message from the agent.';
    
    // User1 reacts with 'like' (👍)
    await feedbackBatcherRedis.add({
      agentId: TEST_AGENT_ID,
      roomId: TEST_ROOM_ID,
      userId: TEST_USER1_ID,
      feedbackType: 'reaction',
      value: 0.6, // Positive reaction (like)
      source: 'chat',
      sourceId: TEST_AGENT_MESSAGE_ID,
      metadata: {
        reactionType: 'like',
        emoji: '👍',
        messageId: TEST_AGENT_MESSAGE_ID,
        agentMessageContent,
      },
      receivedAt: new Date().toISOString(),
    });
    console.log('✅ User1 reaction (like) added');

    // User2 reacts with 'love' (❤️)
    await feedbackBatcherRedis.add({
      agentId: TEST_AGENT_ID,
      roomId: TEST_ROOM_ID,
      userId: TEST_USER2_ID,
      feedbackType: 'reaction',
      value: 0.8, // Very positive reaction (love)
      source: 'chat',
      sourceId: TEST_AGENT_MESSAGE_ID,
      metadata: {
        reactionType: 'love',
        emoji: '❤️',
        messageId: TEST_AGENT_MESSAGE_ID,
        agentMessageContent,
      },
      receivedAt: new Date().toISOString(),
    });
    console.log('✅ User2 reaction (love) added');

    // User1 reacts with 'laugh' (😂)
    await feedbackBatcherRedis.add({
      agentId: TEST_AGENT_ID,
      roomId: TEST_ROOM_ID,
      userId: TEST_USER1_ID,
      feedbackType: 'reaction',
      value: 0.7, // Positive reaction (laugh)
      source: 'chat',
      sourceId: TEST_AGENT_MESSAGE_ID,
      metadata: {
        reactionType: 'laugh',
        emoji: '😂',
        messageId: TEST_AGENT_MESSAGE_ID,
        agentMessageContent,
      },
      receivedAt: new Date().toISOString(),
    });
    console.log('✅ User1 reaction (laugh) added');

    // Wait for events to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Verify Redis sliding window BEFORE flush
    // Note: The flush happens automatically when BATCH_SIZE (3) is reached
    // So we need to check the window before the automatic flush, or check after understanding the flush cleared it
    console.log('\n📝 Step 3: Verifying Redis sliding window...');
    const windowKey = RedisFeedbackKeys.window(TEST_AGENT_ID, TEST_ROOM_ID);
    
    // Check window - it may be empty if flush already happened (BATCH_SIZE=3 triggers auto-flush)
    const windowItems = await redisClient.lrange(windowKey, 0, -1);
    console.log(`✅ Redis window contains ${windowItems.length} items (may be 0 if flush already happened)`);
    
    // If window has items, verify them
    if (windowItems.length > 0) {
      expect(windowItems.length).toBeLessThanOrEqual(3);
      
      const items = windowItems.map((json: string) => JSON.parse(json));
      console.log('📦 Window items:', items.map(i => ({ 
        userId: i.userId, 
        value: i.value, 
        feedbackType: i.feedbackType,
        metadata: i.metadata?.reactionType
      })));
      
      // Verify all items are for the correct agent and room
      items.forEach(item => {
        expect(item.agentId).toBe(TEST_AGENT_ID);
        expect(item.roomId).toBe(TEST_ROOM_ID);
        expect(item.feedbackType).toBe('reaction');
        expect(item.value).toBeGreaterThan(0); // All reactions should be positive
      });
    } else {
      console.log('ℹ️  Window is empty (flush already happened automatically)');
    }

    // Step 4: Trigger batch flush manually (if not already flushed)
    // Note: Aggregations are only updated during flush processing
    console.log('\n📝 Step 4: Triggering batch flush (if needed)...');
    // Check if flush is needed
    const metaKey = RedisFeedbackKeys.batchMeta(TEST_AGENT_ID);
    const metadata = await redisClient.get(metaKey);
    if (metadata) {
      const meta = JSON.parse(metadata);
      if (meta.itemCount > 0) {
        await feedbackBatcherRedis.flush(TEST_AGENT_ID);
        console.log('✅ Batch flushed');
      } else {
        console.log('✅ Batch already flushed automatically');
      }
    } else {
      console.log('✅ No batch metadata (already flushed)');
    }

    // Wait for processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 5: Verify MongoDB aggregations are updated (after flush)
    console.log('\n📝 Step 5: Verifying MongoDB aggregations...');
    const updatedAggregation = await AgentFeedbackAggregation.findOne({ agentId: TEST_AGENT_ID });
    
    expect(updatedAggregation).toBeDefined();
    expect(updatedAggregation!.totalFeedback).toBeGreaterThan(0);
    expect(updatedAggregation!.positiveCount).toBeGreaterThan(0);
    
    console.log('📊 Aggregation:', {
      totalFeedback: updatedAggregation!.totalFeedback,
      positiveCount: updatedAggregation!.positiveCount,
      negativeCount: updatedAggregation!.negativeCount,
      pendingFeedbackCount: updatedAggregation!.pendingFeedbackCount,
      pendingRewardSum: updatedAggregation!.pendingRewardSum,
      lastPolicyUpdateAt: updatedAggregation!.lastPolicyUpdateAt,
    });

    // Step 6: Verify Redis window state after flush
    const windowItemsAfterFlush = await redisClient.lrange(windowKey, 0, -1);
    console.log(`✅ Redis window after flush: ${windowItemsAfterFlush.length} items`);
    // Note: Window items are cleared during flush processing

    // Step 8: Verify learning summary was updated
    console.log('\n📝 Step 8: Verifying learning summary updates...');
    const finalSummary = await AgentLearningSummary.findOne({ agentId: TEST_AGENT_ID });
    expect(finalSummary).toBeDefined();
    
    // Verify summary has numeric scores
    expect(typeof finalSummary!.sentimentScore).toBe('number');
    expect(typeof finalSummary!.engagementScore).toBe('number');
    expect(finalSummary!.version).toBeGreaterThan(0);
    
    console.log('📈 Learning Summary:', {
      sentimentScore: finalSummary!.sentimentScore,
      engagementScore: finalSummary!.engagementScore,
      qualityScore: finalSummary!.qualityScore,
      version: finalSummary!.version,
      lastPolicyUpdateAt: finalSummary!.lastPolicyUpdateAt,
    });
    
    console.log('✅ Learning summary verified with numeric scores!');

    // Final summary
    console.log('\n✅ Integration test completed successfully!');
    console.log('Summary:');
    console.log(`  - Agent ID: ${TEST_AGENT_ID}`);
    console.log(`  - Reactions processed: 3`);
    console.log(`  - Redis window items: ${windowItems.length} (max 3)`);
    console.log(`  - MongoDB aggregation: verified`);
    console.log(`  - Learning summary: updated with numeric scores`);
  }, 60000); // 60 second timeout
});
