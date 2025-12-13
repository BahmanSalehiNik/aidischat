// Azure Blob Storage Gateway implementation for AR Avatar Service
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  BlobSASSignatureValues
} from '@azure/storage-blob';
import axios, { AxiosResponse } from 'axios';
import { Readable, PassThrough } from 'stream';
import { AVATAR_CONFIG } from '../config/constants';
import { StorageGateway } from './storageGateway';

export class AzureStorageGateway implements StorageGateway {
  private account: string;
  private accountKey: string;
  private credential: StorageSharedKeyCredential;
  private client: BlobServiceClient;

  constructor(account: string, accountKey: string) {
    this.account = account;
    this.accountKey = accountKey;
    this.credential = new StorageSharedKeyCredential(account, accountKey);
    this.client = new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      this.credential
    );
  }

  /**
   * Ensure container exists, create if it doesn't
   */
  private async ensureContainerExists(containerName: string): Promise<void> {
    const containerClient = this.client.getContainerClient(containerName);
    const exists = await containerClient.exists();
    if (!exists) {
      try {
        // Create container without public access (private container)
        // We'll use SAS URLs for accessing blobs
        await containerClient.create();
        console.log(`[AzureStorageGateway] Created container: ${containerName} (private, using SAS URLs)`);
      } catch (error: any) {
        // If creation fails, check if container was created by another process
        const stillExists = await containerClient.exists();
        if (stillExists) {
          console.log(`[AzureStorageGateway] Container ${containerName} already exists`);
          return;
        }
        
        // If error is about public access, log and continue (container might be created manually)
        if (error.code === 'PublicAccessNotPermitted' || error.message?.includes('Public access is not permitted')) {
          console.warn(`[AzureStorageGateway] Cannot create container ${containerName} with public access. Container may need to be created manually, or will use SAS URLs.`);
          // Don't throw - we'll use SAS URLs for access
          return;
        }
        
        // For other errors, throw
        console.error(`[AzureStorageGateway] Failed to create container ${containerName}:`, error);
        throw error;
      }
    }
  }

  /**
   * Upload a file buffer to Azure Storage
   */
  async uploadBuffer(containerName: string, blobName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.ensureContainerExists(containerName);
    
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    console.log(`[AzureStorageGateway] Uploading ${blobName} (${buffer.length} bytes, ${contentType}) to container ${containerName}`);

    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    // Generate SAS URL for access (works with private containers)
    // SAS URL expires in 1 year (31536000 seconds)
    const sasUrl = await this.generateDownloadUrl(containerName, blobName, 31536000);
    console.log(`[AzureStorageGateway] ✅ Successfully uploaded: ${sasUrl}`);
    return sasUrl;
  }

  /**
   * Download from URL and upload to Azure Storage with streaming, retry logic, and progress tracking
   */
  async uploadFromUrl(
    containerName: string, 
    blobName: string, 
    sourceUrl: string, 
    contentType?: string,
    onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
  ): Promise<string> {
    console.log(`[AzureStorageGateway] Starting download from ${sourceUrl} and upload to ${containerName}/${blobName}`);

    const finalContentType = contentType || 
                            this.inferContentTypeFromUrl(sourceUrl) ||
                            'application/octet-stream';

    // Retry logic for download
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES; attempt++) {
      try {
        if (attempt > 1) {
          const delay = Math.min(
            AVATAR_CONFIG.STORAGE_RETRY_DELAY_MS * Math.pow(2, attempt - 2),
            AVATAR_CONFIG.STORAGE_MAX_RETRY_DELAY_MS
          );
          console.log(`[AzureStorageGateway] Retry attempt ${attempt}/${AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES} after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Stream download and upload
        return await this.streamDownloadAndUpload(
          containerName,
          blobName,
          sourceUrl,
          finalContentType,
          onProgress
        );
      } catch (error: any) {
        lastError = error;
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES) {
          console.error(`[AzureStorageGateway] Download/upload failed (attempt ${attempt}/${AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES}):`, error.message);
          throw error;
        }
        
        console.warn(`[AzureStorageGateway] Retryable error on attempt ${attempt}:`, error.message);
      }
    }

    throw lastError || new Error('Download/upload failed after all retries');
  }

  /**
   * Stream download from URL and upload to Azure Storage (no memory buffering)
   */
  private async streamDownloadAndUpload(
    containerName: string,
    blobName: string,
    sourceUrl: string,
    contentType: string,
    onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
  ): Promise<string> {
    await this.ensureContainerExists(containerName);
    
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    // Download as stream
    const response = await axios.get<Readable>(sourceUrl, {
      responseType: 'stream',
      timeout: AVATAR_CONFIG.STORAGE_DOWNLOAD_TIMEOUT_MS,
      maxContentLength: 500 * 1024 * 1024, // 500MB max (for large 3D models)
      maxBodyLength: 500 * 1024 * 1024,
    });

    const contentLength = response.headers['content-length'] 
      ? parseInt(response.headers['content-length'], 10) 
      : undefined;

    if (contentLength) {
      console.log(`[AzureStorageGateway] Downloading ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
    }

    // Create a pass-through stream to track progress while piping to Azure
    const progressStream = new PassThrough();
    let bytesDownloaded = 0;

    // Track progress on the original stream before piping
    response.data.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length;
      if (onProgress) {
        onProgress(bytesDownloaded, contentLength);
      }
    });

    response.data.on('end', () => {
      console.log(`[AzureStorageGateway] Download completed: ${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB`);
    });

    // Pipe response stream through progress stream (for progress tracking)
    response.data.pipe(progressStream);

    // Handle errors
    response.data.on('error', (error: Error) => {
      progressStream.destroy(error);
    });

    progressStream.on('error', (error: Error) => {
      console.error(`[AzureStorageGateway] Progress stream error:`, error);
    });

    // Upload stream directly to Azure (no memory buffering)
    console.log(`[AzureStorageGateway] Starting stream upload to ${containerName}/${blobName}...`);
    
    let uploadAttempt = 0;
    while (uploadAttempt < AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES) {
      try {
        uploadAttempt++;
        
        // If retrying, we need to re-download (streams can't be reused)
        if (uploadAttempt > 1) {
          const delay = Math.min(
            AVATAR_CONFIG.STORAGE_RETRY_DELAY_MS * Math.pow(2, uploadAttempt - 2),
            AVATAR_CONFIG.STORAGE_MAX_RETRY_DELAY_MS
          );
          console.log(`[AzureStorageGateway] Retrying upload (attempt ${uploadAttempt}/${AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Re-download for retry
          const retryResponse = await axios.get<Readable>(sourceUrl, {
            responseType: 'stream',
            timeout: AVATAR_CONFIG.STORAGE_DOWNLOAD_TIMEOUT_MS,
            maxContentLength: 500 * 1024 * 1024,
            maxBodyLength: 500 * 1024 * 1024,
          });
          
          bytesDownloaded = 0;
          const retryProgressStream = new PassThrough();
          
          retryResponse.data.on('data', (chunk: Buffer) => {
            bytesDownloaded += chunk.length;
            if (onProgress) {
              onProgress(bytesDownloaded, contentLength);
            }
          });
          
          retryResponse.data.on('error', (error: Error) => {
            retryProgressStream.destroy(error);
          });
          
          // Pipe retry response through progress stream
          retryResponse.data.pipe(retryProgressStream);
          
          await blobClient.uploadStream(retryProgressStream, undefined, undefined, {
            blobHTTPHeaders: {
              blobContentType: contentType,
            },
          });
        } else {
          // First attempt - use original stream
          await blobClient.uploadStream(progressStream, undefined, undefined, {
            blobHTTPHeaders: {
              blobContentType: contentType,
            },
          });
        }

        // Generate SAS URL for access (works with private containers)
        // SAS URL expires in 1 year (31536000 seconds)
        const sasUrl = await this.generateDownloadUrl(containerName, blobName, 31536000);
        console.log(`[AzureStorageGateway] ✅ Successfully uploaded: ${sasUrl} (${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB)`);
        return sasUrl;
      } catch (error: any) {
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || uploadAttempt === AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES) {
          console.error(`[AzureStorageGateway] Upload failed (attempt ${uploadAttempt}/${AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES}):`, error.message);
          throw error;
        }
        
        console.warn(`[AzureStorageGateway] Retryable upload error on attempt ${uploadAttempt}:`, error.message);
      }
    }

    throw new Error('Upload failed after all retries');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // HTTP errors
    if (error.response) {
      const status = error.response.status;
      // 5xx server errors and 429 (rate limit) are retryable
      return status >= 500 || status === 429;
    }
    
    // Azure SDK errors
    if (error.statusCode) {
      return error.statusCode >= 500 || error.statusCode === 429;
    }
    
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate a signed download URL
   */
  async generateDownloadUrl(containerName: string, blobName: string, expiresSeconds = 900): Promise<string> {
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const expiresOn = new Date(Date.now() + expiresSeconds * 1000);
    const permissions = BlobSASPermissions.parse("r"); // read
    const sasOptions: BlobSASSignatureValues = {
      containerName,
      blobName,
      permissions,
      startsOn: new Date(Date.now() - 5 * 60 * 1000),
      expiresOn,
      protocol: SASProtocol.Https,
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, this.credential).toString();
    return `${blobClient.url}?${sasToken}`;
  }

  /**
   * Delete an object from Azure Storage
   */
  async deleteObject(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.deleteIfExists();
    console.log(`[AzureStorageGateway] Deleted: ${containerName}/${blobName}`);
  }

  /**
   * Parse Azure blob URL to extract container and blob name
   * Format: https://<account>.blob.core.windows.net/<container>/<blob-name>
   */
  parseBlobUrl(blobUrl: string): { container: string; blobName: string } | null {
    try {
      const url = new URL(blobUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length < 2) {
        return null;
      }
      const container = pathParts[0];
      const blobName = pathParts.slice(1).join('/');
      return { container, blobName };
    } catch {
      return null;
    }
  }

  /**
   * Infer content type from URL extension
   */
  private inferContentTypeFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // 3D model formats
      if (pathname.endsWith('.glb')) return 'model/gltf-binary';
      if (pathname.endsWith('.gltf')) return 'model/gltf+json';
      if (pathname.endsWith('.fbx')) return 'application/octet-stream';
      if (pathname.endsWith('.obj')) return 'model/obj';
      if (pathname.endsWith('.usdz')) return 'model/usd';
      
      // Image formats
      if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
      if (pathname.endsWith('.png')) return 'image/png';
      if (pathname.endsWith('.gif')) return 'image/gif';
      if (pathname.endsWith('.webp')) return 'image/webp';
      
      // Video formats
      if (pathname.endsWith('.mp4')) return 'video/mp4';
      if (pathname.endsWith('.webm')) return 'video/webm';
      
      return null;
    } catch {
      return null;
    }
  }
}

