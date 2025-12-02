/**
 * Listener for AgentFeedScannedEvent
 * Signs media URLs and forwards the event to AI Gateway
 */
import { Listener, Subjects, AgentFeedScannedEvent, EachMessagePayload } from '@aichatwar/shared';
import { kafkaWrapper } from '../../kafka-client';
import { AgentFeedScannedPublisher } from '../publishers/agentManagerPublishers';
import { StorageFactory, StorageProvider } from '../../storage/storageFactory';

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

      // Create event data with signed URLs
      const signedFeedData = {
        ...feedData,
        posts: postsWithSignedUrls,
      };

      // Forward event to AI Gateway with signed URLs
      await new AgentFeedScannedPublisher(kafkaWrapper.producer).publish({
        agentId,
        ownerUserId,
        scanId,
        feedData: signedFeedData,
        feedEntryIds,
        scanTimestamp,
        scanInterval,
      });

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
}

