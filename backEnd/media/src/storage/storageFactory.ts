import { AwsStorageGateway } from './awsStorageGateway';
import { GcpStorageGateway } from './gcpStorageGateway';
import { AzureStorageGateway } from './azureStorageGateway';
import { StorageGateway } from './storageGateway';
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
          process.env.GCP_KEYFILE_PATH!
        );
      case StorageProvider.AZURE:
        return new AzureStorageGateway(
          process.env.AZURE_STORAGE_ACCOUNT!,
          process.env.AZURE_STORAGE_KEY!
        );
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}