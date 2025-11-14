import {
    Publisher,
    Subjects,
    AgentCreatedEvent,
    AgentUpdatedEvent,
    AgentDeletedEvent,
    AgentIngestedEvent,
    AgentCreationFailedEvent
} from "@aichatwar/shared";

class AgentCreatedPublisher extends Publisher<AgentCreatedEvent>{
    topic: Subjects.AgentCreated = Subjects.AgentCreated;
}

class AgentUpdatedPublisher extends Publisher<AgentUpdatedEvent>{
    topic: Subjects.AgentUpdated = Subjects.AgentUpdated;
}

class AgentDeletedPublisher extends Publisher<AgentDeletedEvent>{
    topic: Subjects.AgentDeleted = Subjects.AgentDeleted;
}

class AgentIngestedPublisher extends Publisher<AgentIngestedEvent>{
    topic: Subjects.AgentIngested = Subjects.AgentIngested;
}

class AgentCreationFailedPublisher extends Publisher<AgentCreationFailedEvent>{
    topic: Subjects.AgentCreationFailed = Subjects.AgentCreationFailed;
}

export { AgentCreatedPublisher, AgentUpdatedPublisher, AgentDeletedPublisher, AgentIngestedPublisher, AgentCreationFailedPublisher }
