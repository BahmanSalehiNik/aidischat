import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { NotAuthorizedError, validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { Media, MediaType, StorageProvider } from '../models/media';
import { MediaCreatedPublisher } from '../events/publishers/mediaPublisher';
import { kafkaWrapper } from '../kafka-client';
import { User } from '../models/user';

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
    const { provider, bucket, key, url, type, size, relatedResource, ownerId } = req.body;
    const viewerId = req.jwtPayload!.id;

    // Allow registering media for:
    // - self (ownerId omitted or == viewerId)
    // - an owned agent (ownerId == agentId and User projection says isAgent + ownerUserId == viewerId)
    let resolvedOwnerId = viewerId;
    if (ownerId && typeof ownerId === 'string' && ownerId.trim()) {
      resolvedOwnerId = ownerId.trim();
      if (resolvedOwnerId !== viewerId) {
        const owner = await User.findById(resolvedOwnerId).lean();
        const ok = Boolean(owner?.isAgent && owner?.ownerUserId === viewerId);
        if (!ok) {
          throw new NotAuthorizedError(['not authorized']);
        }
      }
    }

    const media = Media.build({
      userId: resolvedOwnerId,
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
