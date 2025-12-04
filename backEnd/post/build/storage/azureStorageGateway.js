"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyAzureStorageGateway = void 0;
const storage_blob_1 = require("@azure/storage-blob");
/**
 * Read-only Azure Storage Gateway for post service
 * This class only provides read operations - no write, create, or delete capabilities
 *
 * Note: For true read-only access, use a storage account key with read-only permissions
 * or a read-only SAS token. The code-level restrictions here prevent accidental writes.
 */
class ReadOnlyAzureStorageGateway {
    constructor(account, accountKey) {
        this.account = account;
        this.accountKey = accountKey;
        this.credential = new storage_blob_1.StorageSharedKeyCredential(account, accountKey);
        this.client = new storage_blob_1.BlobServiceClient(`https://${account}.blob.core.windows.net`, this.credential);
    }
    // Generate a read/download SAS URL (read-only operation)
    generateDownloadUrl(containerName_1, blobName_1) {
        return __awaiter(this, arguments, void 0, function* (containerName, blobName, expiresSeconds = 900) {
            const containerClient = this.client.getContainerClient(containerName);
            const blobClient = containerClient.getBlobClient(blobName);
            const expiresOn = new Date(Date.now() + expiresSeconds * 1000);
            const permissions = storage_blob_1.BlobSASPermissions.parse("r"); // read
            const sasOptions = {
                containerName,
                blobName,
                permissions,
                startsOn: new Date(Date.now() - 5 * 60 * 1000),
                expiresOn,
                protocol: storage_blob_1.SASProtocol.Https,
            };
            const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)(sasOptions, this.credential).toString();
            return `${blobClient.url}?${sasToken}`;
        });
    }
    // Parse Azure blob URL to extract container and blob name
    // Format: https://<account>.blob.core.windows.net/<container>/<blob-name>
    parseBlobUrl(blobUrl) {
        try {
            const url = new URL(blobUrl);
            const pathParts = url.pathname.split('/').filter(Boolean);
            if (pathParts.length < 2) {
                return null;
            }
            const container = pathParts[0];
            const blobName = pathParts.slice(1).join('/');
            return { container, blobName };
        }
        catch (_a) {
            return null;
        }
    }
}
exports.ReadOnlyAzureStorageGateway = ReadOnlyAzureStorageGateway;
