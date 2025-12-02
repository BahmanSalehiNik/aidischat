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
import { Friendship } from '../models/friendship/freindship';
import { User } from '../models/user/user';
import { UserStatus } from '@aichatwar/shared';

const fanoutWorker = new Worker(
  'fanout-job',
  async job => {
    console.log(job.data, "secret job")
    const { postId, authorId, visibility } = job.data;

    let recipients: string[] = [];

    // Always include the author in their own feed
    const authorIncluded = new Set<string>([authorId]);

    if (visibility === 'public') {
      console.log('vis')
      // everyone or friends — simplified here

      const friendships = await Friendship.find({
        status: 'accepted',
        $or: [{ requester: authorId }, { recipient: authorId }],
      });
      console.log(friendships, "freinds")
      // map both requester/recipient pairs correctly
      const friendIds = friendships.map(f =>
        f.requester === authorId ? f.recipient : f.requester
      );
      
      // Add friends to recipients
      friendIds.forEach(id => authorIncluded.add(id));
      console.log(Array.from(authorIncluded), "rec")

      // For public posts, also add to all active agents' feeds
      // This allows agents to see public posts and generate content based on them
      try {
        const activeAgents = await User.find({
          isAgent: true,
          status: UserStatus.Active,
        })
          .select('_id')
          .lean();

        const agentIds = activeAgents.map(agent => agent._id.toString());
        console.log(`[FanoutWorker] Found ${agentIds.length} active agents for public post fanout`);
        
        // Add agents to recipients (excluding the author if the author is an agent)
        agentIds.forEach(agentId => {
          if (agentId !== authorId) {
            authorIncluded.add(agentId);
          }
        });
      } catch (err) {
        console.error('[FanoutWorker] Error fetching active agents:', err);
        // Continue with normal fanout even if agent fetch fails
      }
    } else if (visibility === 'friends') {
      const friendships = await Friendship.find({
        status: 'accepted',
        $or: [{ requester: authorId }, { recipient: authorId }],
      });
      const friendIds = friendships.map(f =>
        f.requester === authorId ? f.recipient : f.requester
      );
      friendIds.forEach(id => authorIncluded.add(id));
    }
    // else: private - only author (already in set)

    recipients = Array.from(authorIncluded);

    if (!recipients.length) return;
    console.log(recipients,"rec")
    
    // Determine which recipients are agents (for setting FeedReason)
    const agentIdsSet = new Set<string>();
    if (visibility === 'public') {
      try {
        const activeAgents = await User.find({
          isAgent: true,
          status: UserStatus.Active,
        })
          .select('_id')
          .lean();
        activeAgents.forEach(agent => agentIdsSet.add(agent._id.toString()));
      } catch (err) {
        console.error('[FanoutWorker] Error fetching agents for reason determination:', err);
      }
    }
    
    // Create feed entries with appropriate reason
    const feedEntries = recipients.map(uid => {
      // Determine reason: Recommendation if it's an agent seeing a public post (and not the author)
      // Otherwise, Friend
      const reason = (uid !== authorId && 
                     visibility === 'public' && 
                     agentIdsSet.has(uid)) 
                     ? FeedReason.Recommendation 
                     : FeedReason.Friend;
      
      return {
        userId: uid,
        postId,
        sourceUserId: authorId,
        reason,
        originalCreationTime: new Date().toISOString(),
      };
    });
    
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