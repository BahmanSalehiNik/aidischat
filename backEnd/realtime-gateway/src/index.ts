import express from 'express';
import http from 'http';
import { kafkaWrapper } from './kafka-wrapper';
import { startWebSocketServer } from './ws-server';
import { MessageCreatedListener } from './events/listeners/message-created-listener';
import { MessageReactionCreatedListener } from './events/listeners/message-reaction-created-listener';
import { MessageReactionRemovedListener } from './events/listeners/message-reaction-removed-listener';
import { MessageReplyCreatedListener } from './events/listeners/message-reply-created-listener';
import { Subjects } from '@aichatwar/shared';

const app = express();
const server = http.createServer(app);

const start = async () => {
  try {
    // Validate required environment variables
    if (!process.env.JWT_DEV) {
      throw new Error('JWT_DEV environment variable is required');
    }
    if (!process.env.KAFKA_BROKER) {
      throw new Error('KAFKA_BROKER environment variable is required');
    }

    console.log('🚀 [Realtime Gateway] Starting Realtime Gateway...');
    console.log('🚀 [Realtime Gateway] Environment check:', {
      hasJWT: !!process.env.JWT_DEV,
      kafkaBroker: process.env.KAFKA_BROKER,
      redisUrl: process.env.REDIS_URL,
      redisRoomUrl: process.env.REDIS_ROOM_URL,
    });
    
    // Start HTTP server FIRST so startup probe passes immediately
    server.listen(3000, () => {
      console.log('✅ [Realtime Gateway] HTTP server listening on port 3000');
    });
    
    // Connect to Kafka and then start WebSocket server
    console.log(`🚀 [Realtime Gateway] Connecting to Kafka at: ${process.env.KAFKA_BROKER}`);
    await kafkaWrapper.connect([process.env.KAFKA_BROKER]);
    console.log('✅ [Realtime Gateway] Kafka connected, producer ready');
    
    // Start WebSocket server AFTER Kafka is connected (producer is now available)
    startWebSocketServer(server, kafkaWrapper.producer);

    // OLD WORKING PATTERN: Single consumer, subscribe to all topics first
    console.log("🚀 [Realtime Gateway] Setting up Kafka consumer (old working pattern)...");
    const consumer = kafkaWrapper.consumer;
    
    // Connect consumer
    await consumer.connect();
    console.log("✅ [Realtime Gateway] Consumer connected");
    
    // Subscribe to all topics first
    await consumer.subscribe({ topic: 'message.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reaction.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reaction.removed', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reply.created', fromBeginning: false });
    
    console.log('✅ [Realtime Gateway] Subscribed to all Kafka topics');

    // Create listener instances (they will handle routing)
    const messageCreatedListener = new MessageCreatedListener(consumer);
    const reactionCreatedListener = new MessageReactionCreatedListener(consumer);
    const reactionRemovedListener = new MessageReactionRemovedListener(consumer);
    const replyCreatedListener = new MessageReplyCreatedListener(consumer);
    
    // Helper function to acknowledge messages manually (since we're not using base Listener's listen())
    const ackMessage = async (payload: any) => {
      await consumer.commitOffsets([{
        topic: payload.topic,
        partition: payload.partition,
        offset: (BigInt(payload.message.offset) + BigInt(1)).toString()
      }]);
    };
    
    // Start consumer with routing logic
    console.log("🚀 [Realtime Gateway] Starting consumer.run() with message routing...");
    console.log("🚀 [Realtime Gateway] Consumer state before run():", {
      isConnected: consumer.isConnected?.() || 'unknown',
      groupId: 'realtime-gateway-group',
      subscribedTopics: ['message.created', 'chat.message.reaction.created', 'chat.message.reaction.removed', 'chat.message.reply.created'],
    });
    
    // Add error handler to catch consumer errors
    consumer.on('consumer.crash', (event: any) => {
      console.error('❌ [Realtime Gateway] Consumer crashed:', event);
    });
    
    consumer.on('consumer.disconnect', () => {
      console.warn('⚠️ [Realtime Gateway] Consumer disconnected');
    });
    
    consumer.on('consumer.connect', () => {
      console.log('✅ [Realtime Gateway] Consumer connected event');
    });
    
    await consumer.run({
      autoCommit: false,
      eachMessage: async (payload: any) => {
        const topic = payload.topic;
        const messageValue = payload.message.value;
        
        console.log(`📨 [Realtime Gateway] ✅✅✅ Received message on topic "${topic}", offset: ${payload.message.offset}, partition: ${payload.partition}`);
        
        if (!messageValue) {
          console.warn(`⚠️ [Realtime Gateway] Empty message value on topic ${topic}, acknowledging...`);
          await ackMessage(payload);
          return;
        }
        
        try {
          const data = JSON.parse(messageValue.toString());
          
          // Route to appropriate listener based on topic
          // Note: Listeners expect to call this.ack(), but since we're using a shared consumer,
          // we need to manually acknowledge after each listener processes the message
          if (topic === 'message.created') {
            await messageCreatedListener.onMessage(data, payload);
            await ackMessage(payload);
          } else if (topic === 'chat.message.reaction.created') {
            await reactionCreatedListener.onMessage(data, payload);
            await ackMessage(payload);
          } else if (topic === 'chat.message.reaction.removed') {
            await reactionRemovedListener.onMessage(data, payload);
            await ackMessage(payload);
          } else if (topic === 'chat.message.reply.created') {
            await replyCreatedListener.onMessage(data, payload);
            await ackMessage(payload);
          } else {
            console.warn(`⚠️ [Realtime Gateway] Unknown topic: ${topic}, acknowledging...`);
            await ackMessage(payload);
          }
        } catch (error) {
          console.error(`❌ [Realtime Gateway] Error processing message from topic ${topic}:`, error);
          // Don't acknowledge on error - let Kafka redeliver after session timeout
        }
      },
    });
    
    console.log("✅ [Realtime Gateway] Consumer is now running and listening for messages");
    
    // Note: There are two additional listener files in the codebase that are NOT implemented:
    // 1. ai-message-created-listener.ts - Redundant (MessageCreatedListener handles all messages including AI)
    // 2. room-updated-listener.ts - Not needed yet (uses old pattern, would need refactoring if needed)
  } catch (error) {
    console.error('Failed to start Realtime Gateway:', error);
    process.exit(1);
  }
};

start();

