import {
  FriendshipAcceptedEvent,
  FriendshipRequestedEvent,
  FriendshipUpdatedEvent,
  Listener,
  Subjects,
  NotFoundError,
} from '@aichatwar/shared';
import { EachMessagePayload } from 'kafkajs';
import { Friendship } from '../../models/friendship';
import {
  GroupIdFriendshipAccepted,
  GroupIdFriendshipRequested,
  GroupIdFriendshipUpdated,
} from '../queGroupNames';

class FriendshipRequestedListener extends Listener<FriendshipRequestedEvent> {
  readonly topic: Subjects.FriendshipRequested = Subjects.FriendshipRequested;
  groupId: string = GroupIdFriendshipRequested;

  async onMessage(data: FriendshipRequestedEvent['data'], _msg: EachMessagePayload) {
    const existing = await Friendship.findById(data.id);
    if (!existing) {
      await Friendship.build({
        id: data.id,
        requester: data.requester,
        recipient: data.recipient,
        status: data.status,
        version: data.version,
      }).save();
    }
    await this.ack();
  }
}

class FriendshipAcceptedListener extends Listener<FriendshipAcceptedEvent> {
  readonly topic: Subjects.FriendshipAccepted = Subjects.FriendshipAccepted;
  groupId: string = GroupIdFriendshipAccepted;

  async onMessage(data: FriendshipAcceptedEvent['data'], _msg: EachMessagePayload) {
    const friendship = await Friendship.findByEvent({ id: data.id, version: data.version });
    if (!friendship) {
      throw new NotFoundError();
    }
    friendship.set({ status: data.status });
    await friendship.save();
    await this.ack();
  }
}

class FriendshipUpdatedListener extends Listener<FriendshipUpdatedEvent> {
  readonly topic: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
  groupId: string = GroupIdFriendshipUpdated;

  async onMessage(data: FriendshipUpdatedEvent['data'], _msg: EachMessagePayload) {
    const friendship = await Friendship.findByEvent({ id: data.id, version: data.version });
    if (!friendship) {
      throw new NotFoundError();
    }
    friendship.set({ status: data.status });
    await friendship.save();
    await this.ack();
  }
}

export {
  FriendshipRequestedListener,
  FriendshipAcceptedListener,
  FriendshipUpdatedListener,
};






