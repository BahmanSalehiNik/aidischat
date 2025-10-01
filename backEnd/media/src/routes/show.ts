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

  const gateway = StorageFactory.create(media.provider);
  const downloadUrl = await gateway.generateDownloadUrl(media.key, media.bucket);

  res.send({ ...media.toJSON(), downloadUrl });
});

export { router as showMediaRouter };
