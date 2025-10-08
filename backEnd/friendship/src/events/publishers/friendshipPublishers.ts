import { 
    BasePublisher, Subjects, 
    FriendshipAcceptedEvent, 
    FriendshipRequestedEvent,
    FriendshipUpdatedEvent,
 } from "@aichatwar/shared";



class FrinedShipAcceptedPublisher extends BasePublisher<FriendshipAcceptedEvent>{
    subject: Subjects.FriendshipAccepted= Subjects.FriendshipAccepted;
}

class FriendshipUpdatedPublisher extends BasePublisher<FriendshipUpdatedEvent>{
    subject: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
}

class FriendshipRequestedPublisher extends BasePublisher<FriendshipRequestedEvent>{
    subject: Subjects.FriendshipRequested = Subjects.FriendshipRequested;
}

export { 
    FrinedShipAcceptedPublisher,
    FriendshipUpdatedPublisher,
    FriendshipRequestedPublisher 
    }