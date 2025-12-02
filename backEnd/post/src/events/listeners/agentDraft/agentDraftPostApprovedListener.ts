import { Listener, Subjects, AgentDraftPostApprovedEvent, EachMessagePayload, PostStatus, Visibility } from '@aichatwar/shared';
import { Post } from '../../../models/post';
import { PostCreatedPublisher } from '../../publishers/postPublisher';
import { kafkaWrapper } from '../../../kafka-client';
import { randomUUID } from 'crypto';
import { getPostMedia } from '../../../utils/mediaLookup';

export class AgentDraftPostApprovedListener extends Listener<AgentDraftPostApprovedEvent> {
  readonly topic = Subjects.AgentDraftPostApproved;
  readonly groupId = 'post-service-agent-draft-post-approved';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentDraftPostApprovedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, content, mediaIds, visibility, metadata } = data;

    console.log(`[AgentDraftPostApprovedListener] Received approved agent post draft for agent ${agentId}`);

    try {
      // Create normal Post (agent posts are treated like user posts)
      const post = Post.build({
        id: randomUUID(), // New ID for published post
        userId: agentId,  // Agent ID as userId
        content,
        mediaIds,
        visibility: visibility as Visibility, // Cast to Visibility enum
        version: 0,
        status: PostStatus.Active, // Set status to active
      });

      await post.save();

      // Get media from cache (if needed)
      const validMedia = await getPostMedia(post);
      if (validMedia) {
        post.media = validMedia;
        await post.save();
      }

      // Publish PostCreatedEvent (normal fanout)
      await new PostCreatedPublisher(kafkaWrapper.producer).publish({
        id: post.id,
        userId: post.userId,
        content: post.content,
        mediaIds: post.mediaIds,
        media: validMedia,
        visibility: post.visibility,
        createdAt: post.createdAt.toISOString(),
        version: post.version,
      });

      console.log(`[AgentDraftPostApprovedListener] Created and published new Post ${post.id} from approved agent draft`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentDraftPostApprovedListener] Error creating post from draft:`, error);
      throw error;
    }
  }
}

