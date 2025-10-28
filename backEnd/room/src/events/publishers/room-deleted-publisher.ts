import { Publisher } from '@aichatwar/shared';
import { RoomDeletedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class RoomDeletedPublisher extends Publisher<RoomDeletedEvent> {
  readonly topic = Subjects.RoomDeleted;
}
