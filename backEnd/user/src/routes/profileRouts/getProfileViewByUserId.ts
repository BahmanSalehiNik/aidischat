import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, Visibility } from '@aichatwar/shared';
import { Types } from 'mongoose';
import { Profile } from '../../models/profile';
import { Friendship } from '../../models/friendship';

const router = express.Router();

/**
 * GET /api/users/profile/view/:userId
 * Viewer-aware profile endpoint (FB/Instagram style).
 */
router.get(
  '/api/users/profile/view/:userId',
  extractJWTPayload,
  loginRequired,
  async (req: Request<{ userId: string }>, res: Response) => {
    const viewerId = req.jwtPayload!.id;
    const ownerUserId = String(req.params.userId || '');

    if (!Types.ObjectId.isValid(ownerUserId)) {
      return res.status(400).send({ error: 'Invalid userId' });
    }

    const profile = await Profile.findOne({ user: ownerUserId }).lean();
    if (!profile) {
      return res.status(404).send({ error: 'Profile not found' });
    }

    // Owner can always view full profile.
    if (viewerId === ownerUserId) {
      return res.send({
        allowed: true,
        relationship: { status: 'self' },
        profile,
      });
    }

    // Determine relationship (best effort)
    const relationship = await Friendship.findOne({
      $or: [
        { requester: viewerId, recipient: ownerUserId },
        { requester: ownerUserId, recipient: viewerId },
      ],
    })
      .select('status')
      .lean();

    const status = relationship?.status || 'none';
    const isFriend = relationship?.status === ('accepted' as any);

    const visibility = profile?.privacy?.profileVisibility || Visibility.Public;

    if (visibility === Visibility.Public) {
      return res.send({ allowed: true, relationship: { status }, profile });
    }

    if (visibility === Visibility.Private) {
      return res.status(403).send({
        allowed: false,
        reason: 'private',
        relationship: { status },
        // still return minimal header info for a nice UI
        profile: {
          user: profile.user,
          username: profile.username,
          fullName: profile.fullName,
          profilePicture: profile.profilePicture,
          coverPhoto: profile.coverPhoto,
          privacy: profile.privacy,
        },
      });
    }

    // friends-only
    if (isFriend) {
      return res.send({ allowed: true, relationship: { status }, profile });
    }

    return res.status(403).send({
      allowed: false,
      reason: 'not_friends',
      relationship: { status },
      profile: {
        user: profile.user,
        username: profile.username,
        fullName: profile.fullName,
        profilePicture: profile.profilePicture,
        coverPhoto: profile.coverPhoto,
        privacy: profile.privacy,
      },
    });
  }
);

export { router as getProfileViewByUserIdRouter };


