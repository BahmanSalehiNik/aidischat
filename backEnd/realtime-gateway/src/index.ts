import express from 'express';
import http from 'http';
import { kafkaWrapper } from './kafka-wrapper';
import { startWebSocketServer } from './ws-server';
import { MessageCreatedListener } from './events/listeners/message-created-listener';
import { MessageReactionCreatedListener } from './events/listeners/message-reaction-created-listener';
import { MessageReactionRemovedListener } from './events/listeners/message-reaction-removed-listener';
import { MessageReplyCreatedListener } from './events/listeners/message-reply-created-listener';

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

    console.log('Starting Realtime Gateway...');
    
    await kafkaWrapper.connect([process.env.KAFKA_BROKER]);

    // Subscribe to all topics first
    const consumer = kafkaWrapper.consumer;
    await consumer.subscribe({ topic: 'message.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reaction.created', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reaction.removed', fromBeginning: false });
    await consumer.subscribe({ topic: 'chat.message.reply.created', fromBeginning: false });
    
    console.log('✅ Subscribed to all Kafka topics');

    // Create listener instances (they will handle routing)
    const messageCreatedListener = new MessageCreatedListener(consumer);
    const reactionCreatedListener = new MessageReactionCreatedListener(consumer);
    const reactionRemovedListener = new MessageReactionRemovedListener(consumer);
    const replyCreatedListener = new MessageReplyCreatedListener(consumer);

    // Single consumer.run() that routes messages to appropriate handlers
    await consumer.run({
      eachMessage: async ({ topic, partition, message }: { topic: string; partition: number; message: { value: Buffer | null } }) => {
        try {
          const data = JSON.parse(message.value!.toString());
          
          // Create payload object for onMessage handlers
          const payload = { topic, partition, message } as any;
          
          // Route to appropriate handler based on topic
          switch (topic) {
            case 'message.created':
              await messageCreatedListener.onMessage(data, payload);
              break;
            case 'chat.message.reaction.created':
              await reactionCreatedListener.onMessage(data, payload);
              break;
            case 'chat.message.reaction.removed':
              await reactionRemovedListener.onMessage(data, payload);
              break;
            case 'chat.message.reply.created':
              await replyCreatedListener.onMessage(data, payload);
              break;
            default:
              console.warn(`⚠️ Unknown topic: ${topic}`);
          }
        } catch (error) {
          console.error(`❌ Error processing message from topic ${topic}:`, error);
        }
      },
    });
    
    console.log('✅ Consumer run started, routing messages to handlers');

    startWebSocketServer(server, kafkaWrapper.producer);
    server.listen(3000, () => console.log('Realtime Gateway running on port 3000'));
  } catch (error) {
    console.error('Failed to start Realtime Gateway:', error);
    process.exit(1);
  }
};

start();

