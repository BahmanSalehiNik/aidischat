import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { Media, MediaType, StorageProvider } from '../models/media';

const router = express.Router();

router.post(
  '/api/media/',
  extractJWTPayload,
  loginRequired,
  [
    body('provider')
      .isIn(Object.values(StorageProvider))
      .withMessage('Invalid provider'),
    body('bucket').notEmpty().withMessage('Bucket is required'),
    body('key').notEmpty().withMessage('Key is required'),
    body('url').isURL().withMessage('URL is required'),
    body('type').isIn(Object.values(MediaType)).withMessage('Invalid media type'),
    body('size').isInt({ min: 1 }).withMessage('Size must be positive'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { provider, bucket, key, url, type, size, relatedResource } = req.body;

    const media = Media.build({
      userId: req.jwtPayload!.id,
      provider,
      bucket,
      key,
      url,
      type,
      size,
      relatedResource,
    });

    await media.save();
    res.status(201).send(media);
  }
);

export { router as createMediaRouter };
