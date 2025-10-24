import { Subjects, PostCreatedEvent, Visibility, Listener } from '@aichatwar/shared';
import { fanoutQueue } from '../../../queues/fanout-queue';
import { Post } from '../../../models/post/post';
import { GroupIdPostCreated } from './../../queGroupNames';
import { EachMessagePayload } from 'kafkajs';

export class PostCreatedListener extends Listener<PostCreatedEvent> {
  readonly topic: Subjects.PostCreated = Subjects.PostCreated;
  groupId: string = GroupIdPostCreated;

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