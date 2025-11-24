import {
  Listener,
  Subjects,
  ProfileCreatedEvent,
  ProfileUpdatedEvent,
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
    const userId = processedMessage.user;
    const profilePicture = processedMessage.profilePicture?.url;

    console.log('[FriendSuggestions] ProfileCreated event received:', {
      userId,
      username: processedMessage.username,
      fullName: processedMessage.fullName,
    });

    // Initialize profile status as suggestible
    await ProfileStatus.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId,
          profileId: processedMessage.id,
          isDeleted: false,
          isSuggestible: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Update NewUser projection with profile data (create if doesn't exist)
    await NewUser.updateOne(
      { userId },
      {
        $set: {
          username: processedMessage.username,
          fullName: processedMessage.fullName,
        },
        $setOnInsert: {
          userId,
          createdAtMs: Date.now(),
        },
      },
      { upsert: true }
    );

    // Update PopularUser projection with profile data if it exists
    await PopularUser.updateOne(
      { userId },
      {
        $set: {
          username: processedMessage.username,
          fullName: processedMessage.fullName,
          profilePicture,
        },
      },
      { upsert: false }
    );

    await this.ack();
  }
}

class ProfileUpdatedListener extends Listener<ProfileUpdatedEvent> {
  readonly topic: Subjects.ProfileUpdated = Subjects.ProfileUpdated;
  groupId = 'friend-suggestions-profile-updated';

  async onMessage(processedMessage: ProfileUpdatedEvent['data'], msg: EachMessagePayload) {
    const userId = processedMessage.user;
    const profilePicture = processedMessage.profilePicture?.url;

    console.log('[FriendSuggestions] ProfileUpdated event received:', {
      userId,
      username: processedMessage.username,
      fullName: processedMessage.fullName,
    });

    // Update profile status
    await ProfileStatus.updateOne(
      { userId },
      {
        $set: {
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Update NewUser projection with profile data (create if doesn't exist)
    await NewUser.updateOne(
      { userId },
      {
        $set: {
          username: processedMessage.username,
          fullName: processedMessage.fullName,
        },
        $setOnInsert: {
          userId,
          createdAtMs: Date.now(),
        },
      },
      { upsert: true }
    );

    // Update PopularUser projection with profile data if it exists
    await PopularUser.updateOne(
      { userId },
      {
        $set: {
          username: processedMessage.username,
          fullName: processedMessage.fullName,
          profilePicture,
        },
      },
      { upsert: false }
    );

    // Update MutualSuggestion projections
    await MutualSuggestion.updateMany(
      { candidateId: userId },
      {
        $set: {
          username: processedMessage.username,
          fullName: processedMessage.fullName,
          profilePicture,
        },
      }
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

export { ProfileCreatedListener, ProfileUpdatedListener, ProfileDeletedListener };

