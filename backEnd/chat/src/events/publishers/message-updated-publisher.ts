import { Publisher } from '@aichatwar/shared';
import { MessageUpdatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class MessageUpdatedPublisher extends Publisher<MessageUpdatedEvent> {
  readonly topic = Subjects.MessageUpdated;
}
