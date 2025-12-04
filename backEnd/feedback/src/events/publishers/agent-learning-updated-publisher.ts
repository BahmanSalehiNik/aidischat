import { Publisher, AgentLearningUpdatedEvent, Subjects } from "@aichatwar/shared";

export class AgentLearningUpdatedPublisher extends Publisher<AgentLearningUpdatedEvent> {
    readonly topic = Subjects.AgentLearningUpdated;
}

