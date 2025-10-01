// src/services/azure-storage-gateway.ts
import { BlobSASPermissions, BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import { StorageGateway } from './storageGateway';

export class AzureStorageGateway implements StorageGateway {
  private client: BlobServiceClient;

  constructor(accountName: string, accountKey: string) {
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    this.client = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
  }

  async generateUploadUrl(key: string, contentType: string, container: string): Promise<string> {
    const containerClient = this.client.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    const permissions = BlobSASPermissions.parse('cw');

    // NOTE: Azure uses SAS tokens for signed URLs.
    const expiresOn = new Date(new Date().valueOf() + 60 * 1000); // 1 min
    const sasUrl = await blobClient.generateSasUrl({
      permissions, // create + write
      expiresOn,
      contentType,
    });

    return sasUrl;
  }

  async generateDownloadUrl(key: string, container: string): Promise<string> {
    const permissions = BlobSASPermissions.parse('r');
    const containerClient = this.client.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(key);

    const expiresOn = new Date(new Date().valueOf() + 15 * 60 * 1000); // 15 min
    const sasUrl = await blobClient.generateSasUrl({
      permissions, // read
      expiresOn,
    });

    return sasUrl;
  }

  async deleteObject(key: string, container: string): Promise<void> {
    const containerClient = this.client.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(key);
    await blobClient.deleteIfExists();
  }
}
