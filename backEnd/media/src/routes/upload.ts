import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { AzureStorageGateway } from '../storage/azureStorageGateway';
import { Media, MediaType, StorageContainer, StorageProvider } from '../models/media';
import { body } from 'express-validator';
import { MediaCreatedPublisher } from '../events/publishers/mediaPublisher';
import { kafkaWrapper } from '../kafka-client';

const router = express.Router();

// instantiate storage gateway using env vars
const azureGateway = new AzureStorageGateway(
  process.env.AZURE_STORAGE_ACCOUNT!,
  process.env.AZURE_STORAGE_KEY!
);

function requireInternalToken(req: Request, res: Response, next: any) {
  const expected = process.env.MEDIA_INTERNAL_TOKEN;
  const provided = req.header('x-internal-token');

  if (!expected) {
    return res.status(500).send({ error: 'MEDIA_INTERNAL_TOKEN is not configured' });
  }
  if (!provided || provided !== expected) {
    return res.status(401).send({ error: 'Unauthorized' });
  }
  next();
}

async function downloadToBuffer(sourceUrl: string, maxBytes: number): Promise<{ data: Buffer; contentType: string }> {
  const resp = await fetch(sourceUrl, { redirect: 'follow' as any });
  if (!resp.ok) {
    throw new Error(`Failed to download sourceUrl: ${resp.status} ${resp.statusText}`);
  }

  const contentLengthHeader = resp.headers.get('content-length');
  if (contentLengthHeader) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
      throw new Error(`Source file too large: ${contentLength} bytes (max ${maxBytes})`);
    }
  }

  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await resp.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  if (data.length > maxBytes) {
    throw new Error(`Source file too large after download: ${data.length} bytes (max ${maxBytes})`);
  }

  return { data, contentType };
}

router.post(
  '/api/media/upload/',
  extractJWTPayload,
  loginRequired,
  [
    body('container')
      .isIn(Object.values(StorageContainer))
      .withMessage(`container must be one of: ${Object.values(StorageContainer).join(', ')}`),
    body('contentType').notEmpty().withMessage('contentType is required'),
    body('filename').optional().isString(),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const userId = req.jwtPayload!.id;
    const { container, contentType, filename } = req.body;

    // choose a secure server-side key (namespaced by user)
    const ext = filename ? '.' + filename.split('.').pop() : '';
    const blobName = `users/${userId}/${uuidv4()}${ext}`;

    // generate sas
    const uploadUrl = await azureGateway.generateUploadUrl(container, blobName, contentType, 60);

    // return the upload URL and the blob path the client should report back
    res.status(201).send({ uploadUrl, provider: 'azure', container, key: blobName });
  }
);

/**
 * Internal: Import a public image URL into our storage and create a Media record.
 * Auth: x-internal-token === MEDIA_INTERNAL_TOKEN
 *
 * Body:
 * - userId: string (owner of the media)
 * - agentId?: string (optional namespace)
 * - sourceUrl: string (public image URL)
 * - container?: StorageContainer (default: posts)
 * - expiresSeconds?: number (default: 900) - returned downloadUrl SAS expiration
 */
router.post('/api/media/internal/import', requireInternalToken, async (req: Request, res: Response) => {
  const { userId, agentId, sourceUrl, container, expiresSeconds } = req.body || {};

  if (!userId || typeof userId !== 'string') {
    return res.status(400).send({ error: 'userId is required' });
  }
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return res.status(400).send({ error: 'sourceUrl is required' });
  }

  const targetContainer: string = container && typeof container === 'string' ? container : StorageContainer.Posts;
  const maxBytes = 8 * 1024 * 1024; // 8MB safety cap

  const { data, contentType } = await downloadToBuffer(sourceUrl, maxBytes);

  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg';

  const blobName = agentId
    ? `agents/${agentId}/${uuidv4()}.${ext}`
    : `users/${userId}/${uuidv4()}.${ext}`;

  const storageUrl = await azureGateway.uploadBuffer(targetContainer, blobName, data, contentType);

  const media = Media.build({
    userId,
    provider: StorageProvider.AZURE,
    bucket: targetContainer,
    key: blobName,
    url: storageUrl,
    type: MediaType.Image,
    size: data.length,
  });

  await media.save();

  await new MediaCreatedPublisher(kafkaWrapper.producer).publish({
    id: String(media.id),
    userId: media.userId,
    provider: media.provider,
    bucket: media.bucket,
    key: media.key,
    url: media.url,
    type: media.type,
    size: media.size,
    createdAt: media.createdAt.toISOString(),
  });

  const sasExpires = typeof expiresSeconds === 'number' ? expiresSeconds : 900;
  const downloadUrl = await azureGateway.generateDownloadUrl(targetContainer, blobName, sasExpires);

  res.status(201).send({
    id: String(media.id),
    provider: media.provider,
    bucket: media.bucket,
    key: media.key,
    url: media.url,
    downloadUrl,
    expiresIn: sasExpires,
    type: media.type,
    size: media.size,
  });
});

/**
 * Internal: resolve a media id to a signed download URL.
 * Auth: x-internal-token === MEDIA_INTERNAL_TOKEN
 */
router.get('/api/media/internal/:id', requireInternalToken, async (req: Request, res: Response) => {
  const media = await Media.findById(req.params.id).lean();
  if (!media) {
    return res.status(404).send({ error: 'Not found' });
  }

  const exp = parseInt(req.query.expiresSeconds as any) || 900;
  const downloadUrl = await azureGateway.generateDownloadUrl(media.bucket, media.key, exp);

  res.send({
    ...media,
    id: String((media as any)._id || (media as any).id),
    downloadUrl,
    expiresIn: exp,
  });
});

export { router as uploadRouter };