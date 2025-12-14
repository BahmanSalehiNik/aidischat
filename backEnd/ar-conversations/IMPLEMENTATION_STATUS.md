# AR Conversations Service - Implementation Status

## ✅ Completed

### Phase 1: Foundation
- ✅ Room Service Enhancement
  - Added `AR` to RoomType enum
  - Added `capabilities`, `agentId`, `status`, `lastActivityAt` fields
  - Updated `createRoom` to handle AR rooms (checks for existing room per user-agent pair)
  - Updated `getUserRooms` to filter AR rooms by default

- ✅ AR Conversations Service Structure
  - Created service structure with all directories
  - Set up `package.json`, `tsconfig.json`, `Dockerfile`
  - Created `kafka-client.ts`, `app.ts`, `index.ts`
  - Created `connection-retry.ts` utility
  - Implemented non-blocking startup pattern

- ✅ AR Message Model
  - Created `ar-message.ts` with all required fields
  - Added indexes on `roomId`, `senderId`, `status`, `createdAt`

### Phase 2: Core Backend
- ✅ AR Message Routes
  - `POST /api/ar-rooms/:roomId/messages` - Send message, triggers streaming
  - `GET /api/ar-rooms/:roomId/messages` - Get message history

- ✅ Token Management Route
  - `GET /api/ar-rooms/:roomId/provider-tokens` - Get signed tokens for TTS/animation providers

- ✅ Kafka Event Publishers
  - `ARMessageRequestPublisher` - Publishes AR message request events

- ✅ Kafka Event Listeners
  - `ARStreamChunkListener` - Listens for stream chunks and updates AR messages

### Phase 3: Client-Side
- ✅ Phoneme-to-Viseme Service
  - Created `phonemeToViseme.ts` with static mapping
  - `generateVisemes()` function
  - `visemeToBlendShape()` mapping for 3D models

- ✅ Marker Parser
  - Created `markerParser.ts` utility
  - `parseMarkers()` function
  - `extractMarkersSequentially()` function
  - Helper functions for marker extraction

---

## 🚧 In Progress / TODO

### Shared Package Update
- ⚠️ **CRITICAL**: Update `@aichatwar/shared` package with AR event interfaces
  - See `SHARED_PACKAGE_UPDATE.md` for details
  - Add Subjects: `ARMessageRequest`, `ARStreamStart`, `ARStreamChunk`, `ARStreamEnd`
  - Add event interfaces for all AR events
  - Publish new version and update `ar-conversations` service

### Room Access Validation
- [ ] Add room access validation in AR message routes
- [ ] Fetch room from Room Service to verify user ownership
- [ ] Extract `agentId` from room instead of request body

### AI Gateway Integration
- [ ] Create `ARMessageRequestListener` in AI Gateway
- [ ] Implement streaming support in AI providers (OpenAI, Anthropic)
- [ ] Add marker injection to AI prompts
- [ ] Publish `ARStreamStartEvent`, `ARStreamChunkEvent`, `ARStreamEndEvent`

### Realtime Gateway Integration
- [ ] Add `ARStreamChunkListener` to Realtime Gateway
- [ ] Publish to Redis channel: `ar-room:${roomId}`
- [ ] Update WebSocket server to handle AR room channels
- [ ] Add AR stream message types to WebSocket protocol

### Token Management Enhancement
- [ ] Encrypt API keys before sending to client
- [ ] Implement proper JWT/HMAC signing for tokens
- [ ] Add token rotation logic
- [ ] Add rate limiting per token

### Client Implementation
- [ ] Create AR Chat Screen component
- [ ] Add "Video Chat" button to Agent Detail Page
- [ ] Implement WebSocket connection for streaming
- [ ] Integrate TTS service (Web Speech API or ElevenLabs)
- [ ] Integrate viseme service with 3D model
- [ ] Create AR rendering component

### Testing
- [ ] Unit tests for marker parser
- [ ] Unit tests for viseme generation
- [ ] Integration tests for AR message flow
- [ ] End-to-end tests for AR conversation

---

## 📋 Next Steps

1. **Update Shared Package** (Priority 1)
   - Add AR event interfaces to `@aichatwar/shared`
   - Publish new version
   - Update `ar-conversations` service to use shared interfaces

2. **AI Gateway Streaming** (Priority 2)
   - Implement streaming in AI providers
   - Add marker injection
   - Publish stream events

3. **Realtime Gateway** (Priority 3)
   - Add AR stream chunk listener
   - Update WebSocket server

4. **Client Implementation** (Priority 4)
   - Create AR Chat Screen
   - Add "Video Chat" button
   - Integrate TTS and visemes

---

## 🔧 Configuration Needed

### Environment Variables
```bash
# AR Conversations Service
MONGO_URI=mongodb://...
KAFKA_BROKER_URL=...
KAFKA_CLIENT_ID=ar-conversations
JWT_DEV=...

# TTS Provider (optional)
TTS_PROVIDER=elevenlabs  # or 'azure', 'web-speech'
ELEVENLABS_API_KEY=...   # if using ElevenLabs
AZURE_SPEECH_KEY=...     # if using Azure

# Animation Provider
ANIMATION_PROVIDER=client-side  # phoneme-to-viseme
```

### Kafka Topics to Create
- `ar.message.request`
- `ar.stream.start`
- `ar.stream.chunk`
- `ar.stream.end`

---

## 📝 Notes

- AR rooms are stored in Room Service (same collection as chat rooms)
- AR messages are stored in AR Conversations Service (separate collection)
- Phoneme-to-viseme mapping is client-side and offline
- Marker parsing is client-side
- TTS and animations are client-side (backend only provides tokens)

