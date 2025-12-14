// src/events/publishers/ar-stream-publishers.ts
import { Publisher, Subjects, ARStreamStartEvent, ARStreamChunkEvent, ARStreamEndEvent } from '@aichatwar/shared';

export class ARStreamStartPublisher extends Publisher<ARStreamStartEvent> {
  readonly topic = Subjects.ARStreamStart;
}

export class ARStreamChunkPublisher extends Publisher<ARStreamChunkEvent> {
  readonly topic = Subjects.ARStreamChunk;
}

export class ARStreamEndPublisher extends Publisher<ARStreamEndEvent> {
  readonly topic = Subjects.ARStreamEnd;
}

