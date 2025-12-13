import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  BlobSASSignatureValues
} from '@azure/storage-blob';
import { StorageContainer } from '../models/media';

export class AzureStorageGateway {
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

  // Ensure container exists, create if it doesn't
  // Only creates containers from the allowed StorageContainer enum
  async ensureContainerExists(containerName: string): Promise<void> {
    // Validate container name is in allowed set
    const allowedContainers = Object.values(StorageContainer);
    if (!allowedContainers.includes(containerName as StorageContainer)) {
      throw new Error(
        `Container "${containerName}" is not allowed. Allowed containers: ${allowedContainers.join(', ')}`
      );
    }

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

  // generate an upload SAS URL for a blob (BlockBlob)
  async generateUploadUrl(containerName: string, blobName: string, contentType: string, expiresSeconds = 60): Promise<string> {
    // Ensure container exists before generating URL
    await this.ensureContainerExists(containerName);
    
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);

    const expiresOn = new Date(Date.now() + expiresSeconds * 1000);

    const permissions = BlobSASPermissions.parse("cw"); // create + write
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

  // generate a read/download SAS URL
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

  // Parse Azure blob URL to extract container and blob name
  // Format: https://<account>.blob.core.windows.net/<container>/<blob-name>
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

  // delete
  async deleteObject(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.deleteIfExists();
  }
}