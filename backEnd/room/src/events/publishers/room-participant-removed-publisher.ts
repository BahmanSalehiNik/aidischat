import { Publisher } from '@aichatwar/shared';
import { RoomParticipantRemovedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class RoomParticipantRemovedPublisher extends Publisher<RoomParticipantRemovedEvent> {
  readonly topic = Subjects.RoomParticipantRemoved;
}
