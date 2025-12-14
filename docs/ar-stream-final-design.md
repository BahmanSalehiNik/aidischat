# AR Stream - Final Design Document

## Overview
**Streaming AR Chat**: Real-time AR conversations between users and their agents, with streaming text, client-side TTS, and animations. The 3D agent model appears in AR space, responding with emotions and gestures in real-time.

**Key Architecture:**
- **Backend**: Streams text with emotion/movement markers only (no audio/animations)
- **Client**: Calls TTS provider directly (ElevenLabs, Azure Speech, etc.)
- **Client**: Calls animation/viseme provider directly
- **Backend**: Manages auth tokens for providers, handles security
- **AR Experience**: Actual 3D model rendered in AR space (not just preview)

---

## UI Flow & Entry Point

### Agent Detail Page - "Video Chat" Button

**Location**: `client/mobile-app/app/(main)/AgentDetailScreen.tsx`

**Button Placement**: 
- Add a prominent "Video Chat" button in the Action Buttons section
- Positioned alongside "View 3D Model" button
- Only visible when agent has a ready 3D model (`avatarStatus === 'ready'`)

**Button Design**:
```typescript
<TouchableOpacity
  style={styles.videoChatButton}
  onPress={handleVideoChat}
  disabled={avatarStatus !== 'ready'}
>
  <Ionicons name="videocam" size={24} color="#FFFFFF" />
  <Text style={styles.videoChatButtonText}>Video Chat</Text>
</TouchableOpacity>
```

**Flow**:
1. User clicks "Video Chat" on Agent Detail Page
2. Client calls `POST /api/rooms` with `type='ar'` to create/get AR room
3. Client navigates to AR Chat Screen (new screen)
4. AR Chat Screen:
   - Requests provider tokens
   - Connects to WebSocket for streaming
   - Renders 3D model in AR space
   - Shows text input for user messages
   - Displays agent responses with real-time animations

---

## 3D Model Colors & Rendering

### Current State
- **Preview**: Fast loading but no colors (grayscale/monochrome)
- **AR Mode**: Should display with full colors and textures

### Requirements

**1. Color Support in AR Mode:**
- Load full-color GLB/GLTF models in AR
- Apply textures and materials from the model
- Support PBR (Physically Based Rendering) materials
- Maintain performance (optimize textures if needed)

**2. Model Loading Strategy:**
```typescript
// Preview (fast, no colors)
const previewModel = await loadModel(modelUrl, {
  loadTextures: false,
  loadMaterials: false,
  optimize: true,
});

// AR Mode (full quality, with colors)
const arModel = await loadModel(modelUrl, {
  loadTextures: true,
  loadMaterials: true,
  enablePBR: true,
});
```

**3. Color Enhancement:**
- If model lacks colors, apply default material colors
- Support agent-specific color schemes (from agent profile)
- Allow dynamic color changes based on emotions

**4. Performance Optimization:**
- Use texture compression (KTX2, Basis Universal)
- LOD (Level of Detail) for distant models
- Cache loaded models in memory

---

## Privacy & Room Visibility

### AR Rooms Are Private

**Key Rule**: AR rooms are **NOT** displayed in the regular chat rooms list.

**Architecture Pattern: Linked Services (Like Teams/Zoom)**

Based on how major apps handle this (Teams, Zoom, Discord), we use a **Linked Services** pattern:

1. **Room Service** (existing): Manages all rooms, including AR rooms
   - Room has `type: 'chat' | 'ar' | 'group'`
   - Room has `capabilities: ['chat', 'ar']` (can have both in future)
   - AR rooms have `type: 'ar'` and `capabilities: ['ar']`

2. **Chat Service** (existing): Handles regular chat messages
   - Only processes rooms with `capabilities.includes('chat')`

3. **AR Conversations Service** (new): Handles AR-specific logic
   - Only processes rooms with `capabilities.includes('ar')`
   - Manages AR messages, streaming, tokens

4. **Room Service** links them:
   - `GET /api/rooms` returns all rooms (filters AR by default: `?excludeAR=true`)
   - `GET /api/rooms/:id` returns room with capabilities
   - Client decides which service to use based on capabilities

**Why This Pattern?**
- ✅ **Unified room concept** (like Teams - user sees "rooms" in one place)
- ✅ **Separate services** for different logic (like Teams backend - chat vs video services)
- ✅ **Privacy guarantee** (filtering at room service level)
- ✅ **Future-proof** (can add rooms with both capabilities)

**See**: `docs/ar-service-architecture-real-world-analysis.md` for detailed comparison with Teams, FaceTime, Discord, etc.

**Implementation:**
1. **Room Service Enhancement**: Add `type` and `capabilities` fields to Room model
2. **AR Rooms**: Stored in same Room collection, but with `type: 'ar'`
3. **Filtering**: Room Service filters AR rooms from regular listings (`GET /api/rooms?excludeAR=true`)
4. **AR Conversations Service**: Handles AR-specific logic (messages, streaming, tokens)
5. **Direct Access**: AR rooms accessible via:
   - Direct room ID (from agent detail page)
   - Agent ID lookup (user's AR room with specific agent)

**Future Consideration:**
- All private chats (not just AR) may follow this pattern
- Private chats start by creating room + sending invitations
- Regular chat rooms remain public/visible
- This will be discussed and designed separately

---

## Required Services

### 1. **Room Service** (Existing - Enhance)
**Responsibilities:**
- Manage all rooms (including AR rooms)
- Add `type: 'chat' | 'ar' | 'group'` field
- Add `capabilities: string[]` field (e.g., `['chat']`, `['ar']`, `['chat', 'ar']`)
- Filter AR rooms from regular listings (`GET /api/rooms?excludeAR=true`)

**Enhancements:**
- Add `type` and `capabilities` to Room model
- Update room creation to support AR rooms
- Filter AR rooms from `GET /api/rooms` by default

### 2. **AR Conversations Service** (New)
**Responsibilities:**
- Handle AR-specific logic (does NOT manage rooms - Room Service does)
- Handle AR message creation requests
- Store AR messages (text, markers, status)
- Publish `ARMessageRequestEvent` to trigger AI streaming
- **Provide auth tokens** for TTS/animation providers (signed, time-limited)
- Manage WebSocket connections for streaming text

**Key Endpoints:**
- `POST /api/ar-rooms/:roomId/messages` - Send message (triggers streaming)
- `GET /api/ar-rooms/:roomId/messages` - Get message history
- `GET /api/ar-rooms/:roomId/provider-tokens` - Get signed tokens for TTS/animation providers
- `WebSocket /ws/ar-rooms/:roomId` - Stream text chunks with markers

**Note**: Room creation handled by Room Service, AR-specific logic handled here.

**Data Models:**

**Room Model (Room Service):**
```typescript
// Room (enhanced to support AR)
{
  id: string;
  type: 'chat' | 'ar' | 'group';
  capabilities: string[]; // ['chat'], ['ar'], or ['chat', 'ar']
  name?: string;
  createdBy: string;
  visibility: 'private' | 'public' | 'invite';
  // For AR rooms, additional fields:
  agentId?: string; // Only for AR rooms
  status?: 'active' | 'paused' | 'ended'; // Only for AR rooms
  createdAt: Date;
  lastActivityAt?: Date; // Only for AR rooms
}
```

**AR Message Model (AR Conversations Service):**
```typescript
// AR Message (stored in AR Conversations Service)
{
  id: string;
  roomId: string; // References Room.id from Room Service
  senderId: string;
  senderType: 'human' | 'agent';
  content: string; // Text with markers
  markers: Array<{ type: string; value: string }>; // Extracted markers
  status: 'streaming' | 'completed' | 'failed';
  createdAt: Date;
}
```

**Note**: AR rooms are stored in Room Service (same collection as chat rooms), but AR messages are stored in AR Conversations Service (separate collection).

---

### 3. **AI Gateway** (Existing - Enhance)
**Responsibilities:**
- Receive `ARMessageRequestEvent`
- **Stream** AI response with emotion/movement markers (e.g., `[emotion:happy]Hello! [gesture:wave]`)
- Publish `ARStreamChunkEvent` to Kafka for each text chunk
- Publish `ARStreamStartEvent` and `ARStreamEndEvent`

**Enhancements:**
- **Streaming support** (not REST, use async generators/streams)
- Add marker injection to AI prompts
- Stream chunks as they're generated (not wait for complete response)

**Technology:**
- OpenAI streaming API: `stream: true`
- Anthropic streaming API: `stream: true`
- Publish chunks to Kafka topic: `ar.stream.chunk`

**Marker Format:**
```
[emotion:happy]Hello! [gesture:wave]How are you? [emotion:thoughtful]Let me think...
```

**Supported Markers:**
- `[emotion:<type>]` - Changes emotion/expression (happy, sad, angry, calm, excited, thoughtful, etc.)
- `[gesture:<type>]` - Triggers gesture animation (wave, nod, shake_head, point, etc.)
- `[pose:<type>]` - Changes body pose (idle, talking, listening, thinking)
- `[tone:<type>]` - Changes voice tone (neutral, excited, calm, serious, friendly)

---

### 4. **Realtime Gateway** (Existing - Enhance)
**Responsibilities:**
- Consume `ARStreamChunkEvent` from Kafka (one pod consumes)
- Publish to Redis channel: `ar-room:${roomId}`
- Redis broadcasts to all Gateway pods
- Each pod sends to WebSocket clients in that room

**Enhancements:**
- Add listener for `ARStreamChunkEvent`
- Add Redis channel: `ar-room:${roomId}` (separate from regular `room:${roomId}`)
- Forward stream chunks to WebSocket clients

**Flow:**
```
Kafka ARStreamChunkEvent (one pod)
  → Redis pub/sub: ar-room:${roomId} (all pods)
    → WebSocket send to clients (each pod)
```

---

### 5. **Token Management** (Part of AR Conversations Service)
**Responsibilities:**
- Generate signed, time-limited tokens for TTS providers (ElevenLabs, Azure Speech)
- Generate signed, time-limited tokens for animation/viseme providers
- Validate tokens on backend (if providers support webhook validation)
- Rotate tokens periodically

**Token Format:**
```json
{
  "ttsProvider": "elevenlabs",
  "apiKey": "encrypted-api-key",
  "expiresAt": "2024-12-14T21:00:00Z",
  "allowedEndpoints": ["/v1/text-to-speech/*/stream"],
  "signature": "hmac-sha256-signature"
}
```

**Security:**
- Tokens expire after 1 hour (configurable)
- Tokens limited to specific endpoints
- Rate limiting per token
- Token rotation every 30 minutes

---

## Event Flow (Streaming)

```
User clicks "Video Chat" on Agent Detail Page
  ↓
Client: POST /api/rooms (create/get AR room with type='ar')
  ↓
Room Service: Creates/returns room with type='ar', capabilities=['ar']
  ↓
Client: GET /api/ar-rooms/:roomId/provider-tokens
  ↓
AR Conversations Service: Returns provider tokens
  ↓
Client: Connects to WebSocket /ws/ar-rooms/:roomId
  ↓
User sends message (text input)
  ↓
Client: POST /api/ar-rooms/:roomId/messages
  ↓
AR Conversations Service: Publishes ARMessageRequestEvent
  ↓
AI Gateway: Receives event, streams response with markers
  ↓
AI Gateway: Publishes ARStreamChunkEvent (Kafka) for each chunk
  ↓
Realtime Gateway: Consumes chunk (one pod)
  ↓
Realtime Gateway: Publishes to Redis channel ar-room:${roomId}
  ↓
Redis: Broadcasts to all Gateway pods
  ↓
Realtime Gateway: Sends to WebSocket clients (each pod)
  ↓
Client: Receives text chunk with markers
  ↓
Client: Parses markers, extracts text
  ↓
Client: Calls TTS provider directly (with backend token)
  ↓
TTS Provider: Streams audio to client
  ↓
Client: Calls animation provider directly (with backend token)
  ↓
Animation Provider: Streams visemes/movements to client
  ↓
Client: Synchronizes audio + animations + 3D model in AR space
```

---

## Client-Side Implementation

### 1. **Get Provider Tokens** (Before Streaming)
```typescript
// Client requests tokens from backend
const response = await fetch(`/api/ar-rooms/${roomId}/provider-tokens`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { ttsToken, animationToken } = await response.json();
```

### 2. **WebSocket Connection**
```typescript
const ws = new WebSocket(`ws://api.example.com/ws/ar-rooms/${roomId}?token=${jwt}`);

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'ar-stream-chunk') {
    handleStreamChunk(message);
  } else if (message.type === 'ar-stream-start') {
    handleStreamStart(message);
  } else if (message.type === 'ar-stream-end') {
    handleStreamEnd(message);
  }
});
```

### 3. **Process Stream Chunk**
```typescript
async function handleStreamChunk(chunk: ARStreamChunk) {
  // Parse markers from text
  const { text, markers } = parseMarkers(chunk.chunk);
  
  // Apply markers to 3D model
  markers.forEach(marker => {
    if (marker.type === 'emotion') {
      updateModelEmotion(marker.value);
    } else if (marker.type === 'gesture') {
      triggerGesture(marker.value);
    } else if (marker.type === 'pose') {
      changePose(marker.value);
    }
  });
  
  // Call TTS provider directly
  const audioStream = await elevenlabs.stream(text, {
    apiKey: ttsToken,
    voiceId: agent.voiceId,
    tone: getToneFromMarkers(markers),
  });
  
  // Call animation provider directly
  const animationStream = await animationProvider.getVisemes(text, markers, {
    apiKey: animationToken,
  });
  
  // Play audio + animations synchronously
  playAudio(audioStream);
  applyAnimations(animationStream);
  update3DModel(animationStream);
}
```

### 4. **3D Model Rendering in AR**
```typescript
// Load full-color model for AR
const arModel = await loadGLBModel(agent.modelUrl, {
  loadTextures: true,
  loadMaterials: true,
  enablePBR: true,
});

// Render in AR space
renderer.render(arModel, arCamera);

// Update based on markers
function updateModelEmotion(emotion: string) {
  // Update blend shapes for facial expression
  arModel.morphTargetInfluences = getBlendShapesForEmotion(emotion);
}

function triggerGesture(gesture: string) {
  // Play gesture animation
  const animation = arModel.animations.find(a => a.name === `gesture_${gesture}`);
  animationMixer.clipAction(animation).play();
}
```

---

## Marker Parsing

### Marker Syntax
```
[emotion:happy]Hello! [gesture:wave]How are you?
[emotion:thoughtful,pose:thinking]Let me think...
[tone:excited,emotion:happy]That's great!
```

### Parser Implementation
```typescript
interface Marker {
  type: 'emotion' | 'gesture' | 'pose' | 'tone';
  value: string;
}

function parseMarkers(text: string): { text: string; markers: Marker[] } {
  const markers: Marker[] = [];
  let cleanText = text;
  
  // Match [type:value] or [type1:value1,type2:value2]
  const markerRegex = /\[([^\]]+)\]/g;
  
  cleanText = text.replace(markerRegex, (match, content) => {
    // Parse comma-separated markers
    const parts = content.split(',');
    parts.forEach(part => {
      const [type, value] = part.split(':');
      if (type && value) {
        markers.push({ type: type.trim(), value: value.trim() });
      }
    });
    return ''; // Remove marker from text
  });
  
  return { text: cleanText.trim(), markers };
}
```

---

## Kafka Events

### ARMessageRequestEvent
```typescript
{
  subject: 'ar.message.request',
  data: {
    messageId: string;
    roomId: string; // References Room.id from Room Service
    agentId: string;
    userId: string;
    content: string; // User's message
    timestamp: string;
  }
}
```

### ARStreamStartEvent
```typescript
{
  subject: 'ar.stream.start',
  data: {
    streamId: string;
    messageId: string;
    roomId: string; // References Room.id from Room Service
    agentId: string;
    userId: string;
    startedAt: string;
  }
}
```

### ARStreamChunkEvent
```typescript
{
  subject: 'ar.stream.chunk',
  data: {
    streamId: string;
    messageId: string;
    roomId: string; // References Room.id from Room Service
    chunk: string; // Text chunk with markers
    chunkIndex: number;
    timestamp: string;
    isFinal: boolean;
  }
}
```

### ARStreamEndEvent
```typescript
{
  subject: 'ar.stream.end',
  data: {
    streamId: string;
    messageId: string;
    roomId: string; // References Room.id from Room Service
    totalChunks: number;
    endedAt: string;
  }
}
```

---

## Key Decisions

1. **Linked Services Pattern**: Room Service manages rooms, AR Conversations Service handles AR logic (like Teams/Zoom)
2. **Streaming-first**: AI Gateway streams text, not REST
3. **Client-side TTS/Animations**: Client calls providers directly
4. **Backend token management**: Backend provides signed tokens, client uses them
5. **Realtime Gateway**: Uses existing Redis pub/sub pattern for streaming
6. **No audio/animations in backend**: Backend never processes or stores audio/animations
7. **Unified room concept**: AR rooms in same Room Service, but filtered from listings
8. **1-on-1 only**: Phase 1 limited to user + their agent
9. **AR Entry Point**: "Video Chat" button on Agent Detail Page
10. **3D Model Colors**: Full-color rendering in AR mode (not preview)
11. **Private Rooms**: AR rooms excluded from chat room listings (filtered at Room Service)

---

## Security Considerations

1. **Token Expiration**: Tokens expire after 1 hour (configurable)
2. **Token Scope**: Tokens limited to specific endpoints
3. **Rate Limiting**: Backend tracks token usage, enforces rate limits
4. **Token Rotation**: Tokens rotated periodically
5. **Webhook Validation**: If providers support it, validate tokens on backend
6. **JWT Authentication**: WebSocket connections require valid JWT
7. **Room Access Control**: Users can only access their own AR rooms

---

## Implementation Phases

### Phase 1: Foundation
1. Create AR Conversations Service structure
2. Add "Video Chat" button to Agent Detail Page
3. Implement AR room creation/management
4. Enhance AI Gateway for streaming with markers
5. Add AR stream event listeners to Realtime Gateway

### Phase 2: Client Integration
6. Create AR Chat Screen component
7. Implement WebSocket connection for streaming
8. Add marker parsing logic
9. Integrate TTS provider (ElevenLabs or Web Speech API)
10. Integrate animation provider

### Phase 3: 3D Model & AR
11. Enhance 3D model loading with colors/textures
12. Implement AR rendering (ARKit/ARCore)
13. Add emotion/gesture animations to 3D model
14. Synchronize audio + animations + 3D model

### Phase 4: Polish
15. Error handling and retry logic
16. Interruption handling (user can interrupt agent)
17. Performance optimization
18. Testing and bug fixes

---

## Open Questions

1. **Animation Provider**: Which service provides visemes/movements? (Custom service or third-party?)
2. **TTS Provider**: Start with Web Speech API (free) or ElevenLabs (premium)?
3. **Model Format**: GLB with embedded animations or separate animation files?
4. **Marker Reliability**: How reliable is AI at generating markers? (May need post-processing)
5. **Offline Support**: Can AR chat work offline? (Probably not for Phase 1)

---

## Next Steps

1. ✅ **Approve final design**
2. Create AR Conversations Service structure
3. Add "Video Chat" button to Agent Detail Page
4. Enhance AI Gateway for streaming
5. Implement marker parsing
6. Set up token management
7. Create AR Chat Screen
8. Integrate TTS and animation providers

