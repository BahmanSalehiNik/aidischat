import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Media } from '../models/media';
import { canViewOwnerContent } from '../utils/access';

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

    const query: any = { userId: ownerId };
    if (relatedType) {
      query['relatedResource.type'] = relatedType;
    }

    const media = await Media.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.send(media);
  }
);

export { router as listMediaByOwnerRouter };


