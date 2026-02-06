import express, { Request, Response } from 'express';
import { NotFoundError, extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Media, MediaType, StorageContainer, StorageProvider } from '../models/media';
import { StorageFactory } from '../storage/storageFactory';
import { AzureStorageGateway } from '../storage/azureStorageGateway';
import { MediaCreatedPublisher } from '../events/publishers/mediaPublisher';
import { kafkaWrapper } from '../kafka-client';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

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
  const resp = await fetch(sourceUrl, {
    redirect: 'follow' as any,
    headers: {
      // Some hosts (incl. Wikimedia/CDNs) may block default Node/undici user agents.
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/*,*/*;q=0.8',
    },
  });
  if (!resp.ok) {
    throw new Error(`Failed to download sourceUrl (${sourceUrl}): ${resp.status} ${resp.statusText}`);
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

/**
 * Internal: Import a public image URL into our storage and create a Media record.
 * Auth: x-internal-token === MEDIA_INTERNAL_TOKEN
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
  const maxBytes = 8 * 1024 * 1024; // 8MB
  let data: Buffer;
  let contentType: string;
  try {
    const downloaded = await downloadToBuffer(sourceUrl, maxBytes);
    data = downloaded.data;
    contentType = downloaded.contentType;
  } catch (err: any) {
    return res.status(400).send({ error: err?.message || 'Failed to download sourceUrl' });
  }

  // Only accept common raster images for this endpoint (prevents storing HTML/SVG as "images")
  const ct = (contentType || '').toLowerCase();
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.some((a) => ct.startsWith(a))) {
    return res.status(415).send({ error: `Unsupported image content-type for import (must be jpg/png/webp/gif): ${contentType || 'unknown'}` });
  }

  const azureGateway = new AzureStorageGateway(
    process.env.AZURE_STORAGE_ACCOUNT!,
    process.env.AZURE_STORAGE_KEY!
  );

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

  // Generate upload SAS, then upload bytes (server-side)
  const uploadUrl = await azureGateway.generateUploadUrl(targetContainer, blobName, contentType, 120);

  const putResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-ms-blob-type': 'BlockBlob',
    },
    body: data as any,
  });

  if (!putResp.ok) {
    const errText = await putResp.text();
    return res.status(502).send({ error: `Failed to upload to storage: ${putResp.status} ${errText}` });
  }

  const storageUrl = uploadUrl.split('?')[0];

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
  if (media.provider !== StorageProvider.AZURE) {
    return res.status(400).send({ error: `Unsupported provider for internal download: ${media.provider}` });
  }

  const azureGateway = new AzureStorageGateway(
    process.env.AZURE_STORAGE_ACCOUNT!,
    process.env.AZURE_STORAGE_KEY!
  );
  const downloadUrl = await azureGateway.generateDownloadUrl(media.bucket, media.key, exp);

  res.send({
    ...media,
    id: String((media as any)._id || (media as any).id),
    downloadUrl,
    expiresIn: exp,
  });
});

router.get('/api/media/:id', 
    extractJWTPayload, 
    loginRequired
    , async (req: Request, res: Response) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new NotFoundError();
  }

  console.log(media.key, media.bucket, "secret media")
  const gateway = StorageFactory.create(media.provider);

  // Get expiration time from query param (default: 15 minutes = 900 seconds)
  const expiresSeconds = parseInt(req.query.expiresSeconds as string) || 900;

  // Generate signed URL with configurable expiration
  const downloadUrl = await gateway.generateDownloadUrl(media.bucket, media.key, expiresSeconds);

  res.send({ 
    ...media.toJSON(), 
    downloadUrl,
    expiresIn: expiresSeconds,
  });
});

export { router as showMediaRouter };
