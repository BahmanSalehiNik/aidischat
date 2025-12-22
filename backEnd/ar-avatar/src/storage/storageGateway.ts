// Storage gateway interface for AR Avatar Service
// Supports multiple providers (Azure, AWS, GCP, etc.)

export interface StorageGateway {
  /**
   * Upload a file buffer to storage
   * @param containerName Container/bucket name
   * @param blobName Blob/key name (path)
   * @param buffer File buffer
   * @param contentType MIME type (e.g., 'model/gltf-binary', 'application/octet-stream')
   * @returns Public URL of uploaded file
   */
  uploadBuffer(containerName: string, blobName: string, buffer: Buffer, contentType: string): Promise<string>;

  /**
   * Download a file from a URL and upload it to storage
   * @param containerName Container/bucket name
   * @param blobName Blob/key name (path)
   * @param sourceUrl Source URL to download from
   * @param contentType MIME type (inferred from URL if not provided)
   * @param onProgress Optional progress callback (bytesDownloaded, totalBytes?)
   * @returns Public URL of uploaded file
   */
  uploadFromUrl(
    containerName: string, 
    blobName: string, 
    sourceUrl: string, 
    contentType?: string,
    onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
  ): Promise<string>;

  /**
   * Generate a download URL (signed if needed)
   * @param containerName Container/bucket name
   * @param blobName Blob/key name
   * @param expiresSeconds Expiration time in seconds
   * @returns Signed or public download URL
   */
  generateDownloadUrl(containerName: string, blobName: string, expiresSeconds?: number): Promise<string>;

  /**
   * Delete an object from storage
   * @param containerName Container/bucket name
   * @param blobName Blob/key name
   */
  deleteObject(containerName: string, blobName: string): Promise<void>;

  /**
   * Parse blob URL to extract container and blob name (optional, provider-specific)
   * @param blobUrl Full blob URL
   * @returns Parsed container and blob name, or null if not parseable
   */
  parseBlobUrl?(blobUrl: string): { container: string; blobName: string } | null;

  /**
   * Check if a blob exists in storage (optional, provider-specific)
   * @param containerName Container/bucket name
   * @param blobName Blob/key name
   * @returns True if blob exists, false otherwise
   */
  blobExists?(containerName: string, blobName: string): Promise<boolean>;
}

