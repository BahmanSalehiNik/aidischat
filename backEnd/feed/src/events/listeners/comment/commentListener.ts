import { Subjects, CommentCreatedEvent, CommentDeletedEvent, Listener, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../../models/post/post';
import { Comment } from '../../../models/comment/comment';
import { GroupIdCommentCreated, GroupIdCommentDeleted } from '../../queGroupNames';
import { EachMessagePayload } from 'kafkajs';

export class CommentCreatedListener extends Listener<CommentCreatedEvent> {
  readonly topic: Subjects.CommentCreated = Subjects.CommentCreated;
  readonly groupId = GroupIdCommentCreated;

  async onMessage(data: CommentCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('Comment created event received:', data);
    const { id, postId, userId, text, parentCommentId, version } = data;
    const authorIsAgent = (data as any).authorIsAgent as boolean | undefined;

    // Find the post in feed service
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      console.log(`Post ${postId} not found in feed service`);
      await this.ack();
      return;
    }

    // Increment comment count
    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    // Store comment projection (best-effort; safe under retries due to versioning)
    try {
      const existing = await Comment.findById(id);
      if (!existing) {
        const comment = Comment.build({
          id,
          postId,
          userId,
          text,
          parentCommentId,
          authorIsAgent,
          version,
        } as any);
        await comment.save();
      }
    } catch (e: any) {
      console.warn(`[Feed CommentCreatedListener] Failed to persist comment projection for ${id}:`, e?.message);
      // Don't fail the whole handler; commentCount already updated.
    }

    console.log(`Updated comment count for post ${postId}: ${post.commentsCount}`);
    
    // Manual acknowledgment - only after successful save
    await this.ack();
  }
}

export class CommentDeletedListener extends Listener<CommentDeletedEvent> {
  readonly topic: Subjects.CommentDeleted = Subjects.CommentDeleted;
  readonly groupId = GroupIdCommentDeleted;

  async onMessage(data: CommentDeletedEvent['data'], msg: EachMessagePayload) {
    console.log('Comment deleted event received:', data);
    const { id, postId } = data as any;

    // Find the post in feed service
    const post = await Post.findOne({ _id: postId });
    if (!post) {
      console.log(`Post ${postId} not found in feed service`);
      await this.ack();
      return;
    }

    // Decrement comment count (ensure it doesn't go below 0)
    post.commentsCount = Math.max((post.commentsCount || 0) - 1, 0);
    await post.save();

    // Remove comment projection (best-effort)
    try {
      if (id) {
        await Comment.deleteOne({ _id: String(id) });
      }
    } catch (e: any) {
      console.warn(`[Feed CommentDeletedListener] Failed to delete comment projection for ${id}:`, e?.message);
    }

    console.log(`Updated comment count for post ${postId}: ${post.commentsCount}`);
    
    // Manual acknowledgment - only after successful save
    await this.ack();
  }
}
