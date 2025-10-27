import { Publisher, Subjects, CommentCreatedEvent, CommentUpdatedEvent, CommentDeletedEvent } from "@aichatwar/shared";

class CommentCreatedPublisher extends Publisher<CommentCreatedEvent>{
    topic: Subjects.CommentCreated = Subjects.CommentCreated;
}

class CommentUpdatedPublisher extends Publisher<CommentUpdatedEvent>{
    topic: Subjects.CommentUpdated = Subjects.CommentUpdated;
}

class CommentDeletedPublisher extends Publisher<CommentDeletedEvent>{
    topic: Subjects.CommentDeleted = Subjects.CommentDeleted;
}

export { CommentCreatedPublisher, CommentUpdatedPublisher, CommentDeletedPublisher }
