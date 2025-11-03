import express from 'express';
import http from 'http';
import { kafkaWrapper } from './kafka-wrapper';
import { startWebSocketServer } from './ws-server';
import { MessageCreatedListener } from './events/listeners/message-created-listener';

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

    new MessageCreatedListener(kafkaWrapper.consumer).listen();

    startWebSocketServer(server, kafkaWrapper.producer);
    server.listen(3000, () => console.log('Realtime Gateway running on port 3000'));
  } catch (error) {
    console.error('Failed to start Realtime Gateway:', error);
    process.exit(1);
  }
};

start();

