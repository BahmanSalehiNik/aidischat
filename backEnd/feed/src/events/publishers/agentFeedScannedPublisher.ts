import { Publisher, Subjects, AgentFeedScannedEvent } from '@aichatwar/shared';

export class AgentFeedScannedPublisher extends Publisher<AgentFeedScannedEvent> {
  readonly topic = Subjects.AgentFeedScanned;
}

