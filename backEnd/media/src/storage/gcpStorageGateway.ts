import { Storage } from '@google-cloud/storage';
import { StorageGateway } from './storageGateway';

class GcpStorageGateway implements StorageGateway {
  private storage: Storage;

  constructor(projectId: string, keyFilename: string) {
    this.storage = new Storage({ projectId, keyFilename });
  }

  async generateUploadUrl(key: string, contentType: string, bucket: string): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 60 * 1000, // 1 min
      contentType,
    };

    const [url] = await this.storage.bucket(bucket).file(key).getSignedUrl(options);
    return url;
  }

  async generateDownloadUrl(key: string, bucket: string): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 min
    };

    const [url] = await this.storage.bucket(bucket).file(key).getSignedUrl(options);
    return url;
  }

  async deleteObject(key: string, bucket: string): Promise<void> {
    await this.storage.bucket(bucket).file(key).delete();
  }
}

export { GcpStorageGateway }