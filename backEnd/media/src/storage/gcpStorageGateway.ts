import { Storage } from '@google-cloud/storage';
import { StorageGateway } from './storageGateway';

class GcpStorageGateway implements StorageGateway {
  private storage: Storage;

  constructor(projectId: string, keyFilename: string) {
    this.storage = new Storage({ projectId, keyFilename });
  }

  async generateUploadUrl(bucket: string, key: string, contentType: string, expiresSeconds = 60): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + expiresSeconds * 1000, // default 1 min
      contentType,
    };

    const [url] = await this.storage.bucket(bucket).file(key).getSignedUrl(options);
    return url;
  }

  async generateDownloadUrl(bucket: string, key: string, expiresSeconds = 900): Promise<string> {
    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + expiresSeconds * 1000, // default 15 min
    };

    const [url] = await this.storage.bucket(bucket).file(key).getSignedUrl(options);
    return url;
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.storage.bucket(bucket).file(key).delete();
  }
}

export { GcpStorageGateway }