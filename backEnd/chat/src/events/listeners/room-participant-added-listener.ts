// src/events/listeners/room-participant-added-listener.ts
import { Listener } from '@aichatwar/shared';
import { RoomParticipantAddedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { RoomParticipant } from '../../models/room-participant';

export class RoomParticipantAddedListener extends Listener<RoomParticipantAddedEvent> {
  readonly topic = Subjects.RoomParticipantAdded;
  readonly groupId = 'chat-service';

  async onMessage(data: RoomParticipantAddedEvent['data'], payload: any) {
    const { roomId, participantId, participantType, role, addedAt } = data;

    const participant = RoomParticipant.build({
      roomId,
      participantId,
      participantType,
      role: role as any
    });

    await participant.save();

    console.log(`Participant added to room in chat service: ${participantId} -> ${roomId}`);
    await this.ack();
  }
}
