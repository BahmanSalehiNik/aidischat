import {
  Listener,
  Subjects,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
  NotFoundError,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { NewUser } from '../../../models/new-user';
import { UserSocialStats } from '../../../models/user-social-stats';
import { UserStatus } from '../../../models/user-status';
import { PopularUser } from '../../../models/popular-user';
import { MutualSuggestion } from '../../../models/mutual-suggestion';
import { FriendshipEdge } from '../../../models/friendship-edge';

class UserCreatedListener extends Listener<UserCreatedEvent> {
  readonly topic: Subjects.UserCreated = Subjects.UserCreated;
  groupId = 'friend-suggestions-user-created';

  async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload) {
    await NewUser.updateOne(
      { userId: processedMessage.id },
      {
        $setOnInsert: {
          userId: processedMessage.id,
          createdAtMs: Date.now(),
        },
      },
      { upsert: true }
    );

    await UserSocialStats.updateOne(
      { userId: processedMessage.id },
      { $setOnInsert: { userId: processedMessage.id } },
      { upsert: true }
    );

    await this.ack();
  }
}

class UserUpdatedListener extends Listener<UserUpdatedEvent> {
  readonly topic: Subjects.UserUpdated = Subjects.UserUpdated;
  groupId = 'friend-suggestions-user-updated';

  async onMessage(processedMessage: UserUpdatedEvent['data'], msg: EachMessagePayload) {
    const stats = await UserSocialStats.findOne({ userId: processedMessage.id });
    if (!stats) {
      throw new NotFoundError();
    }
    stats.set({ updatedAt: new Date() });
    await stats.save();

    // Update user status projection
    const isSuggestible =
      processedMessage.status !== 'deleted' &&
      processedMessage.status !== 'suspended' &&
      processedMessage.status !== 'banned';

    await UserStatus.updateOne(
      { userId: processedMessage.id },
      {
        $set: {
          status: processedMessage.status,
          isDeleted: processedMessage.status === 'deleted',
          isSuggestible,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // If user becomes non-suggestible, remove from suggestion projections
    if (!isSuggestible) {
      await Promise.all([
        PopularUser.deleteMany({ userId: processedMessage.id }),
        NewUser.deleteMany({ userId: processedMessage.id }),
        MutualSuggestion.deleteMany({
          $or: [{ userId: processedMessage.id }, { candidateId: processedMessage.id }],
        }),
      ]);
    }

    await this.ack();
  }
}

class UserDeletedListener extends Listener<UserDeletedEvent> {
  readonly topic: Subjects.UserDeleted = Subjects.UserDeleted;
  groupId = 'friend-suggestions-user-deleted';

  async onMessage(processedMessage: UserDeletedEvent['data'], msg: EachMessagePayload) {
    const userId = processedMessage.id;

    // Remove all friendship edges where this user is involved
    await Promise.all([
      FriendshipEdge.deleteMany({ userId }),
      FriendshipEdge.deleteMany({ friendId: userId }),
    ]);

    // Update user status
    await UserStatus.updateOne(
      { userId },
      {
        $set: {
          status: 'deleted',
          isDeleted: true,
          isSuggestible: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Remove from all suggestion projections
    await Promise.all([
      PopularUser.deleteMany({ userId }),
      NewUser.deleteMany({ userId }),
      MutualSuggestion.deleteMany({
        $or: [{ userId }, { candidateId: userId }],
      }),
    ]);

    await this.ack();
  }
}

export { UserCreatedListener, UserUpdatedListener, UserDeletedListener };

