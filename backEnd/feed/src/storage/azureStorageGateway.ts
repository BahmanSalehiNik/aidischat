import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  BlobSASSignatureValues
} from '@azure/storage-blob';

/**
 * Read-only Azure Storage Gateway for feed service
 * This class only provides read operations - no write, create, or delete capabilities
 * 
 * Note: For true read-only access, use a storage account key with read-only permissions
 * or a read-only SAS token. The code-level restrictions here prevent accidental writes.
 */
export class ReadOnlyAzureStorageGateway {
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

  // Generate a read/download SAS URL (read-only operation)
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
}

