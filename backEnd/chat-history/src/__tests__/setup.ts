import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Use in-memory MongoDB for tests if MONGO_URI is not set
  if (!process.env.MONGO_URI) {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongoServer.getUri();
  }
  
  // Set test JWT secret
  process.env.JWT_DEV = process.env.JWT_DEV || 'test-jwt-secret';
  
  // Set Kafka client ID (not used in tests but required)
  process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'test-client';
  process.env.KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL || 'localhost:9092';
});

afterAll(async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
  await mongoose.connection.close();
});

