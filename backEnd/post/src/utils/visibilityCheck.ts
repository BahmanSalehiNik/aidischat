// utils/visibility.ts
import { Friendship, FriendshipStatus } from '../models/friendship/freindship';
import { Profile } from '../models/user/profile';
import { Visibility } from '@aichatwar/shared';

export const canView = async (
  viewerId: string,
  ownerId: string,
  postVisibility: Visibility = Visibility.Public
): Promise<boolean> => {
  if (viewerId === ownerId) {
    return true;
  }

  // Post-specific visibility takes precedence
  if (postVisibility === Visibility.Public) {
    return true;
  }

  if (postVisibility === Visibility.Private) {
    // Already handled viewer === owner above
    return false;
  }

  // For friends-only posts, ensure there is an accepted friendship
  const friendship = await Friendship.find({
    $and: [
      { status: FriendshipStatus.Accepted },
      { $or: [{ requester: ownerId }, { recipient: ownerId }] },
      { $or: [{ requester: viewerId }, { recipient: viewerId }] },
    ],
  });

  if (friendship && friendship.length > 0) {
    return true;
  }

  // Fallback to profile privacy rules if no friendship found
  const ownerProfile = await Profile.findOne({ userId: ownerId });
  if (!ownerProfile) {
    return false;
  }

  if (ownerProfile.privacy.profileVisibility === Visibility.Public) {
    return true;
  }

  if (ownerProfile.privacy.profileVisibility === Visibility.Private) {
    return false;
  }

  // friends-only profile visibility
  return friendship && friendship.length > 0;
};
