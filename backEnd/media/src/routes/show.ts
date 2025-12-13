import express, { Request, Response } from 'express';
import { NotFoundError, extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Media } from '../models/media';
import { StorageFactory } from '../storage/storageFactory';

const router = express.Router();

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
