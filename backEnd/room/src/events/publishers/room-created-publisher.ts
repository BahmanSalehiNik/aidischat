import { Publisher } from '@aichatwar/shared';
import { RoomCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class RoomCreatedPublisher extends Publisher<RoomCreatedEvent> {
  readonly topic = Subjects.RoomCreated;
}
