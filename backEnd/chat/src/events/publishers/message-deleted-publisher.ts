import { Publisher } from '@aichatwar/shared';
import { MessageDeletedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class MessageDeletedPublisher extends Publisher<MessageDeletedEvent> {
  readonly topic = Subjects.MessageDeleted;
}
