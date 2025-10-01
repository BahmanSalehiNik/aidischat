export interface StorageGateway {
  generateUploadUrl(
    key: string,
    contentType: string,
    bucket: string
  ): Promise<string>;

  generateDownloadUrl(
    key: string,
    bucket: string
  ): Promise<string>;

  deleteObject(
    key: string,
    bucket: string
  ): Promise<void>;
}