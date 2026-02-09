import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, Visibility } from '@aichatwar/shared';
import { Types } from 'mongoose';
import { Profile } from '../../models/profile';
import { Friendship } from '../../models/friendship';
import { User } from '../../models/user';

const router = express.Router();

function toPublicProfileShape(profile: any) {
  if (!profile) return profile;
  const id = String(profile.id || profile._id || '');
  const { _id, __v, version, ...rest } = profile;
  return { id, ...rest };
}

async function generateUniqueUsername(base: string): Promise<string> {
  const cleaned = String(base || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const root = cleaned || 'user';
  // Try root, then root_1234...
  if (!(await Profile.exists({ username: root }))) return root;

  for (let i = 0; i < 20; i++) {
    const candidate = `${root}_${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await Profile.exists({ username: candidate }))) return candidate;
  }

  // Very unlikely fallback, but guarantees progress.
  return `${root}_${Date.now()}`;
}

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

    let profile = await Profile.findOne({ user: ownerUserId }).lean();

    // If the viewer is requesting their own profile and it doesn't exist yet, create a minimal one.
    // This avoids "Profile not found" for new accounts where profile creation is a separate step.
    if (!profile && viewerId === ownerUserId) {
      const user = await User.findById(ownerUserId).lean();
      const emailPrefix = user?.email ? String(user.email).split('@')[0] : `user_${ownerUserId.slice(0, 6)}`;
      const username = await generateUniqueUsername(emailPrefix);
      const fullName = emailPrefix;

      const created = Profile.build({
        user: new Types.ObjectId(ownerUserId),
        username,
        fullName,
      } as any);
      await created.save();
      profile = await Profile.findOne({ user: ownerUserId }).lean();
    }

    if (!profile) {
      return res.status(404).send({ error: 'Profile not found' });
    }

    // Owner can always view full profile.
    if (viewerId === ownerUserId) {
      return res.send({
        allowed: true,
        relationship: { status: 'self' },
        profile: toPublicProfileShape(profile),
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
      return res.send({ allowed: true, relationship: { status }, profile: toPublicProfileShape(profile) });
    }

    if (visibility === Visibility.Private) {
      return res.status(403).send({
        allowed: false,
        reason: 'private',
        relationship: { status },
        // still return minimal header info for a nice UI
        profile: {
          id: String((profile as any)?._id || (profile as any)?.id || ''),
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
      return res.send({ allowed: true, relationship: { status }, profile: toPublicProfileShape(profile) });
    }

    return res.status(403).send({
      allowed: false,
      reason: 'not_friends',
      relationship: { status },
      profile: {
        id: String((profile as any)?._id || (profile as any)?.id || ''),
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


