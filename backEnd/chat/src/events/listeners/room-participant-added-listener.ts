// src/events/listeners/room-participant-added-listener.ts
import { Listener } from '@aichatwar/shared';
import { RoomParticipantAddedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { RoomParticipant } from '../../models/room-participant';

export class RoomParticipantAddedListener extends Listener<RoomParticipantAddedEvent> {
  readonly topic = Subjects.RoomParticipantAdded;
  readonly groupId = 'chat-service-room-participant-added';

  async onMessage(data: RoomParticipantAddedEvent['data'], payload: any) {
    const payloadWithInvite = data as RoomParticipantAddedEvent['data'] & { invitedByUserId?: string };
    const { roomId, participantId, participantType, role, invitedByUserId } = payloadWithInvite;

    try {
      console.log(`[RoomParticipantAdded] Received event: roomId=${roomId}, participantId=${participantId}, role=${role}`);

      // Check if participant already exists (idempotency)
      // Only check for active participants (not left)
      const existing = await RoomParticipant.findOne({ 
        roomId, 
        participantId,
        leftAt: { $exists: false }
      });

      if (existing) {
        console.log(`[RoomParticipantAdded] Participant already exists, skipping: ${participantId} -> ${roomId}`);
        await this.ack();
        return;
      }

      const participant = RoomParticipant.build({
        roomId,
        participantId,
        participantType,
        role: role as any,
        invitedByUserId,
      });

      await participant.save();

      console.log(`[RoomParticipantAdded] ✅ Participant added to room in chat service: ${participantId} -> ${roomId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[RoomParticipantAdded] ❌ Error processing event:`, {
        roomId,
        participantId,
        error: error.message,
        stack: error.stack
      });
      // Don't ack on error - let Kafka retry
      throw error;
    }
  }
}
