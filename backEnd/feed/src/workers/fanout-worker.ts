// src/workers/fanout-worker.ts
import { Worker } from 'bullmq';

import mongoose
 from 'mongoose';

const start = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be defined');
  if (!process.env.REDIS_HOST) throw new Error('REDIS_HOST must be defined');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Worker] Connected to MongoDB');
}

start()

import { Feed, FeedReason } from '../models/feed/feed';
import { Friendship } from '../models/friendship/freindship'

const fanoutWorker = new Worker(
  'fanout-job',
  async job => {
    console.log(job.data, "secret job")
    const { postId, authorId, visibility } = job.data;

    let recipients: string[] = [];

    if (visibility === 'public') {
      console.log('vis')
      // everyone or friends — simplified here

      const friendships = await Friendship.find({
        status: 'accepted',
        $or: [{ requester: authorId }, { recipient: authorId }],
      });
      console.log(friendships, "freinds")
      // map both requester/recipient pairs correctly
      recipients = friendships.map(f =>
        f.requester === authorId ? f.recipient : f.requester
      );

      console.log(recipients, "rec")
    } else if (visibility === 'friends') {
      const friendships = await Friendship.find({
        status: 'accepted',
        $or: [{ requester: authorId }, { recipient: authorId }],
      });
      recipients = friendships.map(f =>
        f.requester === authorId ? f.recipient : f.requester
      );
    } else {
      recipients = [authorId]; // only self
    }

    if (!recipients.length) return;
    console.log(recipients,"rec")
    const feedEntries = recipients.map(uid => ({
      userId: uid,
      postId,
      sourceUserId: authorId,
      reason: FeedReason.Friend,
      originalCreationTime: new Date().toISOString(),
    }));
    
    console.log(feedEntries,"feed")
    try {
  const res = await Feed.insertMany(feedEntries, { ordered: false });
  console.log('Inserted feed entries:', res.length);
} catch (err) {
  console.error('Error inserting feeds:', err);
}
  },
  {
    connection: { host: process.env.REDIS_HOST || 'expiration-redis-srv', port: 6379 },
  }
);


export {fanoutWorker};