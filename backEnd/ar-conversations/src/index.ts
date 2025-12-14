import { app } from "./app";
import mongoose from "mongoose";
import { kafkaWrapper } from './kafka-client';
import { retryWithBackoff } from './utils/connection-retry';
import { ARStreamChunkListener } from './events/listeners/ar-stream-chunk-listener';

// Validate environment variables
if (!process.env.JWT_DEV) {
    throw new Error("JWT_DEV must be defined!");
}
if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be defined!");
}
if (!process.env.KAFKA_CLIENT_ID) {
    throw new Error("KAFKA_CLIENT_ID must be defined!");
}
if (!process.env.KAFKA_BROKER_URL) {
    throw new Error("KAFKA_BROKER_URL must be defined!");
}

// Start HTTP server FIRST so startup probe passes immediately
app.listen(3000, '0.0.0.0', () => {
    console.log("✅ AR Conversations Service HTTP server listening on port 3000");
});

// Connect to dependencies in background with retry logic
const connectMongoDB = async () => {
    await retryWithBackoff(
        async () => {
            await mongoose.connect(process.env.MONGO_URI!);
            console.log("✅ AR Conversations Service connected to MongoDB");
        },
        { maxRetries: 30, initialDelayMs: 2000 },
        "MongoDB"
    );
};

const connectKafka = async () => {
    const brokers = process.env.KAFKA_BROKER_URL!.split(',');
    await retryWithBackoff(
        async () => {
            await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID || 'ar-conversations');
        },
        { maxRetries: 30, initialDelayMs: 2000 },
        "Kafka"
    );
};

// Start connections and listeners in background
const startListeners = async () => {
  await retryWithBackoff(
    async () => {
      // Wait for Kafka to be connected
      if (!kafkaWrapper.producer) {
        throw new Error('Kafka not connected yet');
      }

      // Start AR stream chunk listener
      const arStreamChunkListener = new ARStreamChunkListener(kafkaWrapper);
      await arStreamChunkListener.listen();
      console.log('✅ AR Stream Chunk Listener started');
    },
    { maxRetries: 10, initialDelayMs: 3000 },
    'Kafka Listeners'
  );
};

connectMongoDB()
  .then(() => connectKafka())
  .then(() => startListeners())
  .catch(console.error);

