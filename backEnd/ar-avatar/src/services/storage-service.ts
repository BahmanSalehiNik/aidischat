import axios from 'axios';
import { AVATAR_CONFIG } from '../config/constants';

export interface UploadResult {
  url: string;
  key: string;
  container?: string;
}

export class StorageService {
  /**
   * Upload model file to object storage (Azure Blob / S3)
   */
  async uploadModel(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<UploadResult> {
    if (AVATAR_CONFIG.STORAGE_PROVIDER === 'azure') {
      return this.uploadToAzure(fileBuffer, fileName, contentType);
    } else if (AVATAR_CONFIG.STORAGE_PROVIDER === 's3') {
      return this.uploadToS3(fileBuffer, fileName, contentType);
    } else {
      throw new Error(`Unsupported storage provider: ${AVATAR_CONFIG.STORAGE_PROVIDER}`);
    }
  }

  /**
   * Generate CDN URL from storage key
   */
  generateCDNUrl(key: string): string {
    if (AVATAR_CONFIG.CDN_BASE_URL) {
      return `${AVATAR_CONFIG.CDN_BASE_URL}/${key}`;
    }
    // Fallback: return storage URL (will be replaced with CDN later)
    return key;
  }

  private async uploadToAzure(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<UploadResult> {
    // TODO: Implement Azure Blob Storage upload
    // For now, return placeholder
    console.log('[StorageService] Azure upload (placeholder)');
    
    const key = `avatars/${Date.now()}/${fileName}`;
    const url = `https://storage.example.com/${key}`;
    
    return {
      url,
      key,
      container: 'avatars',
    };
  }

  private async uploadToS3(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<UploadResult> {
    // TODO: Implement S3 upload
    // For now, return placeholder
    console.log('[StorageService] S3 upload (placeholder)');
    
    const key = `avatars/${Date.now()}/${fileName}`;
    const url = `https://s3.example.com/${key}`;
    
    return {
      url,
      key,
    };
  }

  /**
   * Download model from provider URL and upload to storage
   */
  async downloadAndStore(providerUrl: string, fileName: string): Promise<UploadResult> {
    console.log(`[StorageService] Downloading from ${providerUrl}...`);
    
    // Download from provider
    const response = await axios.get(providerUrl, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 seconds
    });

    const fileBuffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'application/octet-stream';

    // Upload to storage
    return this.uploadModel(fileBuffer, fileName, contentType);
  }
}

export const storageService = new StorageService();

