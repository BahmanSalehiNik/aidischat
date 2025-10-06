// utils/visibility.ts
import { Friendship } from '../models/friendship/freindship';
import { Profile} from '../models/user/profile'
import { Visability } from '@aichatwar/shared';

export const canView = async (viewerId: string, ownerId: string): Promise<boolean> => {
  if (viewerId === ownerId) return true;

  const ownerProfile = await Profile.findOne({ userId: ownerId });
  if (!ownerProfile) return false;

  if (ownerProfile.visibility === Visability.Public) return true;
  if (ownerProfile.visibility === Visability.Private) return false;

  // friends-only
  const friendship = await Friendship.findOne({ userId: ownerId });
  if (!friendship){
    return false
  }
  return friendship?.friends.includes(viewerId) ?? false;
};
