import { 
    Publisher, Subjects, 
    PostCreatedEvent, 
    PostUpdatedEvent,
    PostDeletedEvent
 } from "@aichatwar/shared";

class PostCreatedPublisher extends Publisher<PostCreatedEvent>{
    topic: Subjects.PostCreated = Subjects.PostCreated;
}

class PostUpdatedPublisher extends Publisher<PostUpdatedEvent>{
    topic: Subjects.PostUpdated = Subjects.PostUpdated;
}

class PostDeletedPublisher extends Publisher<PostDeletedEvent>{
    topic: Subjects.PostDeleted = Subjects.PostDeleted;
}

export { 
    PostCreatedPublisher,
    PostDeletedPublisher,
    PostUpdatedPublisher 
}