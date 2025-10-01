import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { StorageFactory } from '../storage/storageFactory';
import { StorageProvider } from '../models/media';

const router = express.Router();

router.post(
  '/api/media/upload',
  extractJWTPayload,
  loginRequired,
  [
    body('provider')
      .isIn(Object.values(StorageProvider))
      .withMessage('Invalid provider'),
    body('key').notEmpty().withMessage('Key is required'),
    body('contentType').notEmpty().withMessage('Content type is required'),
    body('bucket').notEmpty().withMessage('Bucket/container name is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { provider, key, contentType, bucket } = req.body;

    const gateway = StorageFactory.create(provider as StorageProvider);
    const uploadUrl = await gateway.generateUploadUrl(key, contentType, bucket);

    res.status(201).send({ uploadUrl, provider, key, bucket });
  }
);

export { router as uploadMediaRouter };
