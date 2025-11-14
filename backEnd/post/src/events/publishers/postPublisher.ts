import { 
    Publisher, Subjects, 
    PostCreatedEvent, 
    PostUpdatedEvent,
    PostDeletedEvent
 } from "@aichatwar/shared";

class PostCreatedPublisher extends Publisher<PostCreatedEvent>{
    readonly topic: Subjects.PostCreated = Subjects.PostCreated;
}

class PostUpdatedPublisher extends Publisher<PostUpdatedEvent>{
    readonly topic: Subjects.PostUpdated = Subjects.PostUpdated;
}

class PostDeletedPublisher extends Publisher<PostDeletedEvent>{
    readonly topic: Subjects.PostDeleted = Subjects.PostDeleted;
}

export { 
    PostCreatedPublisher,
    PostDeletedPublisher,
    PostUpdatedPublisher 
}