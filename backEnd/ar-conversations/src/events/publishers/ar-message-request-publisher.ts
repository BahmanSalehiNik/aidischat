// src/events/publishers/ar-message-request-publisher.ts
import { Publisher, Subjects, ARMessageRequestEvent } from '@aichatwar/shared';

export class ARMessageRequestPublisher extends Publisher<ARMessageRequestEvent> {
  readonly topic = Subjects.ARMessageRequest;
}

