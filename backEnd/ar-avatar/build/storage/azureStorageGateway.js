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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureStorageGateway = void 0;
// Azure Blob Storage Gateway implementation for AR Avatar Service
const storage_blob_1 = require("@azure/storage-blob");
const axios_1 = __importDefault(require("axios"));
const stream_1 = require("stream");
const constants_1 = require("../config/constants");
class AzureStorageGateway {
    constructor(account, accountKey) {
        this.account = account;
        this.accountKey = accountKey;
        this.credential = new storage_blob_1.StorageSharedKeyCredential(account, accountKey);
        this.client = new storage_blob_1.BlobServiceClient(`https://${account}.blob.core.windows.net`, this.credential);
    }
    /**
     * Ensure container exists, create if it doesn't
     */
    ensureContainerExists(containerName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const containerClient = this.client.getContainerClient(containerName);
            const exists = yield containerClient.exists();
            if (!exists) {
                try {
                    // Create container without public access (private container)
                    // We'll use SAS URLs for accessing blobs
                    yield containerClient.create();
                    console.log(`[AzureStorageGateway] Created container: ${containerName} (private, using SAS URLs)`);
                }
                catch (error) {
                    // If creation fails, check if container was created by another process
                    const stillExists = yield containerClient.exists();
                    if (stillExists) {
                        console.log(`[AzureStorageGateway] Container ${containerName} already exists`);
                        return;
                    }
                    // If error is about public access, log and continue (container might be created manually)
                    if (error.code === 'PublicAccessNotPermitted' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('Public access is not permitted'))) {
                        console.warn(`[AzureStorageGateway] Cannot create container ${containerName} with public access. Container may need to be created manually, or will use SAS URLs.`);
                        // Don't throw - we'll use SAS URLs for access
                        return;
                    }
                    // For other errors, throw
                    console.error(`[AzureStorageGateway] Failed to create container ${containerName}:`, error);
                    throw error;
                }
            }
        });
    }
    /**
     * Upload a file buffer to Azure Storage
     */
    uploadBuffer(containerName, blobName, buffer, contentType) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureContainerExists(containerName);
            const containerClient = this.client.getContainerClient(containerName);
            const blobClient = containerClient.getBlockBlobClient(blobName);
            console.log(`[AzureStorageGateway] Uploading ${blobName} (${buffer.length} bytes, ${contentType}) to container ${containerName}`);
            yield blobClient.upload(buffer, buffer.length, {
                blobHTTPHeaders: {
                    blobContentType: contentType,
                },
            });
            // Generate SAS URL for access (works with private containers)
            // SAS URL expires in 1 year (31536000 seconds)
            const sasUrl = yield this.generateDownloadUrl(containerName, blobName, 31536000);
            console.log(`[AzureStorageGateway] ✅ Successfully uploaded: ${sasUrl}`);
            return sasUrl;
        });
    }
    /**
     * Download from URL and upload to Azure Storage with streaming, retry logic, and progress tracking
     */
    uploadFromUrl(containerName, blobName, sourceUrl, contentType, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`[AzureStorageGateway] Starting download from ${sourceUrl} and upload to ${containerName}/${blobName}`);
            const finalContentType = contentType ||
                this.inferContentTypeFromUrl(sourceUrl) ||
                'application/octet-stream';
            // Retry logic for download
            let lastError = null;
            for (let attempt = 1; attempt <= constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES; attempt++) {
                try {
                    if (attempt > 1) {
                        const delay = Math.min(constants_1.AVATAR_CONFIG.STORAGE_RETRY_DELAY_MS * Math.pow(2, attempt - 2), constants_1.AVATAR_CONFIG.STORAGE_MAX_RETRY_DELAY_MS);
                        console.log(`[AzureStorageGateway] Retry attempt ${attempt}/${constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES} after ${delay}ms delay`);
                        yield new Promise(resolve => setTimeout(resolve, delay));
                    }
                    // Stream download and upload
                    return yield this.streamDownloadAndUpload(containerName, blobName, sourceUrl, finalContentType, onProgress);
                }
                catch (error) {
                    lastError = error;
                    const isRetryable = this.isRetryableError(error);
                    if (!isRetryable || attempt === constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES) {
                        console.error(`[AzureStorageGateway] Download/upload failed (attempt ${attempt}/${constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_RETRIES}):`, error.message);
                        throw error;
                    }
                    console.warn(`[AzureStorageGateway] Retryable error on attempt ${attempt}:`, error.message);
                }
            }
            throw lastError || new Error('Download/upload failed after all retries');
        });
    }
    /**
     * Stream download from URL and upload to Azure Storage (no memory buffering)
     */
    streamDownloadAndUpload(containerName, blobName, sourceUrl, contentType, onProgress) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureContainerExists(containerName);
            const containerClient = this.client.getContainerClient(containerName);
            const blobClient = containerClient.getBlockBlobClient(blobName);
            // Download as stream
            const response = yield axios_1.default.get(sourceUrl, {
                responseType: 'stream',
                timeout: constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_TIMEOUT_MS,
                maxContentLength: 500 * 1024 * 1024, // 500MB max (for large 3D models)
                maxBodyLength: 500 * 1024 * 1024,
            });
            const contentLength = response.headers['content-length']
                ? parseInt(response.headers['content-length'], 10)
                : undefined;
            if (contentLength) {
                console.log(`[AzureStorageGateway] Downloading ${(contentLength / 1024 / 1024).toFixed(2)} MB`);
            }
            // Create a pass-through stream to track progress while piping to Azure
            const progressStream = new stream_1.PassThrough();
            let bytesDownloaded = 0;
            // Track progress on the original stream before piping
            response.data.on('data', (chunk) => {
                bytesDownloaded += chunk.length;
                if (onProgress) {
                    onProgress(bytesDownloaded, contentLength);
                }
            });
            response.data.on('end', () => {
                console.log(`[AzureStorageGateway] Download completed: ${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB`);
            });
            // Pipe response stream through progress stream (for progress tracking)
            response.data.pipe(progressStream);
            // Handle errors
            response.data.on('error', (error) => {
                progressStream.destroy(error);
            });
            progressStream.on('error', (error) => {
                console.error(`[AzureStorageGateway] Progress stream error:`, error);
            });
            // Upload stream directly to Azure (no memory buffering)
            console.log(`[AzureStorageGateway] Starting stream upload to ${containerName}/${blobName}...`);
            let uploadAttempt = 0;
            while (uploadAttempt < constants_1.AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES) {
                try {
                    uploadAttempt++;
                    // If retrying, we need to re-download (streams can't be reused)
                    if (uploadAttempt > 1) {
                        const delay = Math.min(constants_1.AVATAR_CONFIG.STORAGE_RETRY_DELAY_MS * Math.pow(2, uploadAttempt - 2), constants_1.AVATAR_CONFIG.STORAGE_MAX_RETRY_DELAY_MS);
                        console.log(`[AzureStorageGateway] Retrying upload (attempt ${uploadAttempt}/${constants_1.AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES}) after ${delay}ms`);
                        yield new Promise(resolve => setTimeout(resolve, delay));
                        // Re-download for retry
                        const retryResponse = yield axios_1.default.get(sourceUrl, {
                            responseType: 'stream',
                            timeout: constants_1.AVATAR_CONFIG.STORAGE_DOWNLOAD_TIMEOUT_MS,
                            maxContentLength: 500 * 1024 * 1024,
                            maxBodyLength: 500 * 1024 * 1024,
                        });
                        bytesDownloaded = 0;
                        const retryProgressStream = new stream_1.PassThrough();
                        retryResponse.data.on('data', (chunk) => {
                            bytesDownloaded += chunk.length;
                            if (onProgress) {
                                onProgress(bytesDownloaded, contentLength);
                            }
                        });
                        retryResponse.data.on('error', (error) => {
                            retryProgressStream.destroy(error);
                        });
                        // Pipe retry response through progress stream
                        retryResponse.data.pipe(retryProgressStream);
                        yield blobClient.uploadStream(retryProgressStream, undefined, undefined, {
                            blobHTTPHeaders: {
                                blobContentType: contentType,
                            },
                        });
                    }
                    else {
                        // First attempt - use original stream
                        yield blobClient.uploadStream(progressStream, undefined, undefined, {
                            blobHTTPHeaders: {
                                blobContentType: contentType,
                            },
                        });
                    }
                    // Generate SAS URL for access (works with private containers)
                    // SAS URL expires in 1 year (31536000 seconds)
                    const sasUrl = yield this.generateDownloadUrl(containerName, blobName, 31536000);
                    console.log(`[AzureStorageGateway] ✅ Successfully uploaded: ${sasUrl} (${(bytesDownloaded / 1024 / 1024).toFixed(2)} MB)`);
                    return sasUrl;
                }
                catch (error) {
                    const isRetryable = this.isRetryableError(error);
                    if (!isRetryable || uploadAttempt === constants_1.AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES) {
                        console.error(`[AzureStorageGateway] Upload failed (attempt ${uploadAttempt}/${constants_1.AVATAR_CONFIG.STORAGE_UPLOAD_RETRIES}):`, error.message);
                        throw error;
                    }
                    console.warn(`[AzureStorageGateway] Retryable upload error on attempt ${uploadAttempt}:`, error.message);
                }
            }
            throw new Error('Upload failed after all retries');
        });
    }
    /**
     * Check if an error is retryable
     */
    isRetryableError(error) {
        var _a;
        // Network errors
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return true;
        }
        // HTTP errors
        if (error.response) {
            const status = error.response.status;
            // 5xx server errors and 429 (rate limit) are retryable
            return status >= 500 || status === 429;
        }
        // Azure SDK errors
        if (error.statusCode) {
            return error.statusCode >= 500 || error.statusCode === 429;
        }
        // Timeout errors
        if (error.code === 'ECONNABORTED' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('timeout'))) {
            return true;
        }
        return false;
    }
    /**
     * Generate a signed download URL
     */
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
    /**
     * Delete an object from Azure Storage
     */
    deleteObject(containerName, blobName) {
        return __awaiter(this, void 0, void 0, function* () {
            const containerClient = this.client.getContainerClient(containerName);
            const blobClient = containerClient.getBlockBlobClient(blobName);
            yield blobClient.deleteIfExists();
            console.log(`[AzureStorageGateway] Deleted: ${containerName}/${blobName}`);
        });
    }
    /**
     * Parse Azure blob URL to extract container and blob name
     * Format: https://<account>.blob.core.windows.net/<container>/<blob-name>
     */
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
    /**
     * Infer content type from URL extension
     */
    inferContentTypeFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            // 3D model formats
            if (pathname.endsWith('.glb'))
                return 'model/gltf-binary';
            if (pathname.endsWith('.gltf'))
                return 'model/gltf+json';
            if (pathname.endsWith('.fbx'))
                return 'application/octet-stream';
            if (pathname.endsWith('.obj'))
                return 'model/obj';
            if (pathname.endsWith('.usdz'))
                return 'model/usd';
            // Image formats
            if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg'))
                return 'image/jpeg';
            if (pathname.endsWith('.png'))
                return 'image/png';
            if (pathname.endsWith('.gif'))
                return 'image/gif';
            if (pathname.endsWith('.webp'))
                return 'image/webp';
            // Video formats
            if (pathname.endsWith('.mp4'))
                return 'video/mp4';
            if (pathname.endsWith('.webm'))
                return 'video/webm';
            return null;
        }
        catch (_a) {
            return null;
        }
    }
}
exports.AzureStorageGateway = AzureStorageGateway;
