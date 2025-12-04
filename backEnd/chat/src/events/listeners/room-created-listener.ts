// src/events/listeners/room-created-listener.ts
import { Listener } from '@aichatwar/shared';
import { RoomCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Room } from '../../models/room';

export class RoomCreatedListener extends Listener<RoomCreatedEvent> {
  readonly topic = Subjects.RoomCreated;
  readonly groupId = 'chat-service';
  protected fromBeginning: boolean = true; // Read from beginning to catch missed messages

  async onMessage(data: RoomCreatedEvent['data'], payload: any) {
    console.log(`📥 [RoomCreatedListener] onMessage called with data:`, {
      roomId: data.id,
      type: data.type,
      name: data.name,
      createdBy: data.createdBy?.id,
      visibility: data.visibility,
      partition: payload.partition,
      offset: payload.message.offset,
    });
    
    const { id, type, name, createdBy, visibility, createdAt } = data;

    // Idempotency check: if room already exists, skip (handles duplicate events)
    const existing = await Room.findOne({ _id: id });
    if (existing) {
      console.log(`[RoomCreatedListener] Room ${id} already exists in chat service, skipping (idempotent)`);
      await this.ack();
      return;
    }

    const room = Room.build({
      id,
      type: type as any,
      name,
      createdBy: createdBy.id,
      visibility: visibility as any
    });

    await room.save();

    console.log(`✅ [RoomCreatedListener] Room created in chat service: ${id}, type: ${type}, name: ${name}`);
    await this.ack();
  }
}
