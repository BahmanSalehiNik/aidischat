import express from 'express';
import http from 'http';
import { kafkaWrapper } from './kafka-wrapper';
import { startWebSocketServer } from './ws-server';
import { MessageCreatedListener } from './events/listeners/message-created-listener';
import { MessageReactionCreatedListener } from './events/listeners/message-reaction-created-listener';
import { MessageReactionRemovedListener } from './events/listeners/message-reaction-removed-listener';
import { MessageReplyCreatedListener } from './events/listeners/message-reply-created-listener';
import { ARStreamChunkListener } from './events/listeners/ar-stream-chunk-listener';
import { Subjects } from '@aichatwar/shared';
import { retryWithBackoff } from './utils/connection-retry';

const app = express();
const server = http.createServer(app);

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

// Connect to Kafka producer in background with retry logic
const connectKafkaProducer = async () => {
  await retryWithBackoff(
    async () => {
      await kafkaWrapper.connect([process.env.KAFKA_BROKER!]);
      console.log('✅ [Realtime Gateway] Kafka producer connected');
    },
    { maxRetries: 30, initialDelayMs: 2000 },
    "Kafka Producer"
  );
};

// Connect consumer and start listening with automatic reconnection
const connectKafkaConsumer = async () => {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 100; // Allow many reconnection attempts
  
  const startConsumer = async () => {
    try {
      console.log(`🚀 [Realtime Gateway] Setting up Kafka consumer (attempt ${reconnectAttempts + 1})...`);
      const consumer = kafkaWrapper.consumer;
      
      // Connect consumer
      await consumer.connect();
      console.log("✅ [Realtime Gateway] Consumer connected");
      
      // Subscribe to all topics first
      await consumer.subscribe({ topic: 'message.created', fromBeginning: false });
      await consumer.subscribe({ topic: 'chat.message.reaction.created', fromBeginning: false });
      await consumer.subscribe({ topic: 'chat.message.reaction.removed', fromBeginning: false });
      await consumer.subscribe({ topic: 'chat.message.reply.created', fromBeginning: false });
      await consumer.subscribe({ topic: 'ar.stream.chunk', fromBeginning: false });
      
      console.log('✅ [Realtime Gateway] Subscribed to all Kafka topics');

      // Create listener instances (they will handle routing)
      const messageCreatedListener = new MessageCreatedListener(consumer);
      const reactionCreatedListener = new MessageReactionCreatedListener(consumer);
      const reactionRemovedListener = new MessageReactionRemovedListener(consumer);
      const replyCreatedListener = new MessageReplyCreatedListener(consumer);
      const arStreamChunkListener = new ARStreamChunkListener(consumer);
      
      // Helper function to acknowledge messages manually
      const ackMessage = async (payload: any) => {
        await consumer.commitOffsets([{
          topic: payload.topic,
          partition: payload.partition,
          offset: (BigInt(payload.message.offset) + BigInt(1)).toString()
        }]);
      };
      
      // Add error handlers
      consumer.on('consumer.crash', async (event: any) => {
        console.error('❌ [Realtime Gateway] Consumer crashed:', event.error?.message || event);
        reconnectAttempts++;
        
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`🔄 [Realtime Gateway] Attempting to reconnect consumer (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
          // Wait a bit before reconnecting
          await new Promise(resolve => setTimeout(resolve, 5000));
          // Reconnect
          startConsumer().catch(err => {
            console.error('❌ [Realtime Gateway] Reconnection failed:', err);
          });
        } else {
          console.error(`❌ [Realtime Gateway] Max reconnection attempts (${maxReconnectAttempts}) reached. Consumer will not reconnect.`);
        }
      });
      
      consumer.on('consumer.disconnect', () => {
        console.warn('⚠️ [Realtime Gateway] Consumer disconnected');
      });
      
      consumer.on('consumer.connect', () => {
        console.log('✅ [Realtime Gateway] Consumer connected event');
        reconnectAttempts = 0; // Reset on successful connection
      });
      
      // Start consumer with routing logic
      await consumer.run({
        autoCommit: false,
        eachMessage: async (payload: any) => {
          const topic = payload.topic;
          const messageValue = payload.message.value;
          
          console.log(`📨 [Realtime Gateway] Received message on topic "${topic}", offset: ${payload.message.offset}, partition: ${payload.partition}`);
          
          if (!messageValue) {
            console.warn(`⚠️ [Realtime Gateway] Empty message value on topic ${topic}, acknowledging...`);
            await ackMessage(payload);
            return;
          }
          
          try {
            const data = JSON.parse(messageValue.toString());
            
            // Route to appropriate listener based on topic
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
            } else if (topic === 'ar.stream.chunk') {
              await arStreamChunkListener.onMessage(data, payload);
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
    } catch (error: any) {
      reconnectAttempts++;
      const errorMsg = error?.message || String(error);
      const isConnectionError = 
        errorMsg.includes('Connection') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('ENOTFOUND');
      
      if (isConnectionError && reconnectAttempts < maxReconnectAttempts) {
        console.warn(`⚠️ [Realtime Gateway] Consumer connection failed (attempt ${reconnectAttempts}/${maxReconnectAttempts}): ${errorMsg}. Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return startConsumer();
      } else {
        throw error;
      }
    }
  };
  
  // Initial connection with retry
  await retryWithBackoff(
    startConsumer,
    { maxRetries: 10, initialDelayMs: 2000 },
    "Kafka Consumer Initial Connection"
  );
};

// Initialize connections in background
(async () => {
  try {
    // Connect producer first (needed for WebSocket server)
    await connectKafkaProducer();
    
    // Start WebSocket server AFTER Kafka producer is connected
    startWebSocketServer(server, kafkaWrapper.producer);
    console.log('✅ [Realtime Gateway] WebSocket server started');
    
    // Connect consumer in background (can retry if it fails)
    connectKafkaConsumer().catch(err => {
      console.error('❌ [Realtime Gateway] Failed to connect consumer (will retry):', err);
      // Don't exit - service can still handle WebSocket connections
    });
    
    console.log("✅ [Realtime Gateway] Service fully initialized");
  } catch (err) {
    console.error("❌ [Realtime Gateway] Error initializing service:", err);
    // Don't exit - service can still handle HTTP/WebSocket requests
    // Connections will retry in background
  }
})();

