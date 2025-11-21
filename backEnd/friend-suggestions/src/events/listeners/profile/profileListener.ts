import {
  Listener,
  Subjects,
  ProfileCreatedEvent,
  ProfileDeletedEvent,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { ProfileStatus } from '../../../models/profile-status';
import { PopularUser } from '../../../models/popular-user';
import { NewUser } from '../../../models/new-user';
import { MutualSuggestion } from '../../../models/mutual-suggestion';

class ProfileCreatedListener extends Listener<ProfileCreatedEvent> {
  readonly topic: Subjects.ProfileCreated = Subjects.ProfileCreated;
  groupId = 'friend-suggestions-profile-created';

  async onMessage(processedMessage: ProfileCreatedEvent['data'], msg: EachMessagePayload) {
    // Initialize profile status as suggestible
    await ProfileStatus.updateOne(
      { userId: processedMessage.user },
      {
        $setOnInsert: {
          userId: processedMessage.user,
          profileId: processedMessage.id,
          isDeleted: false,
          isSuggestible: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await this.ack();
  }
}

class ProfileDeletedListener extends Listener<ProfileDeletedEvent> {
  readonly topic: Subjects.ProfileDeleted = Subjects.ProfileDeleted;
  groupId = 'friend-suggestions-profile-deleted';

  async onMessage(processedMessage: ProfileDeletedEvent['data'], msg: EachMessagePayload) {
    const userId = processedMessage.id;

    // Mark profile as deleted (but keep friendship edges for mutual calculations)
    await ProfileStatus.updateOne(
      { userId },
      {
        $set: {
          isDeleted: true,
          isSuggestible: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Remove from suggestion projections
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

export { ProfileCreatedListener, ProfileDeletedListener };

