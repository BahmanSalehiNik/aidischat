// src/events/listeners/profile-updated-listener.ts
import { Listener, Subjects, ProfileUpdatedEvent } from '@aichatwar/shared';
import { User } from '../../models/user';

export class ProfileUpdatedListener extends Listener<ProfileUpdatedEvent> {
  readonly topic = Subjects.ProfileUpdated;
  readonly groupId = 'room-service-profile-updated';

  async onMessage(data: ProfileUpdatedEvent['data'], payload: any) {
    const { user, username, fullName } = data;

    const existingUser = await User.findOne({ _id: user });
    
    if (existingUser) {
      // Update existing user with profile data
      existingUser.username = username;
      existingUser.displayName = fullName; // Use fullName as displayName
      existingUser.updatedAt = new Date();
      await existingUser.save();
      console.log(`[Profile Updated] Updated user ${user} with username=${username}, displayName=${fullName}`);
    } else {
      // User doesn't exist in room service yet - this shouldn't happen, but handle gracefully
      console.warn(`[Profile Updated] User ${user} not found in room service DB - profile data will be synced when user is created`);
    }

    await this.ack();
  }
}

