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
});

afterAll(async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
  await mongoose.connection.close();
});

