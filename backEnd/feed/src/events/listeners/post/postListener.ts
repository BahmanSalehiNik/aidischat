import { Subjects, PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent, Visibility, Listener, NotFoundError } from '@aichatwar/shared';
import { fanoutQueue } from '../../../queues/fanout-queue';
import { Post } from '../../../models/post/post';
import { GroupIdPostCreated, GroupIdPostUpdated, GroupIdPostDeleted } from './../../queGroupNames';
import { EachMessagePayload } from 'kafkajs';

export class PostCreatedListener extends Listener<PostCreatedEvent> {
  readonly topic: Subjects.PostCreated = Subjects.PostCreated;
  readonly groupId = GroupIdPostCreated;

  async onMessage(data: PostCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('Post created event received:', data);
    const {
      id,
      userId,
      content,
      mediaIds,
      visibility,
      createdAt,
    } = data;

    // Save projection
    const media = mediaIds ? mediaIds : undefined;

    const post = Post.build({
      id,
      userId,
      content,
      media,
      visibility: Visibility[visibility as keyof typeof Visibility],
      originalCreation: createdAt
    });

    await post.save();

    // Enqueue fan-out job
    await fanoutQueue.add('fanout-job', { postId: id, authorId: userId, visibility });
    
    // Manual acknowledgment - only after successful save and queue job
    await this.ack();
  }
}

export class PostUpdatedListener extends Listener<PostUpdatedEvent> {
  readonly topic: Subjects.PostUpdated = Subjects.PostUpdated;
  readonly groupId = GroupIdPostUpdated;

  async onMessage(data: PostUpdatedEvent['data'], msg: EachMessagePayload) {
    console.log('Post updated event received:', data);
    const {
      id,
      content,
      mediaIds,
      visibility,
      updatedAt,
    } = data;

    // Find the post in feed service
    const post = await Post.findOne({ _id: id });
    if (!post) {
      console.log(`Post ${id} not found in feed service`);
      await this.ack();
      return;
    }

    // Update post data
    post.content = content;
    post.media = mediaIds ? mediaIds.map(id => ({ url: id, type: 'image' })) : undefined;
    post.visibility = visibility as any;
    post.updatedAt = new Date(updatedAt);

    await post.save();

    console.log(`Updated post ${id} in feed service`);
    
    // Manual acknowledgment - only after successful save
    await this.ack();
  }
}

export class PostDeletedListener extends Listener<PostDeletedEvent> {
  readonly topic: Subjects.PostDeleted = Subjects.PostDeleted;
  readonly groupId = GroupIdPostDeleted;

  async onMessage(data: PostDeletedEvent['data'], msg: EachMessagePayload) {
    console.log('Post deleted event received:', data);
    const { id } = data;

    // Find and delete the post from feed service
    const post = await Post.findOne({ _id: id });
    if (!post) {
      console.log(`Post ${id} not found in feed service`);
      await this.ack();
      return;
    }

    await Post.deleteOne({ _id: id });

    console.log(`Deleted post ${id} from feed service`);
    
    // Manual acknowledgment - only after successful deletion
    await this.ack();
  }
}