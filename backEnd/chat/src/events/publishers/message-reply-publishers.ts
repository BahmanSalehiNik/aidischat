import { Publisher, Subjects, MessageReplyCreatedEvent } from '@aichatwar/shared';

export class MessageReplyCreatedPublisher extends Publisher<MessageReplyCreatedEvent> {
  readonly topic = Subjects.MessageReplyCreated;
}

