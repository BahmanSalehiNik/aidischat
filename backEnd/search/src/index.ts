import mongoose from 'mongoose';
import { app } from './app';
import { kafkaWrapper } from './kafka-client';
import {
  UserCreatedListener,
  UserUpdatedListener,
  UserDeletedListener,
} from './events/listeners/user/userListener';
import {
  ProfileCreatedListener,
  ProfileUpdatedListener,
  ProfileDeletedListener,
} from './events/listeners/profile/profileListener';
import { FriendshipUpdatedListener } from './events/listeners/friendship/friendshipListener';
import {
  PostCreatedListener,
  PostUpdatedListener,
  PostDeletedListener,
} from './events/listeners/post/postListener';

const start = async () => {
  if (!process.env.JWT_DEV) {
    throw new Error('JWT_DEV must be defined!');
  }
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be defined!');
  }
  if (!process.env.KAFKA_CLIENT_ID) {
    throw new Error('KAFKA_CLIENT_ID must be defined!');
  }
  if (!process.env.KAFKA_BROKER_URL) {
    throw new Error('KAFKA_BROKER_URL must be defined!');
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Search service connected to MongoDB');

    // Connect to Kafka
    const brokers = process.env.KAFKA_BROKER_URL.split(',').map((b) => b.trim());
    await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
    console.log('Search service connected to Kafka');

    // Register event listeners
    new UserCreatedListener(kafkaWrapper.consumer('search-user-created')).listen();
    new UserUpdatedListener(kafkaWrapper.consumer('search-user-updated')).listen();
    new UserDeletedListener(kafkaWrapper.consumer('search-user-deleted')).listen();
    new ProfileCreatedListener(kafkaWrapper.consumer('search-profile-created')).listen();
    new ProfileUpdatedListener(kafkaWrapper.consumer('search-profile-updated')).listen();
    new ProfileDeletedListener(kafkaWrapper.consumer('search-profile-deleted')).listen();
    new FriendshipUpdatedListener(kafkaWrapper.consumer('search-friendship-updated')).listen();
    new PostCreatedListener(kafkaWrapper.consumer('search-post-created')).listen();
    new PostUpdatedListener(kafkaWrapper.consumer('search-post-updated')).listen();
    new PostDeletedListener(kafkaWrapper.consumer('search-post-deleted')).listen();

    console.log('All Kafka listeners started successfully');

    app.listen(3000, () => {
      console.log('Search service listening on port 3000');
    });
  } catch (err) {
    console.error('Search service failed to start:', err);
    process.exit(1);
  }
};

start();

