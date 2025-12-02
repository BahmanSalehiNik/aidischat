import {
  Publisher,
  Subjects,
  AgentDraftCreatedEvent,
  AgentDraftUpdatedEvent,
  AgentDraftPostApprovedEvent,
  AgentDraftCommentApprovedEvent,
  AgentDraftReactionApprovedEvent,
  AgentDraftRejectedEvent,
  AgentJoinRequestEvent,
  AgentLeaveRequestEvent,
  AgentInviteOwnerApprovalRequiredEvent,
  AgentPresenceUpdatedEvent,
  AgentSafetyStateUpdatedEvent,
  AgentRemovedFromRoomEvent,
  AgentCapabilityRestrictedEvent,
  AgentFeedScannedEvent,
  AgentDraftPostCreatedEvent,
  AgentDraftCommentCreatedEvent,
  AgentDraftReactionCreatedEvent,
  AgentDraftConnectionRequestCreatedEvent,
} from '@aichatwar/shared';

export class AgentDraftCreatedPublisher extends Publisher<AgentDraftCreatedEvent> {
  readonly topic = Subjects.AgentDraftCreated;
}

export class AgentDraftUpdatedPublisher extends Publisher<AgentDraftUpdatedEvent> {
  readonly topic = Subjects.AgentDraftUpdated;
}

export class AgentDraftPostApprovedPublisher extends Publisher<AgentDraftPostApprovedEvent> {
  readonly topic = Subjects.AgentDraftPostApproved;
}

export class AgentDraftCommentApprovedPublisher extends Publisher<AgentDraftCommentApprovedEvent> {
  readonly topic = Subjects.AgentDraftCommentApproved;
}

export class AgentDraftReactionApprovedPublisher extends Publisher<AgentDraftReactionApprovedEvent> {
  readonly topic = Subjects.AgentDraftReactionApproved;
}

export class AgentDraftRejectedPublisher extends Publisher<AgentDraftRejectedEvent> {
  readonly topic = Subjects.AgentDraftRejected;
}

export class AgentJoinRequestPublisher extends Publisher<AgentJoinRequestEvent> {
  readonly topic = Subjects.AgentJoinRequest;
}

export class AgentLeaveRequestPublisher extends Publisher<AgentLeaveRequestEvent> {
  readonly topic = Subjects.AgentLeaveRequest;
}

export class AgentInviteOwnerApprovalRequiredPublisher extends Publisher<AgentInviteOwnerApprovalRequiredEvent> {
  readonly topic = Subjects.AgentInviteOwnerApprovalRequired;
}

export class AgentPresenceUpdatedPublisher extends Publisher<AgentPresenceUpdatedEvent> {
  readonly topic = Subjects.AgentPresenceUpdated;
}

export class AgentSafetyStateUpdatedPublisher extends Publisher<AgentSafetyStateUpdatedEvent> {
  readonly topic = Subjects.AgentSafetyStateUpdated;
}

export class AgentRemovedFromRoomPublisher extends Publisher<AgentRemovedFromRoomEvent> {
  readonly topic = Subjects.AgentRemovedFromRoom;
}

export class AgentCapabilityRestrictedPublisher extends Publisher<AgentCapabilityRestrictedEvent> {
  readonly topic = Subjects.AgentCapabilityRestricted;
}

export class AgentFeedScannedPublisher extends Publisher<AgentFeedScannedEvent> {
  readonly topic = Subjects.AgentFeedScanned;
}

export class AgentDraftPostCreatedPublisher extends Publisher<AgentDraftPostCreatedEvent> {
  readonly topic = Subjects.AgentDraftPostCreated;
}

export class AgentDraftCommentCreatedPublisher extends Publisher<AgentDraftCommentCreatedEvent> {
  readonly topic = Subjects.AgentDraftCommentCreated;
}

export class AgentDraftReactionCreatedPublisher extends Publisher<AgentDraftReactionCreatedEvent> {
  readonly topic = Subjects.AgentDraftReactionCreated;
}

export class AgentDraftConnectionRequestCreatedPublisher extends Publisher<AgentDraftConnectionRequestCreatedEvent> {
  readonly topic = Subjects.AgentDraftConnectionRequestCreated;
}

