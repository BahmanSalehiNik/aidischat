import {
  Listener,
  Subjects,
  UserCreatedEvent,
  UserUpdatedEvent,
  UserDeletedEvent,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { UserStatus } from '../../../models/user-status';
import { UserSearch } from '../../../models/user-search';
import { PostAuthorStatusUpdater } from '../post/postListener';

class UserCreatedListener extends Listener<UserCreatedEvent> {
  readonly topic: Subjects.UserCreated = Subjects.UserCreated;
  groupId = 'search-user-created';

  async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload) {
    console.log('[Search] User created event received:', processedMessage.id);
    
    // Initialize user status as active and suggestible
    const isSuggestible = processedMessage.status === 'active';
    await UserStatus.updateOne(
      { userId: processedMessage.id },
      {
        $setOnInsert: {
          userId: processedMessage.id,
          status: processedMessage.status,
          isDeleted: false,
          isSuggestible,
        },
      },
      { upsert: true }
    );

    // Create a basic UserSearch entry with email as name (will be updated when profile is created)
    // Extract name from email (e.g., "john@example.com" -> "john")
    const emailName = processedMessage.email?.split('@')[0] || 'User';
    await UserSearch.updateOne(
      { userId: processedMessage.id },
      {
        $setOnInsert: {
          userId: processedMessage.id,
          name: emailName,
          username: emailName, // Temporary, will be updated when profile is created
          bio: '',
          profilePicture: undefined,
        },
      },
      { upsert: true }
    );
    
    console.log('[Search] UserSearch created for userId:', processedMessage.id);

    await this.ack();
  }
}

class UserUpdatedListener extends Listener<UserUpdatedEvent> {
  readonly topic: Subjects.UserUpdated = Subjects.UserUpdated;
  groupId = 'search-user-updated';

  async onMessage(processedMessage: UserUpdatedEvent['data'], msg: EachMessagePayload) {
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

    await this.ack();
  }
}

class UserDeletedListener extends Listener<UserDeletedEvent> {
  readonly topic: Subjects.UserDeleted = Subjects.UserDeleted;
  groupId = 'search-user-deleted';

  async onMessage(processedMessage: UserDeletedEvent['data'], msg: EachMessagePayload) {
    await Promise.all([
      UserStatus.updateOne(
        { userId: processedMessage.id },
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
      ),
      // Update all posts by this user
      PostAuthorStatusUpdater.updatePostsForUser(processedMessage.id, true, false),
    ]);

    await this.ack();
  }
}

export { UserCreatedListener, UserUpdatedListener, UserDeletedListener };

