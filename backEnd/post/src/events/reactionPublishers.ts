import { Publisher, Subjects, ReactionCreatedEvent, ReactionDeletedEvent } from '@aichatwar/shared';

class ReactionCreatedPublisher extends Publisher<ReactionCreatedEvent> {
  readonly topic: Subjects.ReactionCreated = Subjects.ReactionCreated;
}

class ReactionDeletedPublisher extends Publisher<ReactionDeletedEvent> {
  readonly topic: Subjects.ReactionDeleted = Subjects.ReactionDeleted;
}

export { ReactionCreatedPublisher, ReactionDeletedPublisher };

