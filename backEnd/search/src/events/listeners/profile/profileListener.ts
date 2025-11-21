import {
  Listener,
  Subjects,
  ProfileCreatedEvent,
  ProfileUpdatedEvent,
  ProfileDeletedEvent,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { UserStatus } from '../../../models/user-status';
import { UserSearch } from '../../../models/user-search';

class ProfileCreatedListener extends Listener<ProfileCreatedEvent> {
  readonly topic: Subjects.ProfileCreated = Subjects.ProfileCreated;
  groupId = 'search-profile-created';

  async onMessage(processedMessage: ProfileCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] Profile created event received:', processedMessage.id, 'userId:', processedMessage.user);
    
    // Handle profilePicture - can be object with url or string
    let profilePictureUrl: string | undefined;
    if (typeof processedMessage.profilePicture === 'string') {
      profilePictureUrl = processedMessage.profilePicture;
    } else if (processedMessage.profilePicture?.url) {
      profilePictureUrl = processedMessage.profilePicture.url;
    }
    
    // Create or update UserSearch document for search indexing
    const result = await UserSearch.updateOne(
      { userId: processedMessage.user },
      {
        $set: {
          userId: processedMessage.user,
          name: processedMessage.fullName || processedMessage.username || 'User',
          username: processedMessage.username || '',
          bio: processedMessage.bio || '',
          profilePicture: profilePictureUrl,
        },
      },
      { upsert: true }
    );
    
    console.log('[Search] UserSearch updated:', result.upsertedCount > 0 ? 'created' : 'updated', 'for userId:', processedMessage.user);

    await this.ack();
  }
}

class ProfileUpdatedListener extends Listener<ProfileUpdatedEvent> {
  readonly topic: Subjects.ProfileUpdated = Subjects.ProfileUpdated;
  groupId = 'search-profile-updated';

  async onMessage(processedMessage: ProfileUpdatedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] Profile updated event received:', processedMessage.id, 'userId:', processedMessage.user);
    
    // Handle profilePicture - can be object with url or string
    let profilePictureUrl: string | undefined;
    if (typeof processedMessage.profilePicture === 'string') {
      profilePictureUrl = processedMessage.profilePicture;
    } else if (processedMessage.profilePicture?.url) {
      profilePictureUrl = processedMessage.profilePicture.url;
    }
    
    // Update UserSearch document when profile is updated
    const result = await UserSearch.updateOne(
      { userId: processedMessage.user },
      {
        $set: {
          userId: processedMessage.user,
          name: processedMessage.fullName || processedMessage.username || 'User',
          username: processedMessage.username || '',
          bio: processedMessage.bio || '',
          profilePicture: profilePictureUrl,
        },
      },
      { upsert: true }
    );
    
    console.log('[Search] UserSearch updated:', result.upsertedCount > 0 ? 'created' : 'updated', 'for userId:', processedMessage.user);

    await this.ack();
  }
}

class ProfileDeletedListener extends Listener<ProfileDeletedEvent> {
  readonly topic: Subjects.ProfileDeleted = Subjects.ProfileDeleted;
  groupId = 'search-profile-deleted';

  async onMessage(processedMessage: ProfileDeletedEvent['data'], msg: EachMessagePayload) {
    // Mark user as non-suggestible when profile is deleted
    // Note: We use the profile id as userId in the event
    await UserStatus.updateOne(
      { userId: processedMessage.id },
      {
        $set: {
          isSuggestible: false,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // Remove from search index
    await UserSearch.deleteOne({ userId: processedMessage.id });

    await this.ack();
  }
}

export { ProfileCreatedListener, ProfileUpdatedListener, ProfileDeletedListener };

