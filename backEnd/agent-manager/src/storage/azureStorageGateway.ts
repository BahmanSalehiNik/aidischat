// src/storage/azureStorageGateway.ts
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  BlobSASSignatureValues
} from '@azure/storage-blob';
import axios from 'axios';
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
      await containerClient.create({
        access: 'blob', // Public read access
      });
    }
  }

  /**
   * Upload a file buffer to Azure Storage
   */
  async uploadBuffer(containerName: string, blobName: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.ensureContainerExists(containerName);
    
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    });

    // Return public URL (container must have public read access)
    return blobClient.url;
  }

  /**
   * Download from URL and upload to Azure Storage
   */
  async uploadFromUrl(containerName: string, blobName: string, sourceUrl: string, contentType?: string): Promise<string> {
    console.log(`[AzureStorageGateway] Downloading from ${sourceUrl} and uploading to ${containerName}/${blobName}`);

    // Download the file
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    const buffer = Buffer.from(response.data);
    
    // Infer content type from URL or response headers if not provided
    const finalContentType = contentType || 
                            response.headers['content-type'] || 
                            this.inferContentTypeFromUrl(sourceUrl) ||
                            'application/octet-stream';

    return this.uploadBuffer(containerName, blobName, buffer, finalContentType);
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
      
      if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
      if (pathname.endsWith('.png')) return 'image/png';
      if (pathname.endsWith('.gif')) return 'image/gif';
      if (pathname.endsWith('.webp')) return 'image/webp';
      if (pathname.endsWith('.mp4')) return 'video/mp4';
      if (pathname.endsWith('.webm')) return 'video/webm';
      
      return null;
    } catch {
      return null;
    }
  }
}

