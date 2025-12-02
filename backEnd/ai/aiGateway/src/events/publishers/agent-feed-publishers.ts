// src/events/publishers/agent-feed-publishers.ts
import { Publisher, Subjects, AgentFeedDigestedEvent, AgentFeedAnswerReceivedEvent } from '@aichatwar/shared';

export class AgentFeedDigestedPublisher extends Publisher<AgentFeedDigestedEvent> {
  readonly topic = Subjects.AgentFeedDigested;
}

export class AgentFeedAnswerReceivedPublisher extends Publisher<AgentFeedAnswerReceivedEvent> {
  readonly topic = Subjects.AgentFeedAnswerReceived;
}

