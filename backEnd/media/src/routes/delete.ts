import express, { Request, Response } from 'express';
import { NotFoundError, loginRequired, extractJWTPayload, NotAuthorizedError } from '@aichatwar/shared';
import { Media } from '../models/media';
import { StorageFactory } from '../storage/storageFactory';

const router = express.Router();

router.delete('/api/media/:id', 
    extractJWTPayload, 
    loginRequired, 
    async (req: Request, res: Response) => {
  const media = await Media.findById(req.params.id);

  if (!media) {
    throw new NotFoundError();
  }

  if (media.userId !== req.jwtPayload!.id) {
    throw new NotAuthorizedError(['not authorized']);
  }

  const gateway = StorageFactory.create(media.provider);
  await gateway.deleteObject(media.key, media.bucket);

  await media.deleteOne();
  res.status(204).send();
});

export { router as deleteMediaRouter };