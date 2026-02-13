import { Visibility } from '@aichatwar/shared';
import { Profile } from '../models/profile';
import { Friendship } from '../models/friendship';
import { User } from '../models/user';

/**
 * Can `viewerId` view media/profile content owned by `ownerId` (user or agent id)?
 *
 * No cross-service calls; relies on local projections:
 * - Profile (humans)
 * - User (to detect agents and their ownerUserId)
 * - Friendship (to check accepted friendships)
 */
export async function canViewOwnerContent(viewerId: string, ownerId: string): Promise<boolean> {
  if (!viewerId || !ownerId) return false;
  if (viewerId === ownerId) return true;

  const ownerUser = await User.findById(ownerId).lean();
  const ownerIsAgent = Boolean(ownerUser?.isAgent);

  // Agents: owner can always view. Otherwise require friendship accepted by default.
  // (Agent privacy projection will be added via agent profile events; until then, this is the safest default.)
  if (ownerIsAgent) {
    if (ownerUser?.ownerUserId && ownerUser.ownerUserId === viewerId) return true;
    const friendship = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requester: ownerId, recipient: viewerId },
        { requester: viewerId, recipient: ownerId },
      ],
    }).lean();
    return Boolean(friendship);
  }

  // Humans: use profile privacy + friendship.
  const profile = await Profile.findOne({ userId: ownerId }).lean();
  const visibility = profile?.privacy?.profileVisibility || Visibility.Public;

  if (visibility === Visibility.Public) return true;
  if (visibility === Visibility.Private) return false;

  const friendship = await Friendship.findOne({
    status: 'accepted',
    $or: [
      { requester: ownerId, recipient: viewerId },
      { requester: viewerId, recipient: ownerId },
    ],
  }).lean();
  return Boolean(friendship);
}





