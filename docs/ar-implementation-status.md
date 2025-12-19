# AR Implementation Status

## Overview
This document tracks the implementation status of the AR streaming chat feature.

---

## ✅ Completed Components

### Backend Services

#### 1. Room Service Enhancement
- ✅ Added `type: 'chat' | 'ar' | 'group'` field to Room model
- ✅ Added `capabilities: string[]` field
- ✅ Added `agentId`, `status`, `lastActivityAt` fields for AR rooms
- ✅ Updated `POST /api/rooms` to handle AR room creation
- ✅ Updated `GET /api/rooms` with `excludeAR=true` filter
- ✅ Room creation returns existing AR room if one exists for user+agent

**Files:**
- `backEnd/room/src/models/room.ts`
- `backEnd/room/src/routes/createRoom.ts`
- `backEnd/room/src/routes/getUserRooms.ts`

---

#### 2. AR Conversations Service
- ✅ Service structure created
- ✅ MongoDB and Kafka integration
- ✅ Non-blocking startup pattern
- ✅ AR Message model with markers support
- ✅ Routes:
  - `POST /api/ar-rooms/:roomId/messages` - Send AR message
  - `GET /api/ar-rooms/:roomId/messages` - Get message history
  - `GET /api/ar-rooms/:roomId/provider-tokens` - Get TTS/animation tokens
- ✅ Kafka listener: `ARStreamChunkListener` (updates message status)

**Files:**
- `backEnd/ar-conversations/src/`
- `backEnd/ar-conversations/src/models/ar-message.ts`
- `backEnd/ar-conversations/src/routes/ar-messages.ts`
- `backEnd/ar-conversations/src/routes/ar-tokens.ts`
- `backEnd/ar-conversations/src/events/listeners/ar-stream-chunk-listener.ts`
- `backEnd/ar-conversations/src/events/publishers/ar-message-request-publisher.ts`

---

#### 3. AI Gateway Streaming
- ✅ `ARMessageRequestListener` - Consumes AR message requests
- ✅ Streaming support in `OpenAIProvider`:
  - `streamResponseWithChatCompletions()` - Chat Completions API streaming
  - `streamResponseWithAssistant()` - Assistants API streaming
- ✅ **Enhanced AR system prompt with explicit marker requirements**
- ✅ **Message formatting with username (username: message)**
- ✅ **OpenAI Assistants API marker instruction injection**
- ✅ **Debug logging for marker generation**
- ✅ Publishers:
  - `ARStreamStartPublisher`
  - `ARStreamChunkPublisher`
  - `ARStreamEndPublisher`
- ✅ Thread management for AR rooms

**Files:**
- `backEnd/ai/aiGateway/src/events/listeners/ar-message-request-listener.ts`
- `backEnd/ai/aiGateway/src/events/publishers/ar-stream-publishers.ts`
- `backEnd/ai/aiGateway/src/providers/openai-provider.ts` (streaming methods)
- `backEnd/ai/aiGateway/src/providers/base-provider.ts` (streaming interface)

---

#### 4. Realtime Gateway AR Support
- ✅ `ARStreamChunkListener` - Consumes AR stream chunks from Kafka
- ✅ Redis pub/sub for AR rooms (`ar-room:{roomId}` channel)
- ✅ WebSocket handler for AR stream chunks
- ✅ AR room channel subscription on join

**Files:**
- `backEnd/realtime-gateway/src/events/listeners/ar-stream-chunk-listener.ts`
- `backEnd/realtime-gateway/src/ws-server.ts` (AR channel handling)
- `backEnd/realtime-gateway/src/index.ts` (AR listener registration)

---

### Client-Side Components

#### 5. AR Chat Screen
- ✅ Basic screen structure
- ✅ AR room creation/retrieval
- ✅ Provider token fetching
- ✅ Message history loading
- ✅ WebSocket integration for streaming
- ✅ Input area for sending messages
- ✅ Connection status indicator
- ✅ Streaming content display
- ✅ **Subtitle display for messages (user and agent)**
- ✅ **Real-time marker parsing from streaming chunks**
- ✅ **Emotion and movement markers extraction**
- ✅ **Keyboard-aware subtitle positioning**
- ✅ **Room-based message filtering (no cross-room messages)**

**Files:**
- `client/mobile-app/app/(main)/ARChatScreen.tsx`
- `client/mobile-app/utils/arApi.ts`

---

#### 6. Video Chat Button
- ✅ Added to Agent Detail Screen
- ✅ Only visible when `avatarStatus === 'ready'`
- ✅ Navigates to AR Chat Screen

**Files:**
- `client/mobile-app/app/(main)/AgentDetailScreen.tsx`

---

#### 7. Client-Side Utilities
- ✅ Marker parser (`parseMarkers()`) - Supports both `['value']` and `[type:value]` formats
- ✅ Phoneme-to-viseme converter (`generateVisemes()`)
- ✅ **Real-time marker extraction during streaming**
- ✅ **Sequential marker extraction for animations**

**Files:**
- `client/mobile-app/utils/markerParser.ts`
- `client/mobile-app/utils/phonemeToViseme.ts`

---

## ⚠️ Pending Tasks

### Critical

#### 1. Update @aichatwar/shared Package
**Status:** ⚠️ **REQUIRED** - System won't work without this

**What needs to be added:**

1. **AR Event Interfaces:**
```typescript
// In Subjects enum
export enum Subjects {
  // ... existing subjects
  ARMessageRequest = 'ar.message.request',
  ARStreamStart = 'ar.stream.start',
  ARStreamChunk = 'ar.stream.chunk',
  ARStreamEnd = 'ar.stream.end',
}

// AR Message Request Event
export interface ARMessageRequestEvent {
  subject: Subjects.ARMessageRequest;
  data: {
    messageId: string;
    roomId: string;
    agentId: string;
    userId: string;
    content: string; // Text with markers
    timestamp: string;
  };
}

// AR Stream Start Event
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

// AR Stream Chunk Event
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

// AR Stream End Event
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

2. **Room Type Enum:**
```typescript
export enum RoomType {
  Chat = 'chat',
  AR = 'ar',
  Group = 'group',
}
```

**Files to update:**
- `packages/shared/src/events/` (add AR event files)
- `packages/shared/src/events/types.ts` (add to Subjects enum)
- `packages/shared/src/models/room.ts` (add RoomType enum)

**Action Required:**
1. Update shared package
2. Build and publish shared package
3. Update all services to use new types
4. Remove temporary interfaces from services

---

### High Priority

#### 2. AR Rendering Integration
**Status:** 🎯 **NEXT STEP** - Ready to implement

**Current State:**
- ✅ 3D model URL is fetched and available (`modelUrl` in ARChatScreen)
- ✅ `Model3DViewer` component exists with Three.js integration
- ✅ `ARViewer` component foundation exists
- ⚠️ AR rendering placeholder in ARChatScreen (line 433: "AR rendering will be implemented here")

**Tasks:**
- [ ] Replace placeholder with `Model3DViewer` component in ARChatScreen
- [ ] Integrate 3D model loading from `modelUrl`
- [ ] Connect marker parsing to animation system
- [ ] Apply emotion markers to 3D model blend shapes
- [ ] Apply movement/gesture markers to animations
- [ ] Handle AR session lifecycle (if using AR mode)
- [ ] Camera permissions (if using AR mode)
- [ ] AR plane detection (if using AR mode)
- [ ] Model positioning and scaling in AR space

**Estimated Time:** 3-5 days

**Note:** The 3D viewer component (`Model3DViewer.tsx`) is already implemented and ready to use. It needs to be integrated into `ARChatScreen.tsx` to replace the placeholder.

---

#### 3. TTS Integration
**Status:** 🔄 Not Started

**Tasks:**
- Integrate ElevenLabs API
- Integrate Azure Speech SDK
- Use provider tokens from backend
- Stream audio playback
- Handle audio errors gracefully

**Estimated Time:** 2-3 days

---

#### 4. Animation System
**Status:** 🔄 Not Started

**Tasks:**
- Apply emotion markers to 3D model
- Apply gesture markers
- Apply pose markers
- Blend shape animations
- Animation state management

**Estimated Time:** 3-4 days

---

#### 5. Viseme Synchronization
**Status:** 🔄 Not Started

**Tasks:**
- Sync visemes with audio playback
- Apply visemes to 3D model blend shapes
- Handle timing precision
- Smooth transitions between visemes

**Estimated Time:** 2-3 days

---

### Medium Priority

#### 6. UI/UX Improvements
**Status:** 🔄 Basic structure only

**Tasks:**
- Message bubbles for AR chat
- Better loading states
- Error handling UI
- Streaming indicators
- Connection status UI
- AR session status indicators

**Estimated Time:** 2-3 days

---

#### 7. Error Handling
**Status:** 🔄 Basic error handling

**Tasks:**
- Network error recovery
- WebSocket reconnection logic
- Token expiration handling
- AR session error handling
- Graceful degradation

**Estimated Time:** 1-2 days

---

#### 8. Testing
**Status:** 🔄 Not Started

**Tasks:**
- End-to-end flow testing
- WebSocket streaming tests
- AR rendering tests
- TTS integration tests
- Marker parsing tests
- Error scenario tests

**Estimated Time:** 3-5 days

---

## 📋 Implementation Flow

### Current Flow (Working)
```
User clicks "Video Chat"
  ↓
Client: POST /api/rooms (type='ar', agentId)
  ↓
Room Service: Creates/returns AR room
  ↓
Client: GET /api/ar-rooms/:roomId/provider-tokens
  ↓
Client: Connects to WebSocket
  ↓
User sends message
  ↓
Client: POST /api/ar-rooms/:roomId/messages
  ↓
AR Conversations Service: Publishes ARMessageRequestEvent
  ↓
AI Gateway: Streams response with markers
  ↓
AI Gateway: Publishes ARStreamChunkEvent
  ↓
Realtime Gateway: Forwards to Redis → WebSocket
  ↓
Client: Receives stream chunks
  ↓
Client: Parses markers from chunks (✅ Working)
  ↓
Client: Displays subtitle with messages (✅ Working)
  ↓
[PENDING: 3D Model Rendering, TTS, Animations, AR Mode]
```

---

## 🔧 Configuration Needed

### Environment Variables

**AR Conversations Service:**
- `MONGO_URI`
- `KAFKA_BROKER_URL`
- `KAFKA_CLIENT_ID`
- `JWT_DEV`
- `ELEVENLABS_API_KEY` (for token generation)
- `AZURE_SPEECH_KEY` (for token generation)
- `AZURE_SPEECH_REGION` (for token generation)

**AI Gateway:**
- `OPENAI_API_KEY` (for streaming)
- Other provider keys as needed

---

## 📝 Notes

1. **Shared Package Update is Critical**: The system uses temporary interfaces. Update the shared package before production use.

2. **AR Rendering**: Choose between Expo AR (easier) or Three.js + ARCore/ARKit (more control).

3. **TTS Provider**: Start with ElevenLabs for better quality, Azure Speech as fallback.

4. **Performance**: AR rendering is resource-intensive. Optimize 3D models and use LOD.

5. **Testing**: Test on real devices. AR features don't work in simulators.

---

## 🎯 Next Steps

### Current Phase: ✅ Message Display Complete
1. ✅ **Messages visible in UI** - Subtitle display working
2. ✅ **Emotions and markers working** - Markers are parsed and extracted
3. ✅ **Real-time streaming** - Chunks received and displayed
4. ✅ **Username formatting** - Messages formatted as "username: message"
5. ⚠️ **Shared package update** - Still needed for production

### Next Phase: 🎯 3D Model Rendering (IMMEDIATE NEXT STEP)
**Status:** Ready to implement - All prerequisites complete

**Implementation Steps:**
1. **Integrate Model3DViewer into ARChatScreen** (1-2 hours)
   - Replace placeholder with `<Model3DViewer modelUrl={modelUrl} />`
   - Position in the AR view container
   
2. **Connect Markers to Animations** (2-3 days)
   - Apply emotion markers to blend shapes
   - Apply movement markers to animations
   - Create animation state management
   
3. **TTS Integration** (2-3 days)
   - Integrate ElevenLabs/Azure Speech
   - Stream audio playback
   - Sync with visemes
   
4. **Viseme Synchronization** (2-3 days)
   - Sync visemes with audio
   - Apply to 3D model blend shapes

### Future Phase: AR Mode
- AR plane detection
- Model placement in real world
- AR session management

---

**Last Updated:** December 19, 2025  
**Status:** ✅ Messages & Markers Working, 🎯 Ready for 3D Rendering  
**Next Step:** Integrate Model3DViewer component into ARChatScreen

