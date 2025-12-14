# AR Conversations - Services Summary (Streaming Architecture)

## Overview
**Streaming AR Chat**: User sends text → AI Gateway streams text with emotion/movement markers → Client receives stream → Client calls TTS/animation providers directly → Real-time conversation.

**Key Architecture Decision:**
- **Backend**: Streams text with markers only (no audio/animations)
- **Client**: Calls TTS provider directly (ElevenLabs, Azure Speech, etc.)
- **Client**: Calls animation/viseme provider directly
- **Backend**: Manages auth tokens for providers, handles security

---

## Required Services

### 1. **AR Conversations Service** (New)
**Responsibilities:**
- Manage AR rooms (private, 1-on-1, not listed in chat)
- Handle AR message creation requests
- Store AR messages (text, markers, status)
- Publish `ARMessageRequestEvent` to trigger AI streaming
- **Provide auth tokens** for TTS/animation providers (signed, time-limited)
- Manage WebSocket connections for streaming text

**Key Endpoints:**
- `POST /api/ar-rooms` - Create AR room
- `POST /api/ar-rooms/:roomId/messages` - Send message (triggers streaming)
- `GET /api/ar-rooms/:roomId/messages` - Get message history
- `GET /api/ar-rooms/:roomId/provider-tokens` - Get signed tokens for TTS/animation providers
- `WebSocket /ws/ar-rooms/:roomId` - Stream text chunks with markers

---

### 2. **AI Gateway** (Existing - Enhance)
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

---

### 3. **Realtime Gateway** (Existing - Enhance)
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

### 4. **Token Management Service** (New - or part of AR Conversations Service)
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

---

## Event Flow (Streaming)

```
User → AR Conversations Service
  → Publishes ARMessageRequestEvent
    → AI Gateway (streams text + markers)
      → Publishes ARStreamChunkEvent (Kafka)
        → Realtime Gateway (consumes, publishes to Redis)
          → Redis pub/sub broadcasts to all Gateway pods
            → WebSocket sends to client
              → Client receives text chunk with markers
                → Client calls TTS provider directly (with backend token)
                  → TTS provider streams audio to client
                → Client calls animation provider directly (with backend token)
                  → Animation provider streams visemes/movements to client
                → Client synchronizes audio + animations + 3D model
```

---

## Client-Side Flow

### 1. **Get Provider Tokens** (Before Streaming)
```typescript
// Client requests tokens from backend
const tokens = await fetch(`/api/ar-rooms/${roomId}/provider-tokens`);
// Returns: { ttsToken: "...", animationToken: "..." }
```

### 2. **Receive Text Stream** (WebSocket)
```typescript
// Client receives text chunks via WebSocket
ws.on('message', (data) => {
  const chunk = JSON.parse(data);
  // { type: 'ar-stream-chunk', chunk: '[emotion:happy]Hello!', chunkIndex: 0 }
  
  // Parse markers
  const { text, markers } = parseMarkers(chunk.chunk);
  
  // Call TTS provider directly
  const audioStream = await elevenlabs.stream(text, {
    apiKey: tokens.ttsToken,
    voiceId: agent.voiceId,
  });
  
  // Call animation provider directly
  const animationStream = await animationProvider.getVisemes(text, markers, {
    apiKey: tokens.animationToken,
  });
  
  // Play audio + animations synchronously
  playAudio(audioStream);
  applyAnimations(animationStream);
});
```

### 3. **Backend Never Sees Audio/Animations**
- Backend only streams text
- Client handles all TTS/animation processing
- Backend manages tokens/auth only

---

## Data Models

### AR Room
- `id`, `agentId`, `userId`, `status`, `createdAt`

### AR Message
- `id`, `arRoomId`, `senderId`, `content` (text), `markers` (array), `status` (streaming/completed/failed), `createdAt`
- **Note**: No `audioUrl` or `animationUrl` (handled client-side)

---

## Key Decisions

1. **Streaming-first**: AI Gateway streams text, not REST
2. **Client-side TTS/Animations**: Client calls providers directly
3. **Backend token management**: Backend provides signed tokens, client uses them
4. **Realtime Gateway**: Uses existing Redis pub/sub pattern for streaming
5. **No audio/animations in backend**: Backend never processes or stores audio/animations
6. **Separate from chat**: AR rooms not visible in regular chat UI
7. **1-on-1 only**: Phase 1 limited to user + their agent

---

## Security Considerations

1. **Token Expiration**: Tokens expire after 1 hour (configurable)
2. **Token Scope**: Tokens limited to specific endpoints (e.g., only `/v1/text-to-speech/*/stream`)
3. **Rate Limiting**: Backend tracks token usage, enforces rate limits
4. **Token Rotation**: Tokens rotated periodically
5. **Webhook Validation**: If providers support it, validate tokens on backend

