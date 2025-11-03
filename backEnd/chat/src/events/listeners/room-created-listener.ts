// src/events/listeners/room-created-listener.ts
import { Listener } from '@aichatwar/shared';
import { RoomCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Room } from '../../models/room';

export class RoomCreatedListener extends Listener<RoomCreatedEvent> {
  readonly topic = Subjects.RoomCreated;
  readonly groupId = 'chat-service';

  async onMessage(data: RoomCreatedEvent['data'], payload: any) {
    const { id, type, name, createdBy, visibility, createdAt } = data;

    const room = Room.build({
      id,
      type: type as any,
      name,
      createdBy: createdBy.id,
      visibility: visibility as any
    });

    await room.save();

    console.log(`Room created in chat service: ${id}`);
    await this.ack();
  }
}
