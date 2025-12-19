"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageFactory = exports.StorageProvider = void 0;
const azureStorageGateway_1 = require("./azureStorageGateway");
// TODO: Add AWS, GCP, and other providers as needed
// import { AwsStorageGateway } from './awsStorageGateway';
// import { GcpStorageGateway } from './gcpStorageGateway';
var StorageProvider;
(function (StorageProvider) {
    StorageProvider["AZURE"] = "azure";
    StorageProvider["AWS"] = "aws";
    StorageProvider["S3"] = "s3";
    StorageProvider["GCP"] = "gcp";
    StorageProvider["MINIO"] = "minio";
})(StorageProvider || (exports.StorageProvider = StorageProvider = {}));
class StorageFactory {
    /**
     * Create a storage gateway instance based on provider type
     */
    static create(provider) {
        const normalizedProvider = provider.toLowerCase();
        switch (normalizedProvider) {
            case StorageProvider.AZURE:
                if (!process.env.AZURE_STORAGE_ACCOUNT || !process.env.AZURE_STORAGE_KEY) {
                    throw new Error('Azure Storage credentials not configured (AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY)');
                }
                return new azureStorageGateway_1.AzureStorageGateway(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY);
            case StorageProvider.AWS:
            case StorageProvider.S3:
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
    static getProviderFromEnv() {
        var _a;
        const provider = (_a = process.env.STORAGE_PROVIDER) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (provider && Object.values(StorageProvider).includes(provider)) {
            return provider;
        }
        // Also handle 's3' as alias for AWS
        if (provider === 's3') {
            return StorageProvider.AWS;
        }
        return StorageProvider.AZURE; // Default to Azure
    }
}
exports.StorageFactory = StorageFactory;
