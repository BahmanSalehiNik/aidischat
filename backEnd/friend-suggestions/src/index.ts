import mongoose from 'mongoose';
import { app } from './app';
import { kafkaWrapper } from './kafka-client';
import { PopularityRefreshScheduler } from './services/popularityRefresh';
import {
  UserCreatedListener,
  UserUpdatedListener,
  UserDeletedListener,
} from './events/listeners/user/userListener';
import {
  FriendshipAcceptedListener,
  FriendshipRequestedListener,
  FriendshipUpdatedListener,
} from './events/listeners/friendship/friendshipListener';
import {
  ProfileCreatedListener,
  ProfileDeletedListener,
} from './events/listeners/profile/profileListener';

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
    console.log('Friend suggestions service connected to MongoDB');

    const brokers = process.env.KAFKA_BROKER_URL.split(',').map((b) => b.trim());
    await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID);
    console.log('Friend suggestions service connected to Kafka');

    // User event listeners
    new UserCreatedListener(kafkaWrapper.consumer('friend-suggestions-user-created')).listen();
    new UserUpdatedListener(kafkaWrapper.consumer('friend-suggestions-user-updated')).listen();
    new UserDeletedListener(kafkaWrapper.consumer('friend-suggestions-user-deleted')).listen();

    // Profile event listeners
    new ProfileCreatedListener(kafkaWrapper.consumer('friend-suggestions-profile-created')).listen();
    new ProfileDeletedListener(kafkaWrapper.consumer('friend-suggestions-profile-deleted')).listen();

    // Friendship event listeners
    new FriendshipRequestedListener(
      kafkaWrapper.consumer('friend-suggestions-friendship-requested')
    ).listen();
    new FriendshipAcceptedListener(
      kafkaWrapper.consumer('friend-suggestions-friendship-accepted')
    ).listen();
    new FriendshipUpdatedListener(
      kafkaWrapper.consumer('friend-suggestions-friendship-updated')
    ).listen();

    PopularityRefreshScheduler.start();

    app.listen(3000, () => {
      console.log('Friend suggestions service listening on port 3000');
    });
  } catch (err) {
    console.error('Friend suggestions service failed to start:', err);
    process.exit(1);
  }
};

start();

