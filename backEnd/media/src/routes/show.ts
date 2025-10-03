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

  //const tmp = "users/68dff279d529d32a67e12c82/42eed3c9-9afd-4ea8-8214-1ef36950e088.jpeg"
  const downloadUrl = await gateway.generateDownloadUrl(media.bucket, media.key)//media.key, media.bucket);

  res.send({ ...media.toJSON(), downloadUrl });
});

export { router as showMediaRouter };
