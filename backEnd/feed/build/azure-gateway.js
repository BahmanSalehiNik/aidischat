"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.azureGateway = void 0;
// Shared Azure Storage Gateway instance for feed service
const azureStorageGateway_1 = require("./storage/azureStorageGateway");
// Initialize read-only Azure Storage Gateway if credentials are available
exports.azureGateway = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    exports.azureGateway = new azureStorageGateway_1.ReadOnlyAzureStorageGateway(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY);
    console.log('[AzureGateway] Initialized for signed URL generation');
}
else {
    console.log('[AzureGateway] Azure Storage credentials not found - signed URL generation disabled');
}
