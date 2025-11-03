// src/events/listeners/user-updated-listener.ts
import { Listener } from '@aichatwar/shared';
import { UserUpdatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { User } from '../../models/user';

export class UserUpdatedListener extends Listener<UserUpdatedEvent> {
  readonly topic = Subjects.UserUpdated;
  readonly groupId = 'chat-service';

  async onMessage(data: UserUpdatedEvent['data'], payload: any) {
    const { id, email, status } = data;

    const existingUser = await User.findOne({ _id: id });
    
    if (existingUser) {
      // Update existing user
      existingUser.email = email;
      existingUser.isActive = status === 'active';
      existingUser.updatedAt = new Date();
      await existingUser.save();
    } else {
      // Create new user projection
      const user = User.build({
        id,
        email,
        isActive: status === 'active'
      });
      await user.save();
    }

    console.log(`User updated in chat service: ${id}`);
    await this.ack();
  }
}
