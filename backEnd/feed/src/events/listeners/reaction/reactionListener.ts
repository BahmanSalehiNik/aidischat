import { Listener, Subjects, ReactionCreatedEvent, ReactionDeletedEvent } from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { Post } from '../../../models/post/post';

const GroupIdReactionCreated = 'feed-reaction-created';
const GroupIdReactionDeleted = 'feed-reaction-deleted';

const normalizeReactionsSummary = (summary: any[]) => {
  const map = new Map<string, number>();
  summary
    .filter((entry) => entry && entry.type)
    .forEach((entry) => {
      const key = entry.type;
      const count = typeof entry.count === 'number' ? entry.count : 0;
      map.set(key, (map.get(key) || 0) + count);
    });

  return Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
    }));
};

export class ReactionCreatedListener extends Listener<ReactionCreatedEvent> {
  readonly topic: Subjects.ReactionCreated = Subjects.ReactionCreated;
  readonly groupId = GroupIdReactionCreated;

  async onMessage(data: ReactionCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('Reaction created event received:', data);
    const { postId, type } = data;

    // Only process post reactions (not comment reactions)
    if (!postId || data.commentId) {
      await this.ack();
      return;
    }

    // Find the post in feed service
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      console.log(`Post ${postId} not found in feed service`);
      await this.ack();
      return;
    }

    // Update reactionsSummary incrementally
    // Initialize if it doesn't exist
    if (!post.reactionsSummary || !Array.isArray(post.reactionsSummary)) {
      post.reactionsSummary = [];
    }

    // Find existing reaction type or create new
    const existingReaction = post.reactionsSummary.find((r: any) => r.type === type);
    if (existingReaction) {
      // Increment count
      existingReaction.count = (existingReaction.count || 0) + 1;
    } else {
      // Add new reaction type
      post.reactionsSummary.push({ type, count: 1 });
    }

    post.reactionsSummary = normalizeReactionsSummary(post.reactionsSummary);

    await post.save();

    console.log(`Updated reactionsSummary for post ${postId}:`, post.reactionsSummary);
    
    await this.ack();
  }
}

export class ReactionDeletedListener extends Listener<ReactionDeletedEvent> {
  readonly topic: Subjects.ReactionDeleted = Subjects.ReactionDeleted;
  readonly groupId = GroupIdReactionDeleted;

  async onMessage(data: ReactionDeletedEvent['data'], msg: EachMessagePayload) {
    console.log('Reaction deleted event received:', data);
    const { postId, type } = data;

    // Only process post reactions (not comment reactions)
    if (!postId || data.commentId) {
      await this.ack();
      return;
    }

    // Find the post in feed service
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      console.log(`Post ${postId} not found in feed service`);
      await this.ack();
      return;
    }

    // Update reactionsSummary incrementally
    if (!post.reactionsSummary || !Array.isArray(post.reactionsSummary)) {
      post.reactionsSummary = [];
    }

    // Decrement the reaction type if we have it
    if (type) {
      const existingReaction = post.reactionsSummary.find((r: any) => r.type === type);
      if (existingReaction) {
        existingReaction.count = Math.max((existingReaction.count || 1) - 1, 0);
        // Remove if count reaches 0
        if (existingReaction.count === 0) {
          post.reactionsSummary = post.reactionsSummary.filter((r: any) => r.type !== type);
        }
      }
    } else {
      // If type is not provided, we can't decrement accurately
      // This will be handled by PostUpdated event which includes full reactionsSummary
      console.log(`Reaction deleted for post ${postId} but type not provided, will rely on PostUpdated event`);
    }

    post.reactionsSummary = normalizeReactionsSummary(post.reactionsSummary);

    await post.save();

    console.log(`Updated reactionsSummary for post ${postId} after deletion:`, post.reactionsSummary);
    
    await this.ack();
  }
}

