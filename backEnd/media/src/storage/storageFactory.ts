// src/services/storage-factory.ts
import { AwsStorageGateway } from './aws-storage-gateway';
import { GcpStorageGateway } from './gcp-storage-gateway';
import { StorageGateway } from './storage-gateway';
import { StorageProvider } from '../models/media';

export class StorageFactory {
  static create(provider: StorageProvider): StorageGateway {
    switch (provider) {
      case StorageProvider.AWS:
        return new AwsStorageGateway(
          process.env.AWS_REGION!,
          process.env.AWS_ACCESS_KEY_ID!,
          process.env.AWS_SECRET_ACCESS_KEY!
        );
      case StorageProvider.GCP:
        return new GcpStorageGateway(
          process.env.GCP_PROJECT_ID!,
          process.env.GCP_KEYFILE_PATH! // path to service account JSON
        );
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}
