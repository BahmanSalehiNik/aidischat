// src/events/listeners/post-created-listener.ts
import { Message } from 'node-nats-streaming';
import { BaseListener, Subjects, PostCreatedEvent, Visability } from '@aichatwar/shared';
import { fanoutQueue } from '../../../queues/fanout-queue';
import { Post } from '../../../models/post/post';
import { PostQueueGroupeName } from './../../queGroupNames';

export class PostCreatedListener extends BaseListener<PostCreatedEvent> {
  readonly subject: Subjects.PostCreated = Subjects.PostCreated;
  queueGroupName = PostQueueGroupeName;

  async onMessage(data: PostCreatedEvent['data'], msg: Message) {
    const {
      id,
      userId,
      content,
      mediaIds,
      visibility,
      createdAt,
    //   commentsCount,
    //   reactions
    } = data;

    // Save projection
    // Save to post projection (for caching post metadata)
    const media = mediaIds ? mediaIds : undefined;

    const post = Post.build({
      id,
      userId,
      content,
      media,
      visibility: Visability[visibility as keyof typeof Visability],
    //   commentsCount: commentsCount || 0,
    //   reactionsSummary: reactions || [],
      originalCreation:createdAt
    //   updatedAt,
    });

    await post.save();


    // Enqueue fan-out job
    await fanoutQueue.add('fanout-job', { postId: id, authorId: userId, visibility });

    msg.ack();
  }
}


