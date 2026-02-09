import { Listener, Subjects, AgentDraftPostApprovedEvent, EachMessagePayload, PostStatus, Visibility } from '@aichatwar/shared';
import { Post } from '../../../models/post';
import { PostCreatedPublisher } from '../../publishers/postPublisher';
import { kafkaWrapper } from '../../../kafka-client';
import { getPostMedia } from '../../../utils/mediaLookup';
import mongoose from 'mongoose';

export class AgentDraftPostApprovedListener extends Listener<AgentDraftPostApprovedEvent> {
  readonly topic = Subjects.AgentDraftPostApproved;
  readonly groupId = 'post-service-agent-draft-post-approved';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentDraftPostApprovedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, content, mediaIds, visibility, metadata } = data;

    console.log(`[AgentDraftPostApprovedListener] Received approved agent post draft for agent ${agentId}`);

    try {
      // Post model currently uses Mongo ObjectId for _id; generate a compatible ID.
      const postId = new mongoose.Types.ObjectId().toHexString();

      // Allow external/public image URLs to be passed through (no media service import).
      const urlLike = (s: any) => typeof s === 'string' && (s.startsWith('https://') || s.startsWith('http://'));
      const externalUrls: string[] = Array.isArray(mediaIds) ? mediaIds.filter(urlLike) : [];
      const onlyExternalUrls = Array.isArray(mediaIds) && mediaIds.length > 0 && externalUrls.length === mediaIds.length;

      // Create normal Post (agent posts are treated like user posts)
      const post = await Promise.resolve(Post.build({
        id: postId, // New ID for published post
        userId: agentId,  // Agent ID as userId
        authorIsAgent: true, // Persist author type on the stored Post model
        content,
        mediaIds,
        visibility: visibility as Visibility, // Cast to Visibility enum
        version: 0,
        status: PostStatus.Active, // Set status to active
      }));

      await post.save();

      // If mediaIds are external URLs, store them directly on the post document as media.
      // This avoids relying on MediaCreated/cache and avoids downloading/importing images.
      let validMedia: any[] | undefined;
      if (onlyExternalUrls && externalUrls.length > 0) {
        validMedia = externalUrls.map((u, idx) => ({
          id: `external:${idx}:${postId}`,
          url: u,
          type: 'image',
        }));
        post.media = validMedia as any;
        await post.save();
      } else {
        // Get media from cache (if needed)
        validMedia = await getPostMedia(post);
        if (validMedia) {
          post.media = validMedia as any;
          await post.save();
        }
      }

      // Publish PostCreatedEvent (normal fanout)
      await new PostCreatedPublisher(kafkaWrapper.producer).publish({
        id: post.id,
        userId: post.userId,
        authorIsAgent: post.authorIsAgent, // Read from stored model
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

