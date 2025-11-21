import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

declare global {
  // eslint-disable-next-line no-var
  var signin: (id?: string, email?: string) => string[];
}

let mongo: MongoMemoryServer;

beforeAll(async () => {
  process.env.JWT_DEV = 'test_jwt_secret';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) {
    return;
  }
  const collections = await db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  if (mongo) {
    await mongo.stop();
  }
  await mongoose.connection.close();
});

global.signin = (id = new mongoose.Types.ObjectId().toHexString(), email = 'test@example.com') => {
  const payload = { id, email };
  const token = jwt.sign(payload, process.env.JWT_DEV!);
  const session = JSON.stringify({ jwt: token });
  const base64 = Buffer.from(session).toString('base64');
  return [`session=${base64}`];
};

