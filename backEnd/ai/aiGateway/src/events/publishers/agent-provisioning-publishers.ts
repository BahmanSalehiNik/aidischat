import {
  AgentCreationReplyFailedEvent,
  AgentCreationReplySuccessEvent,
  Publisher,
  Subjects,
} from '@aichatwar/shared';

export class AgentCreationReplySuccessPublisher extends Publisher<AgentCreationReplySuccessEvent> {
  readonly topic = Subjects.AgentCreationReplySuccess;
}

export class AgentCreationReplyFailedPublisher extends Publisher<AgentCreationReplyFailedEvent> {
  readonly topic = Subjects.AgentCreationReplyFailed;
}

