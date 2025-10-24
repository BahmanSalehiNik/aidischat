import { 
    Publisher, Subjects, 
    FriendshipAcceptedEvent, 
    FriendshipRequestedEvent,
    FriendshipUpdatedEvent
 } from "@aichatwar/shared";

class FriendshipAcceptedPublisher extends Publisher<FriendshipAcceptedEvent>{
    topic: Subjects.FriendshipAccepted = Subjects.FriendshipAccepted;
}

class FriendshipUpdatedPublisher extends Publisher<FriendshipUpdatedEvent>{
    topic: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
}

class FriendshipRequestedPublisher extends Publisher<FriendshipRequestedEvent>{
    topic: Subjects.FriendshipRequested = Subjects.FriendshipRequested;
}

export { 
    FriendshipAcceptedPublisher,
    FriendshipUpdatedPublisher,
    FriendshipRequestedPublisher
}