import { Listener, Subjects, RoomParticipantAddedEvent, EachMessagePayload } from '@aichatwar/shared';

/**
 * Listens to RoomParticipantAddedEvent to track when agents join rooms
 * This helps prevent inviting agents that are already in the room
 */
export class RoomParticipantAddedListener extends Listener<RoomParticipantAddedEvent> {
  readonly topic = Subjects.RoomParticipantAdded;
  readonly groupId = 'ai-chat-host-room-participant-added';

  async onMessage(data: RoomParticipantAddedEvent['data'], payload: EachMessagePayload) {
    const { roomId, participantId, participantType } = data;

    // Only care about agents joining
    if (participantType !== 'agent') {
      await this.ack();
      return;
    }

    console.log(`[RoomParticipantAddedListener] Agent ${participantId} joined room ${roomId}`);

    // Note: We could maintain a local cache of room participants here
    // For now, we rely on checking recent analysis results for invited agents
    // This is handled in InvitationCoordinator.getRecentlyInvitedAgents()

    await this.ack();
  }
}

