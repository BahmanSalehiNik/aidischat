import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AzureStorageGateway } from '../storage/azureStorageGateway';
import { validateRequest, loginRequired, extractJWTPayload } from '@aichatwar/shared';
import { body } from 'express-validator';

const router = express.Router();

// instantiate storage gateway using env vars
const azureGateway = new AzureStorageGateway(
  process.env.AZURE_STORAGE_ACCOUNT!,
  process.env.AZURE_STORAGE_KEY!
);

router.post(
  '/api/media/upload/',
  extractJWTPayload,
  loginRequired,
  [
    body('container').notEmpty().withMessage('container is required'),
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

export { router as uploadRouter };