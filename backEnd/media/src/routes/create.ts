import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { Media, MediaType, StorageProvider } from '../models/media';
import { MediaCreatedPublisher } from '../events/publishers/mediaPublisher';
import { kafkaWrapper } from '../kafka-client';

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

    // Publish MediaCreated event with id and url (unsigned)
    // Ensure id is a string for consistent event handling
    await new MediaCreatedPublisher(kafkaWrapper.producer).publish({
      id: String(media.id),
      userId: media.userId,
      provider: media.provider,
      bucket: media.bucket,
      key: media.key,
      url: media.url, // unsigned URL
      type: media.type,
      size: media.size,
      createdAt: media.createdAt.toISOString(),
    });

    res.status(201).send(media);
  }
);

export { router as createMediaRouter };
