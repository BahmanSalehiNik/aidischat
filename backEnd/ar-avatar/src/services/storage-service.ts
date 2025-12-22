import { AVATAR_CONFIG } from '../config/constants';
import { StorageFactory, StorageProvider } from '../storage/storageFactory';
import { StorageGateway } from '../storage/storageGateway';

export interface UploadResult {
  url: string;
  key: string;
  container?: string;
}

export class StorageService {
  private storageGateway: StorageGateway;
  private containerName: string;
  
  // Expose storageGateway for texture extraction utility
  get gateway(): StorageGateway {
    return this.storageGateway;
  }

  constructor() {
    // Initialize storage gateway using factory
    const provider = StorageFactory.getProviderFromEnv();
    this.storageGateway = StorageFactory.create(provider);
    this.containerName = AVATAR_CONFIG.STORAGE_CONTAINER;
    console.log(`[StorageService] Initialized with provider: ${provider}, container: ${this.containerName}`);
  }

  /**
   * Upload model file to object storage (Azure Blob / S3)
   */
  async uploadModel(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<UploadResult> {
    // Generate blob key: avatars/{timestamp}/{fileName}
    const timestamp = Date.now();
    const key = `avatars/${timestamp}/${fileName}`;

    console.log(`[StorageService] Uploading ${fileName} (${fileBuffer.length} bytes) to ${this.containerName}/${key}`);

    // Upload using storage gateway
    const url = await this.storageGateway.uploadBuffer(
      this.containerName,
      key,
      fileBuffer,
      contentType
    );

    // Generate CDN URL if configured
    const finalUrl = this.generateCDNUrl(key) || url;

    return {
      url: finalUrl,
      key,
      container: this.containerName,
    };
  }

  /**
   * Generate CDN URL from storage key
   * Returns CDN URL if configured, otherwise returns empty string (caller should use storage URL)
   */
  generateCDNUrl(key: string): string {
    if (AVATAR_CONFIG.CDN_BASE_URL) {
      return `${AVATAR_CONFIG.CDN_BASE_URL}/${key}`;
    }
    // Return empty string - caller should use the storage URL from uploadResult
    return '';
  }

  /**
   * Download model from provider URL and upload to storage
   * Supports progress tracking and automatic retries
   */
  async downloadAndStore(
    providerUrl: string, 
    fileName: string,
    onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
  ): Promise<UploadResult> {
    console.log(`[StorageService] Downloading from ${providerUrl}...`);
    
    // Generate blob key
    const timestamp = Date.now();
    const key = `avatars/${timestamp}/${fileName}`;

    // Use storage gateway's uploadFromUrl method with progress tracking
    const url = await this.storageGateway.uploadFromUrl(
      this.containerName,
      key,
      providerUrl,
      undefined, // contentType will be inferred
      onProgress
    );

    // Generate CDN URL if configured
    const finalUrl = this.generateCDNUrl(key) || url;

    return {
      url: finalUrl,
      key,
      container: this.containerName,
    };
  }

  /**
   * Generate a signed download URL (useful for private containers)
   */
  async generateDownloadUrl(key: string, expiresSeconds: number = 900): Promise<string> {
    return this.storageGateway.generateDownloadUrl(this.containerName, key, expiresSeconds);
  }

  /**
   * Generate a signed download URL for any container/blob (for media service)
   * This allows the AR avatar service to sign URLs for media stored in other containers
   */
  async generateSignedUrlForBlob(
    containerName: string,
    blobName: string,
    expiresSeconds: number = 900
  ): Promise<string> {
    return this.storageGateway.generateDownloadUrl(containerName, blobName, expiresSeconds);
  }

  /**
   * Delete a model from storage
   */
  async deleteModel(key: string): Promise<void> {
    await this.storageGateway.deleteObject(this.containerName, key);
  }
}

export const storageService = new StorageService();

