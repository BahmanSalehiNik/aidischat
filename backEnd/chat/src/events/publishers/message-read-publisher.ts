import { Publisher } from '@aichatwar/shared';
import { MessageReadEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class MessageReadPublisher extends Publisher<MessageReadEvent> {
  readonly topic = Subjects.MessageRead;
}
