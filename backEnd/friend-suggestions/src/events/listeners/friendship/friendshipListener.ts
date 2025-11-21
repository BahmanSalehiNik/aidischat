import {
  Listener,
  Subjects,
  FriendshipAcceptedEvent,
  FriendshipRequestedEvent,
  FriendshipUpdatedEvent,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { UserSocialStats } from '../../../models/user-social-stats';
import { MutualSuggestion } from '../../../models/mutual-suggestion';
import { FriendshipEdge } from '../../../models/friendship-edge';
import { BlockList } from '../../../models/block-list';

class FriendshipRequestedListener extends Listener<FriendshipRequestedEvent> {
  readonly topic: Subjects.FriendshipRequested = Subjects.FriendshipRequested;
  groupId = 'friend-suggestions-friendship-requested';

  async onMessage(processedMessage: FriendshipRequestedEvent['data'], msg: EachMessagePayload) {
    await MutualSuggestion.updateOne(
      {
        userId: processedMessage.recipient,
        candidateId: processedMessage.requester,
      },
      {
        $setOnInsert: {
          userId: processedMessage.recipient,
          candidateId: processedMessage.requester,
          mutualCount: 1,
          lastComputedAt: new Date(),
        },
      },
      { upsert: true }
    );

    await this.ack();
  }
}

class FriendshipAcceptedListener extends Listener<FriendshipAcceptedEvent> {
  readonly topic: Subjects.FriendshipAccepted = Subjects.FriendshipAccepted;
  groupId = 'friend-suggestions-friendship-accepted';

  async onMessage(processedMessage: FriendshipAcceptedEvent['data'], msg: EachMessagePayload) {
    const now = new Date();

    await Promise.all([
      // Update social stats
      UserSocialStats.updateOne(
        { userId: processedMessage.recipient },
        { $inc: { friendsCount: 1 } },
        { upsert: true }
      ),
      UserSocialStats.updateOne(
        { userId: processedMessage.requester },
        { $inc: { friendsCount: 1 } },
        { upsert: true }
      ),
      // Remove from mutual suggestions
      MutualSuggestion.deleteOne({
        userId: processedMessage.recipient,
        candidateId: processedMessage.requester,
      }),
      // Add friendship edges (bidirectional)
      FriendshipEdge.updateOne(
        { userId: processedMessage.requester, friendId: processedMessage.recipient },
        { $set: { status: 'accepted', createdAt: now } },
        { upsert: true }
      ),
      FriendshipEdge.updateOne(
        { userId: processedMessage.recipient, friendId: processedMessage.requester },
        { $set: { status: 'accepted', createdAt: now } },
        { upsert: true }
      ),
      // Remove from block list if exists
      BlockList.deleteMany({
        $or: [
          { userId: processedMessage.requester, blockedUserId: processedMessage.recipient },
          { userId: processedMessage.recipient, blockedUserId: processedMessage.requester },
        ],
      }),
    ]);

    await this.ack();
  }
}

class FriendshipUpdatedListener extends Listener<FriendshipUpdatedEvent> {
  readonly topic: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
  groupId = 'friend-suggestions-friendship-updated';

  async onMessage(processedMessage: FriendshipUpdatedEvent['data'], msg: EachMessagePayload) {
    const status = processedMessage.status;

    if (status === 'blocked' || status === 'removed') {
      // Remove friendship edges
      await Promise.all([
        FriendshipEdge.deleteMany({
          $or: [
            { userId: processedMessage.requester, friendId: processedMessage.recipient },
            { userId: processedMessage.recipient, friendId: processedMessage.requester },
          ],
        }),
        // Add to block list (bidirectional for safety)
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
        // Remove from mutual suggestions
        MutualSuggestion.deleteMany({
          $or: [
            { userId: processedMessage.requester, candidateId: processedMessage.recipient },
            { userId: processedMessage.recipient, candidateId: processedMessage.requester },
          ],
        }),
        // Decrement friend counts
        UserSocialStats.updateOne(
          { userId: processedMessage.recipient },
          { $inc: { friendsCount: -1 } }
        ),
        UserSocialStats.updateOne(
          { userId: processedMessage.requester },
          { $inc: { friendsCount: -1 } }
        ),
      ]);
    } else if (status === 'accepted') {
      // Handle acceptance (same as FriendshipAcceptedListener)
      const now = new Date();
      await Promise.all([
        FriendshipEdge.updateOne(
          { userId: processedMessage.requester, friendId: processedMessage.recipient },
          { $set: { status: 'accepted', createdAt: now } },
          { upsert: true }
        ),
        FriendshipEdge.updateOne(
          { userId: processedMessage.recipient, friendId: processedMessage.requester },
          { $set: { status: 'accepted', createdAt: now } },
          { upsert: true }
        ),
        BlockList.deleteMany({
          $or: [
            { userId: processedMessage.requester, blockedUserId: processedMessage.recipient },
            { userId: processedMessage.recipient, blockedUserId: processedMessage.requester },
          ],
        }),
      ]);
    }

    await this.ack();
  }
}

export { FriendshipRequestedListener, FriendshipAcceptedListener, FriendshipUpdatedListener };

