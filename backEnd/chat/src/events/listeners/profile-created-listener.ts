// src/events/listeners/profile-created-listener.ts
import { Listener, Subjects, ProfileCreatedEvent } from '@aichatwar/shared';
import { User } from '../../models/user';

export class ProfileCreatedListener extends Listener<ProfileCreatedEvent> {
  readonly topic = Subjects.ProfileCreated;
  readonly groupId = 'chat-service-profile-created';

  async onMessage(data: ProfileCreatedEvent['data'], payload: any) {
    const { user, username, fullName } = data;

    const existingUser = await User.findOne({ _id: user });
    
    if (existingUser) {
      // Update existing user with profile data
      existingUser.username = username;
      existingUser.displayName = fullName; // Use fullName as displayName
      existingUser.updatedAt = new Date();
      await existingUser.save();
      console.log(`[Profile Created] Updated user ${user} with username=${username}, displayName=${fullName}`);
    } else {
      // User doesn't exist in chat service yet - this shouldn't happen, but handle gracefully
      console.warn(`[Profile Created] User ${user} not found in chat service DB - profile data will be synced when user is created`);
    }

    await this.ack();
  }
}

