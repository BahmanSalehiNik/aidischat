/**
 * Listener for AgentFeedScannedEvent
 * Signs media URLs and forwards the event to AI Gateway
 */
import { Listener, Subjects, AgentFeedScannedEvent, EachMessagePayload } from '@aichatwar/shared';
import { kafkaWrapper } from '../../kafka-client';
import { AgentFeedScannedPublisher } from '../publishers/agentManagerPublishers';
import { StorageFactory, StorageProvider } from '../../storage/storageFactory';
import { AgentDraftComment } from '../../models/agent-draft-comment';

export class AgentFeedScannedListener extends Listener<AgentFeedScannedEvent> {
  readonly topic = Subjects.AgentFeedScanned;
  readonly groupId = 'agent-manager-agent-feed-scanned';
  protected fromBeginning: boolean = true;

  private storageGateway = StorageFactory.create(StorageFactory.getProviderFromEnv());
  private processedScanIds = new Set<string>(); // Track processed scan IDs to avoid infinite loops

  /**
   * Sign media URLs in posts
   */
  private async signMediaUrls(media: Array<{ id: string; url: string; type: string }> | undefined): Promise<Array<{ id: string; url: string; type: string }> | undefined> {
    if (!media || !Array.isArray(media) || media.length === 0) {
      return undefined;
    }

    // Filter out invalid media (where url === id, meaning it's just a placeholder)
    const validMediaItems = media.filter((mediaItem) => 
      mediaItem.url && mediaItem.url !== mediaItem.id && mediaItem.url !== ''
    );

    if (!validMediaItems.length) {
      return undefined;
    }

    try {
      // Sign each media URL
      const signedMedia = await Promise.all(
        validMediaItems.map(async (mediaItem) => {
          try {
            // Parse Azure blob URL
            if (this.storageGateway.parseBlobUrl) {
              const parsed = this.storageGateway.parseBlobUrl(mediaItem.url);
              if (parsed) {
                // Generate signed URL valid for 2 hours (7200 seconds) - enough time for AI processing
                const signedUrl = await this.storageGateway.generateDownloadUrl(
                  parsed.container,
                  parsed.blobName,
                  7200
                );
                return {
                  ...mediaItem,
                  url: signedUrl, // Use signed URL
                  originalUrl: mediaItem.url, // Keep original for reference
                };
              }
            }
            // Not an Azure blob URL, use as-is
            return mediaItem;
          } catch (error: any) {
            console.error(`[AgentFeedScannedListener] Error signing URL for media ${mediaItem.id}:`, error.message);
            return mediaItem; // Fallback to original URL
          }
        })
      );

      return signedMedia;
    } catch (error: any) {
      console.error('[AgentFeedScannedListener] Error signing media URLs:', error.message);
      return media; // Fallback to original media
    }
  }

  async onMessage(data: AgentFeedScannedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, ownerUserId, scanId, feedData, feedEntryIds, scanTimestamp, scanInterval } = data;

    // Check if we've already processed this scan (avoid infinite loops from republishing)
    if (scanId && this.processedScanIds.has(scanId)) {
      console.log(`[AgentFeedScannedListener] ⏭️  Skipping already processed scan ${scanId} (likely republished event)`);
      await this.ack();
      return;
    }

    // Check if URLs are already signed (if so, this is a republished event, skip)
    const hasSignedUrls = feedData.posts.some(post => 
      post.media?.some(mediaItem => {
        const url = mediaItem.url || '';
        return url.includes('?sig=') || url.includes('&sig=');
      })
    );

    if (hasSignedUrls) {
      console.log(`[AgentFeedScannedListener] ⏭️  Skipping event with already signed URLs (likely republished, scanId: ${scanId})`);
      await this.ack();
      return;
    }

    console.log(`[AgentFeedScannedListener] Received feed scan for agent ${agentId} (scanId: ${scanId})`);

    // Mark as processed (if scanId exists)
    if (scanId) {
      this.processedScanIds.add(scanId);
      
      // Clean up old scan IDs (keep last 1000 to prevent memory leak)
      if (this.processedScanIds.size > 1000) {
        const firstId = this.processedScanIds.values().next().value;
        if (firstId) {
          this.processedScanIds.delete(firstId);
        }
      }
    }

    try {
      // Sign media URLs in posts
      const postsWithSignedUrls = await Promise.all(
        feedData.posts.map(async (post) => {
          const signedMedia = await this.signMediaUrls(post.media);
          return {
            ...post,
            media: signedMedia,
          };
        })
      );

      // Decide whether AI Gateway should generate comment suggestions for this scan.
      //
      // Goal: avoid generating comments when the (approximate) per-post AI comment budget is already exhausted.
      //
      // Note: Until Feed provides explicit human/ai comment breakdown, we use a safe approximation:
      // - Treat feedData.posts[i].commentsCount as the "human baseline" for the cap (human + 3).
      // - Treat existing comment drafts (pending/approved) in agent-manager as AI-comment pressure.
      // - Enforce per-agent rule: at most 1 comment per post per agent (skip if agent already has a comment draft).
      const createComment = await this.computeCreateComment(agentId, feedData.posts);
      console.log(`[AgentFeedScannedListener] Comment suggestion gate for scanId ${scanId}: createComment=${createComment}`);

      // Create event data with signed URLs
      const signedFeedData = {
        ...feedData,
        posts: postsWithSignedUrls,
      };

      // Forward event to AI Gateway with signed URLs
      // Note: createComment is an additive field on the event payload; older shared typings may not include it yet.
      await new AgentFeedScannedPublisher(kafkaWrapper.producer).publish({
        agentId,
        ownerUserId,
        scanId,
        createComment,
        feedData: signedFeedData,
        feedEntryIds,
        scanTimestamp,
        scanInterval,
      } as any);

      console.log(`[AgentFeedScannedListener] ✅ Forwarded agent.feed.scanned event to AI Gateway with signed URLs for agent ${agentId} (scanId: ${scanId})`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentFeedScannedListener] ❌ Error processing feed scan for agent ${agentId}:`, {
        error: error.message,
        stack: error.stack,
        scanId,
      });
      // Don't throw - ack anyway to avoid blocking the queue
      await this.ack();
    }
  }

  private async computeCreateComment(
    agentId: string,
    posts: Array<{ id: string; commentsCount: number }>
  ): Promise<boolean> {
    if (!posts || posts.length === 0) return false;

    const postIds = posts.map((p) => p.id);

    // AI pressure approximation: count comment drafts (pending/approved) per post across all agents
    const draftsByPost = await AgentDraftComment.aggregate([
      { $match: { postId: { $in: postIds }, status: { $in: ['pending', 'approved'] } } },
      { $group: { _id: '$postId', count: { $sum: 1 } } },
    ]);
    const aiDraftCountByPostId = new Map<string, number>(draftsByPost.map((d: any) => [String(d._id), Number(d.count) || 0]));

    // Per-agent rule: if this agent already has a comment draft for that post, don't ask AI to create another
    const existingAgentDrafts = await AgentDraftComment.find({
      agentId,
      postId: { $in: postIds },
      status: { $in: ['pending', 'approved'] },
    })
      .select('postId')
      .lean();
    const agentHasDraftForPost = new Set<string>(existingAgentDrafts.map((d: any) => String(d.postId)));

    for (const p of posts) {
      const postId = String(p.id);
      if (agentHasDraftForPost.has(postId)) continue;

      const commentsCount = typeof p.commentsCount === 'number' ? p.commentsCount : 0;
      const maxAiAllowedApprox = commentsCount + 3;
      const aiDrafts = aiDraftCountByPostId.get(postId) || 0;

      if (aiDrafts < maxAiAllowedApprox) {
        return true; // At least one eligible post has capacity for 1 more AI comment draft
      }
    }

    return false;
  }
}

