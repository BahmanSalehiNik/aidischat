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
exports.storageService = exports.StorageService = void 0;
const constants_1 = require("../config/constants");
const storageFactory_1 = require("../storage/storageFactory");
class StorageService {
    constructor() {
        // Initialize storage gateway using factory
        const provider = storageFactory_1.StorageFactory.getProviderFromEnv();
        this.storageGateway = storageFactory_1.StorageFactory.create(provider);
        this.containerName = constants_1.AVATAR_CONFIG.STORAGE_CONTAINER;
        console.log(`[StorageService] Initialized with provider: ${provider}, container: ${this.containerName}`);
    }
    /**
     * Upload model file to object storage (Azure Blob / S3)
     */
    uploadModel(fileBuffer_1, fileName_1) {
        return __awaiter(this, arguments, void 0, function* (fileBuffer, fileName, contentType = 'application/octet-stream') {
            // Generate blob key: avatars/{timestamp}/{fileName}
            const timestamp = Date.now();
            const key = `avatars/${timestamp}/${fileName}`;
            console.log(`[StorageService] Uploading ${fileName} (${fileBuffer.length} bytes) to ${this.containerName}/${key}`);
            // Upload using storage gateway
            const url = yield this.storageGateway.uploadBuffer(this.containerName, key, fileBuffer, contentType);
            // Generate CDN URL if configured
            const finalUrl = this.generateCDNUrl(key) || url;
            return {
                url: finalUrl,
                key,
                container: this.containerName,
            };
        });
    }
    /**
     * Generate CDN URL from storage key
     * Returns CDN URL if configured, otherwise returns empty string (caller should use storage URL)
     */
    generateCDNUrl(key) {
        if (constants_1.AVATAR_CONFIG.CDN_BASE_URL) {
            return `${constants_1.AVATAR_CONFIG.CDN_BASE_URL}/${key}`;
        }
        // Return empty string - caller should use the storage URL from uploadResult
        return '';
    }
    /**
     * Download model from provider URL and upload to storage
     * Supports progress tracking and automatic retries
     */
    downloadAndStore(providerUrl, fileName, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[StorageService] Downloading from ${providerUrl}...`);
            // Generate blob key
            const timestamp = Date.now();
            const key = `avatars/${timestamp}/${fileName}`;
            // Use storage gateway's uploadFromUrl method with progress tracking
            const url = yield this.storageGateway.uploadFromUrl(this.containerName, key, providerUrl, undefined, // contentType will be inferred
            onProgress);
            // Generate CDN URL if configured
            const finalUrl = this.generateCDNUrl(key) || url;
            return {
                url: finalUrl,
                key,
                container: this.containerName,
            };
        });
    }
    /**
     * Generate a signed download URL (useful for private containers)
     */
    generateDownloadUrl(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, expiresSeconds = 900) {
            return this.storageGateway.generateDownloadUrl(this.containerName, key, expiresSeconds);
        });
    }
    /**
     * Generate a signed download URL for any container/blob (for media service)
     * This allows the AR avatar service to sign URLs for media stored in other containers
     */
    generateSignedUrlForBlob(containerName_1, blobName_1) {
        return __awaiter(this, arguments, void 0, function* (containerName, blobName, expiresSeconds = 900) {
            return this.storageGateway.generateDownloadUrl(containerName, blobName, expiresSeconds);
        });
    }
    /**
     * Delete a model from storage
     */
    deleteModel(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storageGateway.deleteObject(this.containerName, key);
        });
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
