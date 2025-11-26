import { Publisher, Subjects, MessageReactionCreatedEvent, MessageReactionRemovedEvent } from '@aichatwar/shared';

export class MessageReactionCreatedPublisher extends Publisher<MessageReactionCreatedEvent> {
  readonly topic = Subjects.MessageReactionCreated;
}

export class MessageReactionRemovedPublisher extends Publisher<MessageReactionRemovedEvent> {
  readonly topic = Subjects.MessageReactionRemoved;
}

