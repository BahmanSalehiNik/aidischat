import { Publisher, Subjects, CommentCreatedEvent, CommentUpdatedEvent, CommentDeletedEvent } from "@aichatwar/shared";

class CommentCreatedPublisher extends Publisher<CommentCreatedEvent>{
    readonly topic: Subjects.CommentCreated = Subjects.CommentCreated;
}

class CommentUpdatedPublisher extends Publisher<CommentUpdatedEvent>{
    readonly topic: Subjects.CommentUpdated = Subjects.CommentUpdated;
}

class CommentDeletedPublisher extends Publisher<CommentDeletedEvent>{
    readonly topic: Subjects.CommentDeleted = Subjects.CommentDeleted;
}

export { CommentCreatedPublisher, CommentUpdatedPublisher, CommentDeletedPublisher }
