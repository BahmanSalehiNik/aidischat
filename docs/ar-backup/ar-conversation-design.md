# AR Conversation Feature - Design Document

## Overview
This document outlines the design for implementing AR (Augmented Reality) conversations between users and AI agents, creating a video-call-like experience in AR.

## Phase 1: Text-Based AR Conversation

### Current Architecture Analysis

**Room Creation Flow:**
1. User creates room via `/api/rooms` (Room Service)
2. Room saved to MongoDB
3. `RoomCreatedEvent` published to Kafka
4. Chat service listens and creates local room copy
5. Realtime Gateway handles WebSocket connections

**Message Flow:**
1. User sends message → Chat Service
2. Chat Service creates message → Publishes `MessageCreatedEvent` to Kafka
3. Realtime Gateway receives event → Broadcasts via Redis pub/sub
4. All connected clients receive message via WebSocket

---

## Proposed Design

### 1. Room Model Changes

#### Option A: Boolean Flag (Your Proposal)
```typescript
// backEnd/room/src/models/room.ts
const roomSchema = new mongoose.Schema({
  // ... existing fields
  isARConversation: { type: Boolean, default: false },
});
```

**Pros:**
- ✅ Simple, minimal change
- ✅ Easy to query/filter AR rooms
- ✅ Backward compatible (defaults to false)

**Cons:**
- ❌ Less flexible for future AR features (different AR modes, settings)
- ❌ Can't store AR-specific metadata (environment, settings, etc.)

#### Option B: AR Configuration Object (Recommended)
```typescript
const roomSchema = new mongoose.Schema({
  // ... existing fields
  arConfig: {
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ['conversation', 'presentation', 'tutorial'], default: 'conversation' },
    environment: { type: String }, // e.g., 'office', 'outdoor', 'studio'
    settings: {
      showSubtitles: { type: Boolean, default: true },
      enableGestures: { type: Boolean, default: true },
      animationStyle: { type: String, default: 'natural' },
    },
  },
});
```

**Pros:**
- ✅ Extensible for future AR features
- ✅ Can store AR-specific settings
- ✅ Better for analytics and feature flags

**Cons:**
- ❌ More complex initial implementation
- ❌ Requires migration for existing rooms

**Recommendation:** Start with Option A (boolean) for Phase 1, migrate to Option B in Phase 2.

---

### 2. RoomCreatedEvent Changes

```typescript
// packages/shared/src/events/room-created-event.ts
export interface RoomCreatedEvent {
  subject: Subjects.RoomCreated;
  data: {
    id: string;
    type: RoomType;
    name?: string;
    createdBy: { id: string };
    visibility: 'private' | 'public' | 'invite';
    createdAt: string;
    isARConversation?: boolean; // NEW
  };
}
```

**Impact:**
- Room Service: Add field when publishing event
- Chat Service: Store field when listening to event
- Realtime Gateway: Can use field to route AR-specific events

---

### 3. AR Message Flow Architecture

#### Your Proposed Flow:
```
User Input (Text) 
  → Chat Service 
  → AI Gateway (AI Response + TTS + Movements)
  → Azure Storage (Voice + Movements)
  → Signed URLs + Text Response
  → Client (Renders in AR)
```

#### Detailed Flow:

**Step 1: User Sends Message**
```
Client → POST /api/chat/rooms/{roomId}/messages
{
  "content": "Hello, how are you?",
  "roomId": "room-123",
  "isARMessage": true  // Optional flag
}
```

**Step 2: Chat Service Processes**
- Creates message in database
- Publishes `MessageCreatedEvent` to Kafka
- If `isARMessage` or room is AR: Triggers AR processing

**Step 3: AI Gateway AR Processing**
- Receives `MessageCreatedEvent` (or new `ARMessageRequestEvent`)
- Calls AI provider for response
- Generates TTS audio
- Generates movements/animations (via animation service or AI)
- Uploads to Azure Storage:
  - Voice file: `ar-voices/{roomId}/{messageId}.mp3`
  - Movements file: `ar-movements/{roomId}/{messageId}.json`
- Generates signed URLs (15-30 min expiry)
- Publishes `ARMessageReadyEvent` with:
  ```json
  {
    "messageId": "msg-123",
    "roomId": "room-123",
    "text": "I'm doing great, thanks for asking!",
    "voiceUrl": "https://...signed-url...",
    "movementsUrl": "https://...signed-url...",
    "expiresAt": "2024-12-14T20:00:00Z"
  }
  ```

**Step 4: Client Receives AR Message**
- Realtime Gateway receives `ARMessageReadyEvent`
- Broadcasts via WebSocket to room
- Client receives:
  - Text (for subtitles)
  - Voice URL (plays audio)
  - Movements URL (animates 3D model)
- Client renders in AR scene

---

## Architecture Analysis

### Your Proposed Approach

**Upsides:**
1. ✅ **Separation of Concerns**: AI Gateway handles AI/TTS, AR module handles rendering
2. ✅ **Scalability**: Can scale AI Gateway independently
3. ✅ **Security**: Signed URLs with limited lifetime
4. ✅ **Caching**: Can cache voice/movements in Azure
5. ✅ **Event-Driven**: Uses existing Kafka infrastructure
6. ✅ **Non-blocking**: Client doesn't wait for AI processing

**Downsides:**
1. ❌ **Latency**: Multiple steps (AI → TTS → Storage → URL → Client)
2. ❌ **Complexity**: More moving parts, more failure points
3. ❌ **Cost**: Azure Storage + bandwidth for voice/movements
4. ❌ **Error Handling**: What if TTS fails? Movements fail?
5. ❌ **Synchronization**: Voice and movements must be in sync

**Open Questions:**
1. ❓ **Where does movement/animation generation happen?**
   - AI Gateway? (adds complexity)
   - Separate AR Animation Service? (better separation)
   - Client-side? (reduces latency but less control)

2. ❓ **How to handle real-time vs. pre-generated?**
   - Phase 1: Pre-generated (your approach)
   - Phase 2: Real-time streaming?

3. ❓ **What if user sends multiple messages quickly?**
   - Queue system?
   - Rate limiting?
   - Cancel previous if new arrives?

4. ❓ **How to handle agent interruptions?**
   - User can interrupt agent mid-speech?
   - How to cancel in-flight requests?

5. ❓ **Movement format?**
   - JSON with keyframes?
   - Blender/GLTF animation?
   - Timeline-based?

---

## Alternative/Improved Design

### Option 1: Hybrid Approach (Recommended)

**Key Changes:**
1. **Separate AR Animation Service**
   - Dedicated service for movement generation
   - Can use AI (GPT-4 vision, etc.) or rule-based
   - More scalable and testable

2. **Streaming Support (Phase 2)**
   - WebSocket for real-time voice streaming
   - Progressive movement updates
   - Lower latency

3. **Message Queue for AR Processing**
   - Dedicated queue for AR messages
   - Priority handling
   - Retry logic

**Architecture:**
```
User Message
  → Chat Service (creates message)
  → AR Message Queue (Kafka topic: ar.message.request)
  → AI Gateway (AI response)
  → AR Animation Service (movements)
  → TTS Service (voice)
  → Azure Storage (uploads)
  → AR Message Ready Event
  → Realtime Gateway
  → Client (AR rendering)
```

### Option 2: Client-Side Processing

**Key Changes:**
- AI Gateway returns: text + movement instructions (JSON)
- Client generates TTS locally (Web Speech API or local TTS)
- Client animates based on movement instructions
- No Azure Storage needed for voice

**Pros:**
- ✅ Lower latency
- ✅ Lower cost
- ✅ Works offline (after initial load)

**Cons:**
- ❌ Device-dependent TTS quality
- ❌ Larger client bundle
- ❌ Less control over voice characteristics

---

## Recommended Implementation Plan

### Phase 1: MVP (Your Approach with Improvements)

1. **Room Model**
   - Add `isARConversation: boolean` field
   - Update RoomCreatedEvent

2. **Message Flow**
   - Add `isARMessage` flag to message creation
   - Chat service detects AR room/message
   - Publishes `ARMessageRequestEvent` to new Kafka topic

3. **AI Gateway Enhancement**
   - New listener: `ARMessageRequestListener`
   - Processes: AI response → TTS → Movements
   - Uploads to Azure Storage
   - Publishes `ARMessageReadyEvent`

4. **AR Animation Service (New)**
   - Receives text + context
   - Generates movement JSON
   - Returns movement timeline

5. **Realtime Gateway**
   - New listener: `ARMessageReadyListener`
   - Broadcasts AR messages to room via WebSocket

6. **Client**
   - Receives AR message payload
   - Downloads voice + movements
   - Renders in AR scene

### Phase 2: Optimizations

1. **Streaming Support**
   - Real-time voice streaming
   - Progressive movement updates

2. **Caching**
   - Cache common responses
   - Pre-generate common movements

3. **Interruption Handling**
   - Cancel in-flight requests
   - Queue management

---

## Data Models

### AR Message Request Event
```typescript
export interface ARMessageRequestEvent {
  subject: Subjects.ARMessageRequest;
  data: {
    messageId: string;
    roomId: string;
    userId: string;
    agentId: string;
    content: string;
    timestamp: string;
  };
}
```

### AR Message Ready Event
```typescript
export interface ARMessageReadyEvent {
  subject: Subjects.ARMessageReady;
  data: {
    messageId: string;
    roomId: string;
    agentId: string;
    text: string;
    voiceUrl: string;
    movementsUrl: string;
    expiresAt: string;
    metadata: {
      duration: number; // voice duration in seconds
      movementCount: number;
    };
  };
}
```

### Movement JSON Format
```json
{
  "version": "1.0",
  "duration": 5.2,
  "keyframes": [
    {
      "time": 0.0,
      "pose": "idle",
      "expression": "neutral",
      "gesture": null
    },
    {
      "time": 1.5,
      "pose": "talking",
      "expression": "happy",
      "gesture": {
        "type": "hand_raise",
        "hand": "right",
        "intensity": 0.7
      }
    }
  ]
}
```

---

## API Endpoints

### New Endpoints

**POST /api/chat/rooms/{roomId}/ar-messages**
- Create AR message
- Triggers AR processing pipeline

**GET /api/ar/rooms/{roomId}/status**
- Get AR room status
- Check if agent is ready
- Get current animation state

**POST /api/ar/rooms/{roomId}/interrupt**
- Interrupt current agent response
- Cancel in-flight requests

---

## Error Handling

1. **TTS Failure**
   - Fallback to text-only
   - Log error, continue with movements

2. **Movement Generation Failure**
   - Fallback to default idle animation
   - Log error, continue with voice

3. **Azure Upload Failure**
   - Retry with exponential backoff
   - If fails after retries, return error to client

4. **Client Download Failure**
   - Retry download
   - Show error message to user

---

## Security Considerations

1. **Signed URLs**
   - Short expiry (15-30 min)
   - Regenerate if needed
   - Validate on client

2. **Rate Limiting**
   - Limit AR message requests per user
   - Prevent abuse

3. **Authentication**
   - Verify user has access to room
   - Validate agent ownership

---

## Performance Considerations

1. **Latency Targets**
   - AI Response: < 2s
   - TTS Generation: < 3s
   - Movement Generation: < 2s
   - Total: < 7s (acceptable for Phase 1)

2. **Optimization Strategies**
   - Pre-generate common responses
   - Cache movement patterns
   - Use CDN for voice files
   - Compress movement JSON

---

## Testing Strategy

1. **Unit Tests**
   - Room model with AR flag
   - Event serialization/deserialization
   - Movement JSON generation

2. **Integration Tests**
   - End-to-end AR message flow
   - Error scenarios
   - Concurrent requests

3. **Load Tests**
   - Multiple AR rooms
   - High message rate
   - Azure Storage performance

---

## Next Steps

1. ✅ Review and approve design
2. ✅ Implement Room model changes
3. ✅ Create AR Animation Service
4. ✅ Enhance AI Gateway for AR
5. ✅ Update Realtime Gateway
6. ✅ Client implementation
7. ✅ Testing and optimization

---

## Open Questions to Resolve

1. **Movement Generation**
   - [ ] Which service generates movements?
   - [ ] What format (JSON, GLTF, etc.)?
   - [ ] How detailed (keyframes, full animation)?

2. **Voice Quality**
   - [ ] Which TTS provider? (Azure, Google, ElevenLabs)
   - [ ] Voice cloning for agents?
   - [ ] Multiple languages?

3. **Real-time vs. Pre-generated**
   - [ ] Phase 1: Pre-generated (agreed)
   - [ ] Phase 2: Streaming (to be designed)

4. **Interruption Handling**
   - [ ] How to cancel in-flight requests?
   - [ ] Queue management strategy?

5. **Cost Optimization**
   - [ ] Cache strategy?
   - [ ] CDN for voice files?
   - [ ] Compression for movements?

---

## Conclusion

Your proposed approach is solid for Phase 1. The main recommendations:

1. **Start with boolean flag** (simple, can migrate later)
2. **Add AR Animation Service** (better separation of concerns)
3. **Use event-driven architecture** (already in place)
4. **Plan for streaming in Phase 2** (design with future in mind)

The design balances simplicity (Phase 1) with extensibility (Phase 2+).

