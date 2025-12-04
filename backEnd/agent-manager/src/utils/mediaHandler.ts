// src/utils/mediaHandler.ts
// Handles media downloads and uploads for agent drafts
import { StorageFactory, StorageProvider } from '../storage/storageFactory';
import { StorageGateway } from '../storage/storageGateway';
import { v4 as uuidv4 } from 'uuid';

export interface MediaUploadResult {
  url: string; // Public URL of uploaded media
  key: string; // Storage key/blob name
  container: string; // Container/bucket name
  contentType: string;
  size: number;
}

export class MediaHandler {
  private storageGateway: StorageGateway;
  private containerName: string;

  constructor(provider?: StorageProvider, containerName?: string) {
    const storageProvider = provider || StorageFactory.getProviderFromEnv();
    this.storageGateway = StorageFactory.create(storageProvider);
    this.containerName = containerName || process.env.AGENT_MANAGER_MEDIA_CONTAINER || 'agent-drafts';
  }

  /**
   * Download media from URL and upload to storage
   * @param sourceUrl Public URL to download from
   * @param agentId Agent ID (for namespacing)
   * @param contentType Optional content type (inferred if not provided)
   * @returns Upload result with public URL
   */
  async uploadMediaFromUrl(
    sourceUrl: string,
    agentId: string,
    contentType?: string
  ): Promise<MediaUploadResult> {
    console.log(`[MediaHandler] Uploading media from ${sourceUrl} for agent ${agentId}`);

    // Generate unique blob name: agents/{agentId}/{uuid}.{ext}
    const urlObj = new URL(sourceUrl);
    const pathname = urlObj.pathname.toLowerCase();
    const ext = this.getExtensionFromUrl(pathname) || '.jpg';
    const blobName = `agents/${agentId}/${uuidv4()}${ext}`;

    try {
      // Download and upload
      const publicUrl = await this.storageGateway.uploadFromUrl(
        this.containerName,
        blobName,
        sourceUrl,
        contentType
      );

      // Get file size (we'd need to download again or track it, but for now we'll estimate)
      // In production, you might want to track this during upload
      const size = 0; // TODO: Track size during upload

      console.log(`[MediaHandler] ✅ Successfully uploaded media: ${publicUrl}`);

      return {
        url: publicUrl,
        key: blobName,
        container: this.containerName,
        contentType: contentType || this.inferContentType(ext),
        size,
      };
    } catch (error: any) {
      console.error(`[MediaHandler] ❌ Error uploading media from ${sourceUrl}:`, error.message);
      throw new Error(`Failed to upload media: ${error.message}`);
    }
  }

  /**
   * Upload multiple media files from URLs
   * @param sourceUrls Array of public URLs
   * @param agentId Agent ID
   * @returns Array of upload results
   */
  async uploadMultipleMediaFromUrls(
    sourceUrls: string[],
    agentId: string
  ): Promise<MediaUploadResult[]> {
    const results: MediaUploadResult[] = [];

    // Upload in parallel (with concurrency limit to avoid overwhelming storage)
    const concurrencyLimit = 5;
    for (let i = 0; i < sourceUrls.length; i += concurrencyLimit) {
      const batch = sourceUrls.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.uploadMediaFromUrl(url, agentId))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`[MediaHandler] Failed to upload media:`, result.reason);
          // Continue with other uploads even if one fails
        }
      }
    }

    return results;
  }

  /**
   * Get file extension from URL path
   */
  private getExtensionFromUrl(pathname: string): string | null {
    const match = pathname.match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Infer content type from file extension
   */
  private inferContentType(ext: string): string {
    const extLower = ext.toLowerCase().replace('.', '');
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
    };
    return contentTypes[extLower] || 'application/octet-stream';
  }
}

