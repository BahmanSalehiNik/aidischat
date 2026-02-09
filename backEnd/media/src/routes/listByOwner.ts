import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Media } from '../models/media';
import { canViewOwnerContent } from '../utils/access';
import { StorageFactory } from '../storage/storageFactory';

const router = express.Router();

/**
 * FB/Insta-style: list media belonging to a specific owner (user or agent),
 * optionally filtered by relatedResource.type (e.g. 'profile', 'profile:avatar', etc).
 *
 * GET /api/media/owner/:ownerId?relatedType=profile&limit=50&offset=0
 */
router.get(
  '/api/media/owner/:ownerId',
  extractJWTPayload,
  loginRequired,
  async (req: Request<{ ownerId: string }>, res: Response) => {
    const viewerId = req.jwtPayload!.id;
    const ownerId = String(req.params.ownerId || '');

    const allowed = await canViewOwnerContent(viewerId, ownerId);
    if (!allowed) {
      return res.status(403).send({ error: 'Forbidden' });
    }

    const relatedType = (req.query.relatedType as string | undefined)?.trim();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const expiresSecondsRaw = parseInt(req.query.expiresSeconds as string);
    const expiresSeconds = Math.min((Number.isFinite(expiresSecondsRaw) ? expiresSecondsRaw : 60 * 60 * 6) || 60 * 60 * 6, 60 * 60 * 24); // default 6h, cap 24h

    const query: any = { userId: ownerId };
    if (relatedType) {
      query['relatedResource.type'] = relatedType;
    }

    const media = await Media.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Attach signed download URLs for private containers (Azure/S3/GCS).
    // Keep original `url` for reference, but clients should prefer `downloadUrl`.
    const gatewayByProvider = new Map<string, any>();
    const withSigned = await Promise.all(
      (media || []).map(async (m: any) => {
        try {
          const provider = String(m.provider || '');
          if (!gatewayByProvider.has(provider)) {
            gatewayByProvider.set(provider, StorageFactory.create(m.provider));
          }
          const gateway = gatewayByProvider.get(provider);
          const downloadUrl = await gateway.generateDownloadUrl(m.bucket, m.key, expiresSeconds);
          return {
            ...m,
            id: String(m._id || m.id),
            downloadUrl,
            expiresIn: expiresSeconds,
          };
        } catch (err: any) {
          console.error('[media:listByOwner] Failed to generate downloadUrl', {
            ownerId,
            mediaId: String(m?._id || m?.id || ''),
            provider: m?.provider,
            bucket: m?.bucket,
            key: m?.key,
            error: err?.message || String(err),
          });
          return {
            ...m,
            id: String(m._id || m.id),
            downloadUrl: undefined,
            expiresIn: expiresSeconds,
          };
        }
      })
    );

    res.send(withSigned);
  }
);

export { router as listMediaByOwnerRouter };



