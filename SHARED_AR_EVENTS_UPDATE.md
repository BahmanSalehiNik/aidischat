# Shared Package AR Events Update

## Summary
Updated `@aichatwar/shared` package with AR event interfaces and RoomType enum.

## Changes Made

### 1. Added AR Subjects to `shared/src/events/subjects.ts`
```typescript
// AR Events
ARMessageRequest = 'ar.message.request',
ARStreamStart = 'ar.stream.start',
ARStreamChunk = 'ar.stream.chunk',
ARStreamEnd = 'ar.stream.end'
```

### 2. Created `shared/src/events/arEvents.ts`
- `ARMessageRequestEvent` - Request for AR message processing
- `ARStreamStartEvent` - Stream start notification
- `ARStreamChunkEvent` - Stream chunk with text and markers
- `ARStreamEndEvent` - Stream completion notification

### 3. Added RoomType Enum to `shared/src/events/roomEvents.ts`
```typescript
export enum RoomType {
  Chat = 'chat',
  AR = 'ar',
  Group = 'group',
}
```

### 4. Updated `RoomCreatedEvent` Interface
Added optional fields for AR rooms:
- `capabilities?: string[]`
- `agentId?: string`
- `status?: 'active' | 'paused' | 'ended'`

### 5. Exported from `shared/src/index.ts`
Added: `export * from "./events/arEvents";`

## Services Updated

### ✅ AR Conversations Service
- `backEnd/ar-conversations/src/events/publishers/ar-message-request-publisher.ts`
  - Now uses `Subjects.ARMessageRequest` and `ARMessageRequestEvent` from shared
- `backEnd/ar-conversations/src/events/listeners/ar-stream-chunk-listener.ts`
  - Now uses `Subjects.ARStreamChunk` and `ARStreamChunkEvent` from shared

### ✅ AI Gateway
- `backEnd/ai/aiGateway/src/events/publishers/ar-stream-publishers.ts`
  - Now uses all AR event types from shared
- `backEnd/ai/aiGateway/src/events/listeners/ar-message-request-listener.ts`
  - Now uses `Subjects.ARMessageRequest` and `ARMessageRequestEvent` from shared

### ✅ Realtime Gateway
- `backEnd/realtime-gateway/src/events/listeners/ar-stream-chunk-listener.ts`
  - Now uses `ARStreamChunkEvent` from shared

## Build Status

✅ Shared package built successfully
- Run: `cd shared && npm run build`
- Output: `shared/build/` contains compiled TypeScript

## Next Steps

1. **Update package version** (if needed):
   ```bash
   cd shared
   npm version patch  # or minor/major
   ```

2. **Publish shared package** (if needed):
   ```bash
   cd shared
   npm publish
   ```

3. **Update services to use latest shared version**:
   ```bash
   # In each service directory
   npm install @aichatwar/shared@latest
   ```

4. **Rebuild services** (if TypeScript errors persist):
   - Restart TypeScript server in IDE
   - Or rebuild: `npm run build` in each service

## Verification

To verify the update worked:

1. Check shared package exports:
   ```bash
   cd shared
   npm run build
   cat build/index.d.ts | grep -i ar
   ```

2. Check service imports:
   ```bash
   # Should not have import errors
   cd backEnd/ar-conversations
   npx tsc --noEmit
   ```

## Files Modified

### Shared Package
- `shared/src/events/subjects.ts` - Added AR subjects
- `shared/src/events/arEvents.ts` - Created AR event interfaces
- `shared/src/events/roomEvents.ts` - Added RoomType enum and updated RoomCreatedEvent
- `shared/src/index.ts` - Exported arEvents

### Services
- `backEnd/ar-conversations/src/events/publishers/ar-message-request-publisher.ts`
- `backEnd/ar-conversations/src/events/listeners/ar-stream-chunk-listener.ts`
- `backEnd/ai/aiGateway/src/events/publishers/ar-stream-publishers.ts`
- `backEnd/ai/aiGateway/src/events/listeners/ar-message-request-listener.ts`
- `backEnd/realtime-gateway/src/events/listeners/ar-stream-chunk-listener.ts`

## Notes

- All temporary interfaces have been removed from services
- Services now use shared types for type safety
- Room service already has its own RoomType enum (more comprehensive), but shared RoomType is used in events
- If TypeScript errors persist, restart the TypeScript server or rebuild the shared package

---

**Status:** ✅ Complete  
**Date:** [Current Date]

