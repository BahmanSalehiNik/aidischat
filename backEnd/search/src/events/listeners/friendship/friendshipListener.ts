import {
  Listener,
  Subjects,
  FriendshipUpdatedEvent,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { BlockList } from '../../../models/block-list';
import { PostAuthorStatusUpdater } from '../post/postListener';

class FriendshipUpdatedListener extends Listener<FriendshipUpdatedEvent> {
  readonly topic: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
  groupId = 'search-friendship-updated';

  async onMessage(processedMessage: FriendshipUpdatedEvent['data'], msg: EachMessagePayload) {
    const status = processedMessage.status;

    if (status === 'blocked' || status === 'removed') {
      // Add to block list (bidirectional for safety)
      await Promise.all([
        BlockList.updateOne(
          { userId: processedMessage.requester, blockedUserId: processedMessage.recipient },
          { $set: { blockedAt: new Date() } },
          { upsert: true }
        ),
        BlockList.updateOne(
          { userId: processedMessage.recipient, blockedUserId: processedMessage.requester },
          { $set: { blockedAt: new Date() } },
          { upsert: true }
        ),
        // Update posts by blocked users
        PostAuthorStatusUpdater.updatePostsForUser(processedMessage.requester, false, true),
        PostAuthorStatusUpdater.updatePostsForUser(processedMessage.recipient, false, true),
      ]);
    } else if (status === 'accepted') {
      // Remove from block list if exists
      await Promise.all([
        BlockList.deleteMany({
          $or: [
            { userId: processedMessage.requester, blockedUserId: processedMessage.recipient },
            { userId: processedMessage.recipient, blockedUserId: processedMessage.requester },
          ],
        }),
        // Unblock posts
        PostAuthorStatusUpdater.updatePostsForUser(processedMessage.requester, false, false),
        PostAuthorStatusUpdater.updatePostsForUser(processedMessage.recipient, false, false),
      ]);
    }

    await this.ack();
  }
}

export { FriendshipUpdatedListener };

