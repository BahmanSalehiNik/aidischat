import { Publisher, Subjects, RoomAgentInvitedEvent } from '@aichatwar/shared';

export class RoomAgentInvitedPublisher extends Publisher<RoomAgentInvitedEvent> {
  readonly topic = Subjects.RoomAgentInvited;
}

