import { Listener, Subjects, UserCreatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { User } from '../../models/user';

export class UserCreatedListener extends Listener<UserCreatedEvent> {
  readonly topic = Subjects.UserCreated;
  readonly groupId = 'agent-manager-user-created';

  async onMessage(data: UserCreatedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[UserCreatedListener] User created event received: ${data.id}`);

    try {
      // Check if user already exists (use findOne with _id to avoid ObjectId casting)
      const existing = await User.findOne({ _id: data.id });
      
      if (existing) {
        // Update existing user
        existing.email = data.email;
        existing.status = data.status;
        existing.version = data.version;
        existing.isAgent = data.isAgent ?? false;
        existing.ownerUserId = data.ownerUserId;
        await existing.save();
        console.log(`[UserCreatedListener] Updated existing user: ${data.id}`);
      } else {
        // Create new user
        const user = User.add({
          id: data.id,
          email: data.email,
          version: data.version,
          status: data.status,
          isAgent: data.isAgent ?? false,
          ownerUserId: data.ownerUserId,
        });
        await user.save();
        console.log(`[UserCreatedListener] Created new user: ${data.id}`);
      }

      await this.ack();
    } catch (error: any) {
      console.error(`[UserCreatedListener] Error processing user created event:`, error);
      throw error;
    }
  }
}

