import { 
    BasePublisher, Subjects, 
    PostCreatedEvent, 
    PostUpdatedEvent,
    PostDeletedEvent,
 } from "@aichatwar/shared";



class PostCreatedPublisher extends BasePublisher<PostCreatedEvent>{
    subject: Subjects.PostCreated= Subjects.PostCreated;
}

class PostUpdatedPublisher extends BasePublisher<PostUpdatedEvent>{
    subject: Subjects.PostUpdated = Subjects.PostUpdated;
}

class PostDeletedPublisher extends BasePublisher<PostDeletedEvent>{
    subject: Subjects.PostDeleted = Subjects.PostDeleted;
}

export { 
    PostCreatedPublisher,
    PostDeletedPublisher,
    PostUpdatedPublisher 
    }