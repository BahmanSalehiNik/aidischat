import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageGateway } from './storageGateway';

class AwsStorageGateway implements StorageGateway {
  private s3: S3Client;

  constructor(region: string, accessKeyId: string, secretAccessKey: string) {
    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async generateUploadUrl(key: string, contentType: string, bucket: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 60 }); // 1 min
  }

  async generateDownloadUrl(key: string, bucket: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 min
  }

  async deleteObject(key: string, bucket: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await this.s3.send(command);
  }
}

export {AwsStorageGateway}