export interface StorageGateway {
  generateUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    expiresSeconds?: number
  ): Promise<string>;

  generateDownloadUrl(
    bucket: string,
    key: string,
    expiresSeconds?: number
  ): Promise<string>;

  deleteObject(
    bucket: string,
    key: string
  ): Promise<void>;
}