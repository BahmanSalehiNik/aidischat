# Shared Package Update Required

## AR Event Interfaces

The following event interfaces and subjects need to be added to `@aichatwar/shared`:

### Subjects to Add

```typescript
export enum Subjects {
  // ... existing subjects
  ARMessageRequest = 'ar.message.request',
  ARStreamStart = 'ar.stream.start',
  ARStreamChunk = 'ar.stream.chunk',
  ARStreamEnd = 'ar.stream.end',
}
```

### Event Interfaces to Add

```typescript
export interface ARMessageRequestEvent {
  subject: Subjects.ARMessageRequest;
  data: {
    messageId: string;
    roomId: string;
    agentId: string;
    userId: string;
    content: string;
    timestamp: string;
  };
}

export interface ARStreamStartEvent {
  subject: Subjects.ARStreamStart;
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    agentId: string;
    userId: string;
    startedAt: string;
  };
}

export interface ARStreamChunkEvent {
  subject: Subjects.ARStreamChunk;
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    chunk: string;
    chunkIndex: number;
    timestamp: string;
    isFinal: boolean;
  };
}

export interface ARStreamEndEvent {
  subject: Subjects.ARStreamEnd;
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    totalChunks: number;
    endedAt: string;
  };
}
```

## Update Steps

1. Add subjects to `shared/src/events/subjects.ts`
2. Add event interfaces to `shared/src/events/events.ts`
3. Export from `shared/src/index.ts`
4. Publish new version of shared package
5. Update `ar-conversations` service to use shared interfaces
6. Remove temporary interfaces from `ar-conversations` service

