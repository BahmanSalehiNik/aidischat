import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
  BlobSASSignatureValues
} from '@azure/storage-blob';

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

  // generate an upload SAS URL for a blob (BlockBlob)
  async generateUploadUrl(containerName: string, blobName: string, contentType: string, expiresSeconds = 60): Promise<string> {
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

  // delete
  async deleteObject(containerName: string, blobName: string): Promise<void> {
    const containerClient = this.client.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    await blobClient.deleteIfExists();
  }
}