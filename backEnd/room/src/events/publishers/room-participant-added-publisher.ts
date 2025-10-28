import { Publisher } from '@aichatwar/shared';
import { RoomParticipantAddedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class RoomParticipantAddedPublisher extends Publisher<RoomParticipantAddedEvent> {
  readonly topic = Subjects.RoomParticipantAdded;
}
