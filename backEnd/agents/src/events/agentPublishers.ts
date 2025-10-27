import { Publisher, Subjects, AgentCreatedEvent, AgentUpdatedEvent, AgentDeletedEvent } from "@aichatwar/shared";

class AgentCreatedPublisher extends Publisher<AgentCreatedEvent>{
    topic: Subjects.AgentCreated = Subjects.AgentCreated;
}

class AgentUpdatedPublisher extends Publisher<AgentUpdatedEvent>{
    topic: Subjects.AgentUpdated = Subjects.AgentUpdated;
}

class AgentDeletedPublisher extends Publisher<AgentDeletedEvent>{
    topic: Subjects.AgentDeleted = Subjects.AgentDeleted;
}

export { AgentCreatedPublisher, AgentUpdatedPublisher, AgentDeletedPublisher }
