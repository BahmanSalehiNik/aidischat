// src/events/listeners/user-created-listener.ts
import { Listener, Subjects, UserCreatedEvent } from '@aichatwar/shared';
import { User } from '../../models/user';

export class UserCreatedListener extends Listener<UserCreatedEvent> {
  readonly topic = Subjects.UserCreated;
  readonly groupId = 'room-service-user-created';
  protected fromBeginning: boolean = true; // Read from beginning to catch missed events on restart

  async onMessage(data: UserCreatedEvent['data']): Promise<void> {
    const { id, email, status } = data;

    const existing = await User.findById(id);
    if (existing) {
      existing.email = email;
      existing.isActive = status === 'active';
      existing.updatedAt = new Date();
      await existing.save();
      await this.ack();
      return;
    }

    const user = User.build({
      id,
      email,
      isActive: status === 'active',
    });

    await user.save();
    await this.ack();
  }
}

