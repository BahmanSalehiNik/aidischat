import { Publisher } from '@aichatwar/shared';
import { RoomUpdatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class RoomUpdatedPublisher extends Publisher<RoomUpdatedEvent> {
  readonly topic = Subjects.RoomUpdated;
}
