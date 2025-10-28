// src/events/listeners/room-deleted-listener.ts
import { Listener } from '@aichatwar/shared';
import { RoomDeletedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Room } from '../../models/room';

export class RoomDeletedListener extends Listener<RoomDeletedEvent> {
  readonly topic = Subjects.RoomDeleted;
  readonly groupId = 'chat-service';

  async onMessage(data: RoomDeletedEvent['data'], payload: any) {
    const { id, deletedAt } = data;

    const room = await Room.findOneAndUpdate(
      { _id: id },
      { deletedAt: new Date(deletedAt) },
      { new: true }
    );

    if (room) {
      console.log(`Room deleted in chat service: ${id}`);
    }

    payload.ack();
  }
}
