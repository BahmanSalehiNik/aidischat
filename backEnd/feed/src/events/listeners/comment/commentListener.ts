import { Subjects, CommentCreatedEvent, CommentDeletedEvent, Listener, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../../models/post/post';
import { GroupIdCommentCreated, GroupIdCommentDeleted } from '../../queGroupNames';
import { EachMessagePayload } from 'kafkajs';

export class CommentCreatedListener extends Listener<CommentCreatedEvent> {
  readonly topic: Subjects.CommentCreated = Subjects.CommentCreated;
  readonly groupId = GroupIdCommentCreated;

  async onMessage(data: CommentCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('Comment created event received:', data);
    const { postId } = data;

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
    const { postId } = data;

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

    console.log(`Updated comment count for post ${postId}: ${post.commentsCount}`);
    
    // Manual acknowledgment - only after successful save
    await this.ack();
  }
}
