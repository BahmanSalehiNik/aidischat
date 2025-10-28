import { Publisher } from '@aichatwar/shared';
import { MessageCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class MessageCreatedPublisher extends Publisher<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
}
