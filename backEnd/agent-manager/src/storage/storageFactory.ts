// src/storage/storageFactory.ts
import { StorageGateway } from './storageGateway';
import { AzureStorageGateway } from './azureStorageGateway';
// TODO: Add AWS, GCP, and other providers as needed
// import { AwsStorageGateway } from './awsStorageGateway';
// import { GcpStorageGateway } from './gcpStorageGateway';

export enum StorageProvider {
  AZURE = 'azure',
  AWS = 'aws',
  GCP = 'gcp',
  MINIO = 'minio',
}

export class StorageFactory {
  static create(provider: StorageProvider): StorageGateway {
    switch (provider) {
      case StorageProvider.AZURE:
        if (!process.env.AZURE_STORAGE_ACCOUNT || !process.env.AZURE_STORAGE_KEY) {
          throw new Error('Azure Storage credentials not configured (AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY)');
        }
        return new AzureStorageGateway(
          process.env.AZURE_STORAGE_ACCOUNT,
          process.env.AZURE_STORAGE_KEY
        );
      case StorageProvider.AWS:
        // TODO: Implement AWS storage gateway
        throw new Error('AWS storage provider not yet implemented');
      case StorageProvider.GCP:
        // TODO: Implement GCP storage gateway
        throw new Error('GCP storage provider not yet implemented');
      case StorageProvider.MINIO:
        // TODO: Implement MinIO storage gateway
        throw new Error('MinIO storage provider not yet implemented');
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }

  /**
   * Get storage provider from environment variable
   * Defaults to Azure if not specified
   */
  static getProviderFromEnv(): StorageProvider {
    const provider = process.env.AGENT_MANAGER_STORAGE_PROVIDER?.toLowerCase();
    if (provider && Object.values(StorageProvider).includes(provider as StorageProvider)) {
      return provider as StorageProvider;
    }
    return StorageProvider.AZURE; // Default to Azure
  }
}

