import { 
    Publisher, Subjects, 
    MediaCreatedEvent, 
    MediaUpdatedEvent,
    MediaDeletedEvent
} from "@aichatwar/shared";

class MediaCreatedPublisher extends Publisher<MediaCreatedEvent>{
    readonly topic: Subjects.MediaCreated = Subjects.MediaCreated;
}

class MediaUpdatedPublisher extends Publisher<MediaUpdatedEvent>{
    readonly topic: Subjects.MediaUpdated = Subjects.MediaUpdated;
}

class MediaDeletedPublisher extends Publisher<MediaDeletedEvent>{
    readonly topic: Subjects.MediaDeleted = Subjects.MediaDeleted;
}

export { 
    MediaCreatedPublisher,
    MediaUpdatedPublisher,
    MediaDeletedPublisher
}

