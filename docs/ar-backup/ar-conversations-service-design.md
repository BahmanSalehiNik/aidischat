# AR Conversations Service - Design Document

## Overview
This document outlines the design for a dedicated AR Conversations Service that handles private 1-on-1 AR conversations between users and their agents, with streaming real-time text, TTS, and animations.

## Key Design Principles

1. **Separate Service**: AR conversations are handled by a dedicated service, separate from regular chat
2. **Private Rooms**: AR rooms are private, not listed in chat page
3. **1-on-1 Only (Phase 1)**: One user, one agent per AR room
4. **Agent-Centric**: Accessible from agent detail page via "Video Chat" button
5. **Streaming First**: Real-time streaming with emotion/movement markers
6. **Client-Side Processing**: TTS and animations handled on client

---

## Architecture Overview

### Service Structure

```
ar-conversations/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── models/
│   │   ├── ar-room.ts             # AR Room model (separate from chat rooms)
│   │   └── ar-message.ts          # AR Message model
│   ├── routes/
│   │   ├── ar-rooms.ts            # AR room management
│   │   ├── ar-messages.ts         # AR message handling
│   │   └── ar-stream.ts           # WebSocket streaming endpoint
│   ├── services/
│   │   ├── stream-manager.ts      # Manages active streams
│   │   └── room-service.ts        # AR room business logic
│   ├── events/
│   │   ├── listeners/
│   │   │   ├── ar-stream-chunk-listener.ts
│   │   │   └── agent-updated-listener.ts
│   │   └── publishers/
│   │       ├── ar-stream-start-publisher.ts
│   │       └── ar-stream-interrupt-publisher.ts
│   ├── websocket/
│   │   ├── ar-websocket-server.ts # WebSocket server for streaming
│   │   └── connection-manager.ts  # Manages WebSocket connections
│   └── kafka-client.ts
├── package.json
└── Dockerfile
```

---

## 1. AR Room Model

### Database Schema

```typescript
// backEnd/ar-conversations/src/models/ar-room.ts

export interface ARRoomAttrs {
  id: string;
  userId: string;        // Owner of the room
  agentId: string;       // Agent in the room
  status: 'active' | 'paused' | 'ended';
  createdAt: Date;
  lastActivityAt: Date;
  endedAt?: Date;
}

const arRoomSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  agentId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'ended'], 
    default: 'active' 
  },
  createdAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
}, {
  toJSON: {
    transform(_doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
    }
  }
});

// Compound index: one active room per user-agent pair
arRoomSchema.index({ userId: 1, agentId: 1, status: 1 }, { 
  unique: true,
  partialFilterExpression: { status: 'active' }
});
```

**Key Features:**
- ✅ Separate from chat rooms (different collection)
- ✅ One active room per user-agent pair (enforced by unique index)
- ✅ Not listed in regular chat rooms
- ✅ Private by design

---

## 2. API Endpoints

### Create AR Room

**POST /api/ar-conversations/rooms**
```typescript
// Creates or resumes AR room for user and agent
// If active room exists, returns it
// If ended room exists, creates new one

Request:
{
  agentId: string;
}

Response:
{
  id: string;
  userId: string;
  agentId: string;
  status: 'active';
  createdAt: string;
  lastActivityAt: string;
}
```

**Implementation:**
```typescript
router.post('/api/ar-conversations/rooms', extractJWTPayload, loginRequired, async (req, res) => {
  const { agentId } = req.body;
  const userId = req.jwtPayload!.id;

  // Check if active room exists
  let room = await ARRoom.findOne({
    userId,
    agentId,
    status: 'active'
  });

  if (room) {
    // Resume existing room
    room.lastActivityAt = new Date();
    await room.save();
    return res.json(room);
  }

  // Create new room
  room = ARRoom.build({
    id: crypto.randomUUID(),
    userId,
    agentId,
    status: 'active',
  });
  await room.save();

  // Publish AR room created event (optional, for analytics)
  await new ARRoomCreatedPublisher(kafkaWrapper.producer).publish({
    id: room.id,
    userId: room.userId,
    agentId: room.agentId,
    createdAt: room.createdAt.toISOString(),
  });

  res.status(201).json(room);
});
```

### Get AR Room

**GET /api/ar-conversations/rooms/:roomId**
```typescript
// Get AR room details
// Only accessible by room owner

Response:
{
  id: string;
  userId: string;
  agentId: string;
  status: 'active' | 'paused' | 'ended';
  createdAt: string;
  lastActivityAt: string;
  agent: {
    id: string;
    name: string;
    avatarUrl?: string;
  }
}
```

### List User's AR Rooms

**GET /api/ar-conversations/rooms**
```typescript
// List all AR rooms for current user
// Only active rooms (for resuming conversations)

Response:
{
  rooms: [
    {
      id: string;
      agentId: string;
      agentName: string;
      lastActivityAt: string;
      status: 'active';
    }
  ]
}
```

### End AR Room

**POST /api/ar-conversations/rooms/:roomId/end**
```typescript
// End AR conversation
// Sets status to 'ended', closes WebSocket connections

Response:
{
  id: string;
  status: 'ended';
  endedAt: string;
}
```

---

## 3. WebSocket Streaming Endpoint

### Connection

**WebSocket: ws://ar-conversations-srv:3000/ar-stream**

**Connection Parameters:**
- `roomId`: AR room ID
- `token`: JWT token (for authentication)

**Example:**
```
ws://ar-conversations-srv:3000/ar-stream?roomId=room-123&token=eyJ...
```

### Client → Server Messages

#### Join AR Room
```json
{
  "type": "join-ar-room",
  "roomId": "room-123"
}
```

#### Send Message
```json
{
  "type": "ar-message",
  "roomId": "room-123",
  "content": "Hello, how are you?"
}
```

#### Interrupt Stream
```json
{
  "type": "interrupt-stream",
  "streamId": "stream-123"
}
```

#### Pause/Resume
```json
{
  "type": "pause-room"
}
// or
{
  "type": "resume-room"
}
```

### Server → Client Messages

#### Stream Start
```json
{
  "type": "ar-stream-start",
  "streamId": "stream-123",
  "messageId": "msg-456",
  "agentId": "agent-789",
  "startedAt": "2024-12-14T20:00:00Z"
}
```

#### Stream Chunk
```json
{
  "type": "ar-stream-chunk",
  "streamId": "stream-123",
  "chunk": "[emotion:happy]Hello! [gesture:wave]How are you?",
  "chunkIndex": 0,
  "timestamp": "2024-12-14T20:00:01Z",
  "isFinal": false
}
```

#### Stream End
```json
{
  "type": "ar-stream-end",
  "streamId": "stream-123",
  "totalChunks": 15,
  "endedAt": "2024-12-14T20:00:05Z"
}
```

#### Stream Error
```json
{
  "type": "ar-stream-error",
  "streamId": "stream-123",
  "error": "AI provider timeout",
  "timestamp": "2024-12-14T20:00:03Z"
}
```

---

## 4. Message Flow

### User Sends Message

```
1. Client → WebSocket: { type: "ar-message", content: "Hello" }
2. AR Service → Creates message in DB
3. AR Service → Publishes ARMessageRequestEvent to Kafka
4. AI Gateway → Receives event, streams response with markers
5. AI Gateway → Publishes ARStreamChunkEvent for each chunk
6. AR Service → Receives chunks, forwards via WebSocket
7. Client → Parses markers, renders TTS + animations
```

### Detailed Flow

**Step 1: User Sends Message**
```typescript
// Client sends via WebSocket
ws.send(JSON.stringify({
  type: 'ar-message',
  roomId: 'room-123',
  content: 'Hello, how are you?'
}));
```

**Step 2: AR Service Processes**
```typescript
// AR Service receives WebSocket message
async function handleARMessage(ws, message) {
  const { roomId, content } = message;
  
  // Validate room access
  const room = await ARRoom.findById(roomId);
  if (!room || room.userId !== ws.userId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
    return;
  }
  
  // Create message record
  const arMessage = ARMessage.build({
    id: crypto.randomUUID(),
    roomId,
    senderId: ws.userId,
    senderType: 'human',
    content,
  });
  await arMessage.save();
  
  // Update room activity
  room.lastActivityAt = new Date();
  await room.save();
  
  // Publish AR message request event
  await new ARMessageRequestPublisher(kafkaWrapper.producer).publish({
    messageId: arMessage.id,
    roomId,
    agentId: room.agentId,
    userId: ws.userId,
    content,
    timestamp: new Date().toISOString(),
  });
}
```

**Step 3: AI Gateway Streams Response**
```typescript
// AI Gateway receives ARMessageRequestEvent
async function handleARMessageRequest(event) {
  const { messageId, roomId, agentId, content } = event.data;
  
  // Get agent profile
  const agentProfile = await AgentProfile.findById(agentId);
  
  // Generate stream ID
  const streamId = `stream-${messageId}`;
  
  // Publish stream start
  await publishARStreamStart(streamId, messageId, roomId, agentId);
  
  // Stream AI response with markers
  const stream = await provider.streamResponse({
    message: content,
    systemPrompt: agentProfile.systemPrompt,
    modelName: agentProfile.modelName,
    // Add marker injection prompt
    markerPrompt: 'Use emotion and gesture markers like [emotion:happy] or [gesture:wave]',
  });
  
  let chunkIndex = 0;
  for await (const chunk of stream) {
    // Publish each chunk
    await publishARStreamChunk(streamId, messageId, roomId, chunk, chunkIndex);
    chunkIndex++;
  }
  
  // Publish stream end
  await publishARStreamEnd(streamId, messageId, roomId, chunkIndex);
}
```

**Step 4: AR Service Forwards to Client**
```typescript
// AR Service receives ARStreamChunkEvent
async function handleARStreamChunk(event) {
  const { streamId, roomId, chunk } = event.data;
  
  // Find WebSocket connections for this room
  const connections = connectionManager.getConnectionsForRoom(roomId);
  
  // Forward to all connections
  connections.forEach(ws => {
    ws.send(JSON.stringify({
      type: 'ar-stream-chunk',
      streamId,
      chunk,
      chunkIndex: event.data.chunkIndex,
      timestamp: event.data.timestamp,
    }));
  });
}
```

**Step 5: Client Processes**
```typescript
// Client receives chunk
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.type === 'ar-stream-chunk') {
    const { chunk } = message;
    
    // Parse markers
    const { text, markers } = parseChunk(chunk);
    
    // Apply markers
    markers.forEach(marker => {
      if (marker.emotion) {
        model3D.setEmotion(marker.emotion);
      }
      if (marker.gesture) {
        model3D.playGesture(marker.gesture);
      }
      if (marker.tone) {
        tts.setTone(marker.tone);
      }
    });
    
    // Speak text
    tts.speak(text);
  }
});
```

---

## 5. Integration with Agent Detail Page

### Client-Side Integration

**Agent Detail Screen:**
```typescript
// client/mobile-app/app/(main)/AgentDetailScreen.tsx

const AgentDetailScreen = ({ agentId }) => {
  const [arRoom, setArRoom] = useState<ARRoom | null>(null);
  
  const startARConversation = async () => {
    try {
      // Create or get AR room
      const room = await arConversationsApi.createRoom(agentId);
      setArRoom(room);
      
      // Navigate to AR conversation screen
      router.push(`/ar-conversation/${room.id}`);
    } catch (error) {
      console.error('Failed to start AR conversation:', error);
    }
  };
  
  const resumeARConversation = async () => {
    // Get existing active room
    const rooms = await arConversationsApi.getRooms();
    const room = rooms.find(r => r.agentId === agentId && r.status === 'active');
    
    if (room) {
      router.push(`/ar-conversation/${room.id}`);
    } else {
      await startARConversation();
    }
  };
  
  return (
    <View>
      {/* Agent details */}
      
      {/* AR Conversation Button */}
      <Button 
        title="Video Chat" 
        onPress={resumeARConversation}
        icon="video-camera"
      />
    </View>
  );
};
```

### AR Conversation Screen

**New Screen: `/ar-conversation/[roomId]`**
```typescript
// client/mobile-app/app/(main)/ar-conversation/[roomId].tsx

const ARConversationScreen = ({ roomId }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [model3D, setModel3D] = useState<THREE.Object3D | null>(null);
  const [tts, setTTS] = useState<TTSController | null>(null);
  
  useEffect(() => {
    // Connect to AR Streaming Service WebSocket
    const websocket = new WebSocket(
      `ws://ar-conversations-srv:3000/ar-stream?roomId=${roomId}&token=${token}`
    );
    
    websocket.onopen = () => {
      websocket.send(JSON.stringify({ type: 'join-ar-room', roomId }));
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleARMessage(message);
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [roomId]);
  
  const handleARMessage = (message: any) => {
    if (message.type === 'ar-stream-chunk') {
      // Parse and process chunk
      const { text, markers } = parseChunk(message.chunk);
      
      // Update 3D model
      markers.forEach(m => {
        if (m.emotion) model3D.setEmotion(m.emotion);
        if (m.gesture) model3D.playGesture(m.gesture);
      });
      
      // Speak text
      tts.speak(text, markers.find(m => m.tone)?.tone);
    }
  };
  
  const sendMessage = (content: string) => {
    ws?.send(JSON.stringify({
      type: 'ar-message',
      roomId,
      content,
    }));
  };
  
  return (
    <View style={styles.container}>
      {/* 3D Model Viewer */}
      <ARViewer 
        modelUrl={agent.avatarUrl}
        onModelReady={setModel3D}
      />
      
      {/* Text Input */}
      <TextInput
        placeholder="Type your message..."
        onSubmitEditing={(e) => sendMessage(e.nativeEvent.text)}
      />
    </View>
  );
};
```

---

## 6. Event Definitions

### AR Message Request Event
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
```

### AR Stream Start Event
```typescript
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
```

### AR Stream Chunk Event
```typescript
export interface ARStreamChunkEvent {
  subject: Subjects.ARStreamChunk;
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    chunk: string; // Text with markers
    chunkIndex: number;
    timestamp: string;
    isFinal: boolean;
  };
}
```

### AR Stream End Event
```typescript
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

### AR Stream Interrupt Event
```typescript
export interface ARStreamInterruptEvent {
  subject: Subjects.ARStreamInterrupt;
  data: {
    streamId: string;
    roomId: string;
    userId: string;
    interruptedAt: string;
  };
}
```

---

## 7. Stream Management

### Stream State (Redis)

```typescript
// Stream state stored in Redis
interface StreamState {
  streamId: string;
  messageId: string;
  roomId: string;
  agentId: string;
  userId: string;
  status: 'active' | 'paused' | 'interrupted' | 'completed';
  startedAt: string;
  connectionIds: string[]; // WebSocket connection IDs
}

// Redis keys
`ar:stream:${streamId}` → StreamState (JSON)
`ar:room:${roomId}:streams` → Set of streamIds
`ar:user:${userId}:active-streams` → Set of streamIds
```

### Stream Manager

```typescript
class StreamManager {
  // Start new stream
  async startStream(streamId: string, roomId: string, agentId: string, userId: string) {
    const state: StreamState = {
      streamId,
      messageId: '',
      roomId,
      agentId,
      userId,
      status: 'active',
      startedAt: new Date().toISOString(),
      connectionIds: [],
    };
    
    await redis.setex(
      `ar:stream:${streamId}`,
      3600, // 1 hour TTL
      JSON.stringify(state)
    );
    
    await redis.sadd(`ar:room:${roomId}:streams`, streamId);
    await redis.sadd(`ar:user:${userId}:active-streams`, streamId);
  }
  
  // Add connection to stream
  async addConnection(streamId: string, connectionId: string) {
    const state = await this.getStreamState(streamId);
    if (state) {
      state.connectionIds.push(connectionId);
      await redis.setex(
        `ar:stream:${streamId}`,
        3600,
        JSON.stringify(state)
      );
    }
  }
  
  // Interrupt stream
  async interruptStream(streamId: string) {
    const state = await this.getStreamState(streamId);
    if (state && state.status === 'active') {
      state.status = 'interrupted';
      await redis.setex(
        `ar:stream:${streamId}`,
        3600,
        JSON.stringify(state)
      );
      
      // Notify AI Gateway to stop streaming
      await publishARStreamInterrupt(streamId, state.roomId, state.userId);
    }
  }
  
  // Complete stream
  async completeStream(streamId: string) {
    const state = await this.getStreamState(streamId);
    if (state) {
      state.status = 'completed';
      await redis.setex(
        `ar:stream:${streamId}`,
        3600,
        JSON.stringify(state)
      );
      
      // Clean up after 1 hour
      setTimeout(async () => {
        await redis.del(`ar:stream:${streamId}`);
        await redis.srem(`ar:room:${state.roomId}:streams`, streamId);
        await redis.srem(`ar:user:${state.userId}:active-streams`, streamId);
      }, 3600000);
    }
  }
}
```

---

## 8. WebSocket Connection Manager

```typescript
class ConnectionManager {
  private connections = new Map<string, WebSocket>(); // connectionId -> WebSocket
  private roomConnections = new Map<string, Set<string>>(); // roomId -> Set<connectionId>
  private userConnections = new Map<string, Set<string>>(); // userId -> Set<connectionId>
  
  addConnection(connectionId: string, ws: WebSocket, roomId: string, userId: string) {
    this.connections.set(connectionId, ws);
    
    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(connectionId);
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);
  }
  
  removeConnection(connectionId: string) {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close();
      this.connections.delete(connectionId);
      
      // Remove from room and user maps
      this.roomConnections.forEach((connections, roomId) => {
        connections.delete(connectionId);
        if (connections.size === 0) {
          this.roomConnections.delete(roomId);
        }
      });
      
      this.userConnections.forEach((connections, userId) => {
        connections.delete(connectionId);
        if (connections.size === 0) {
          this.userConnections.delete(userId);
        }
      });
    }
  }
  
  getConnectionsForRoom(roomId: string): WebSocket[] {
    const connectionIds = this.roomConnections.get(roomId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(ws => ws && ws.readyState === WebSocket.OPEN) as WebSocket[];
  }
  
  broadcastToRoom(roomId: string, message: any) {
    const connections = this.getConnectionsForRoom(roomId);
    const messageStr = JSON.stringify(message);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}
```

---

## 9. AI Gateway Integration

### Enhanced AI Provider Interface

```typescript
interface StreamingAiProvider {
  // Existing
  generateResponse(request: AiProviderRequest): Promise<AiProviderResponse>;
  
  // New: Streaming with markers
  streamResponse(
    request: AiProviderRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
}

interface StreamChunk {
  content: string; // May include markers like [emotion:happy]
  isComplete: boolean;
  metadata?: {
    tokens?: number;
    finishReason?: string;
  };
}
```

### OpenAI Streaming Implementation

```typescript
async streamResponse(request: AiProviderRequest, onChunk: (chunk: StreamChunk) => void) {
  // Enhanced system prompt for AR conversations
  const arSystemPrompt = `
${request.systemPrompt}

IMPORTANT: You are in an AR conversation. Use emotion and gesture markers to express yourself naturally.

Marker Format:
- [emotion:<type>] - Change emotion/expression
- [gesture:<type>] - Trigger gesture animation
- [tone:<type>] - Change voice tone

Available emotions: neutral, happy, sad, angry, surprised, calm, excited, thoughtful, concerned
Available gestures: wave, nod, shake_head, point, hand_raise, thumbs_up, shrug
Available tones: neutral, excited, calm, serious, friendly, concerned, playful

Place markers:
- At the start of phrases that need emotion
- When your tone or emotion changes
- Before important gestures

Example: [emotion:happy,gesture:wave]Hello! [emotion:thoughtful]Let me think about that...
`;

  const stream = await this.client.chat.completions.create({
    model: request.modelName,
    messages: [
      { role: 'system', content: arSystemPrompt },
      { role: 'user', content: request.message },
    ],
    stream: true,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      onChunk({
        content,
        isComplete: false,
        metadata: {
          tokens: chunk.usage?.total_tokens,
        },
      });
    }
  }
  
  onChunk({
    content: '',
    isComplete: true,
  });
}
```

---

## 10. Client-Side Implementation

### Marker Parser

```typescript
// client/mobile-app/utils/ar-marker-parser.ts

interface Marker {
  type: 'emotion' | 'gesture' | 'pose' | 'tone';
  value: string;
}

interface ParsedChunk {
  text: string;
  markers: Marker[];
}

export function parseChunk(chunk: string): ParsedChunk {
  const markers: Marker[] = [];
  let text = chunk;
  
  // Match markers: [emotion:happy] or [gesture:wave] or [emotion:happy,gesture:wave]
  const markerRegex = /\[([^\]]+)\]/g;
  
  text = text.replace(markerRegex, (match, content) => {
    // Parse marker content: "emotion:happy" or "emotion:happy,gesture:wave"
    const parts = content.split(',');
    parts.forEach(part => {
      const [type, value] = part.trim().split(':');
      if (type && value) {
        markers.push({ type: type as Marker['type'], value });
      }
    });
    return ''; // Remove marker from text
  });
  
  return { text: text.trim(), markers };
}
```

### TTS Controller

```typescript
// client/mobile-app/utils/ar-tts-controller.ts

class ARTTSController {
  private synth = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  speak(text: string, tone?: string) {
    // Cancel previous if still speaking
    if (this.currentUtterance) {
      this.synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.getRateFromTone(tone);
    utterance.pitch = this.getPitchFromTone(tone);
    utterance.volume = 1.0;
    
    // Select voice based on agent
    const voices = this.synth.getVoices();
    utterance.voice = voices.find(v => 
      v.name.includes('Male') || v.name.includes('Female')
    ) || null;
    
    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }
  
  stop() {
    this.synth.cancel();
    this.currentUtterance = null;
  }
  
  private getRateFromTone(tone?: string): number {
    const rates: Record<string, number> = {
      excited: 1.2,
      calm: 0.9,
      serious: 1.0,
      friendly: 1.1,
      concerned: 1.0,
      playful: 1.15,
      neutral: 1.0,
    };
    return rates[tone || 'neutral'] || 1.0;
  }
  
  private getPitchFromTone(tone?: string): number {
    const pitches: Record<string, number> = {
      excited: 1.2,
      calm: 0.95,
      serious: 0.9,
      friendly: 1.1,
      concerned: 1.0,
      playful: 1.15,
      neutral: 1.0,
    };
    return pitches[tone || 'neutral'] || 1.0;
  }
}
```

### Animation Controller

```typescript
// client/mobile-app/utils/ar-animation-controller.ts

class ARAnimationController {
  private model: THREE.Object3D;
  private animator: AnimationMixer;
  private currentEmotion: string = 'neutral';
  
  constructor(model: THREE.Object3D) {
    this.model = model;
    this.animator = new THREE.AnimationMixer(model);
  }
  
  applyMarker(marker: Marker) {
    switch (marker.type) {
      case 'emotion':
        this.setEmotion(marker.value);
        break;
      case 'gesture':
        this.playGesture(marker.value);
        break;
      case 'pose':
        this.setPose(marker.value);
        break;
    }
  }
  
  private setEmotion(emotion: string) {
    // Update facial expression blend shapes
    const blendShapes = this.getBlendShapesForEmotion(emotion);
    
    // Smooth transition
    if (this.currentEmotion !== emotion) {
      this.transitionEmotion(this.currentEmotion, emotion, blendShapes);
      this.currentEmotion = emotion;
    }
  }
  
  private playGesture(gesture: string) {
    // Play gesture animation
    const animation = this.animator.clipAction(`gesture_${gesture}`);
    if (animation) {
      animation.reset().play();
    }
  }
  
  private setPose(pose: string) {
    // Change body pose
    const poseAnimation = this.animator.clipAction(`pose_${pose}`);
    if (poseAnimation) {
      poseAnimation.reset().fadeIn(0.3).play();
    }
  }
  
  private getBlendShapesForEmotion(emotion: string): number[] {
    // Return blend shape weights for emotion
    // This depends on your 3D model's blend shapes
    const emotions: Record<string, number[]> = {
      neutral: [0, 0, 0, 0, 0],
      happy: [1, 0, 0, 0, 0], // smile
      sad: [0, 1, 0, 0, 0], // frown
      angry: [0, 0, 1, 0, 0], // angry
      surprised: [0, 0, 0, 1, 0], // surprised
      // ... etc
    };
    return emotions[emotion] || emotions.neutral;
  }
  
  update(deltaTime: number) {
    this.animator.update(deltaTime);
  }
}
```

---

## 11. Integration Points

### Agent Detail Page Integration

**Button Placement:**
- In agent detail screen
- Next to "Chat" button
- Label: "Video Chat" or "AR Chat"
- Icon: Video camera or AR icon

**Flow:**
1. User clicks "Video Chat" button
2. Client calls `POST /api/ar-conversations/rooms` with `agentId`
3. Service creates/resumes AR room
4. Client navigates to AR conversation screen
5. AR conversation screen connects to WebSocket
6. User can start conversation

### Chat Service Integration

**No Integration Required:**
- AR rooms are completely separate
- Not listed in chat rooms
- Not accessible via chat service
- Private by design

**Optional: Analytics Event**
- AR room created → Publish analytics event (optional)
- Not required for functionality

---

## 12. Database Schema

### AR Room Collection
```typescript
{
  _id: "room-123",
  userId: "user-456",
  agentId: "agent-789",
  status: "active",
  createdAt: ISODate("2024-12-14T20:00:00Z"),
  lastActivityAt: ISODate("2024-12-14T20:05:00Z"),
  endedAt: null
}
```

### AR Message Collection
```typescript
{
  _id: "msg-123",
  roomId: "room-123",
  senderId: "user-456",
  senderType: "human" | "agent",
  content: "Hello, how are you?",
  createdAt: ISODate("2024-12-14T20:00:00Z"),
  streamId: "stream-123" // If from agent stream
}
```

**Indexes:**
- `roomId` (for querying messages in room)
- `createdAt` (for sorting)
- `roomId + createdAt` (compound, for efficient queries)

---

## 13. Deployment

### Kubernetes Deployment

```yaml
# infra/k8s/ar-conversations-depl.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ar-conversations-depl
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ar-conversations
  template:
    metadata:
      labels:
        app: ar-conversations
    spec:
      containers:
        - name: ar-conversations
          image: bahmansalehinic4/ar-conversations
          ports:
            - containerPort: 3000
          env:
            - name: MONGO_URI
              value: "mongodb://ar-conversations-mongo-srv:27017/ar-conversations"
            - name: KAFKA_BROKER_URL
              value: 'redpanda-srv:9092'
            - name: KAFKA_CLIENT_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: REDIS_URL
              value: 'redis://ar-conversations-redis-srv:6379'
            - name: JWT_DEV
              valueFrom:
                secretKeyRef:
                  name: jwt-secret
                  key: JWT_DEV
          startupProbe:
            tcpSocket:
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 40
          readinessProbe:
            tcpSocket:
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          livenessProbe:
            tcpSocket:
              port: 3000
            initialDelaySeconds: 60
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: ar-conversations-srv
spec:
  selector:
    app: ar-conversations
  ports:
    - name: http
      protocol: TCP
      port: 3000
      targetPort: 3000
    - name: websocket
      protocol: TCP
      port: 3001
      targetPort: 3001
```

### MongoDB Deployment

```yaml
# infra/k8s/ar-conversations-mongo-depl.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ar-conversations-mongo-depl
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ar-conversations-mongo
  template:
    metadata:
      labels:
        app: ar-conversations-mongo
    spec:
      containers:
        - name: ar-conversations-mongo
          image: mongo:7
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_DATABASE
              value: ar-conversations
          volumeMounts:
            - name: mongo-data
              mountPath: /data/db
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            tcpSocket:
              port: 27017
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: 27017
            initialDelaySeconds: 10
            periodSeconds: 5
      volumes:
        - name: mongo-data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: ar-conversations-mongo-srv
spec:
  selector:
    app: ar-conversations-mongo
  ports:
    - protocol: TCP
      port: 27017
      targetPort: 27017
```

### Redis Deployment

```yaml
# infra/k8s/ar-conversations-redis-depl.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ar-conversations-redis-depl
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ar-conversations-redis
  template:
    metadata:
      labels:
        app: ar-conversations-redis
    spec:
      containers:
        - name: ar-conversations-redis
          image: redis:7-alpine
          ports:
            - containerPort: 6379
          resources:
            requests:
              memory: "128Mi"
              cpu: "50m"
            limits:
              memory: "256Mi"
              cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: ar-conversations-redis-srv
spec:
  selector:
    app: ar-conversations-redis
  ports:
    - protocol: TCP
      port: 6379
      targetPort: 6379
```

---

## 14. API Gateway Routing

### Routes

```typescript
// backEnd/api-gateway/src/config/routes.ts

// AR Conversations Service routes
{
  path: '/api/ar-conversations/*',
  target: process.env.AR_CONVERSATIONS_SERVICE_URL || 'http://ar-conversations-srv:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  requiresAuth: true,
}
```

### WebSocket Proxy

```typescript
// WebSocket proxy for AR streaming
// Route: ws://api-gateway/ar-stream
// Proxy to: ws://ar-conversations-srv:3001/ar-stream
```

---

## 15. Pros and Cons

### Separate AR Service Approach

**Pros:**
- ✅ **Clear Separation**: AR conversations separate from regular chat
- ✅ **Privacy**: AR rooms not listed in chat (private by design)
- ✅ **Scalability**: Can scale AR service independently
- ✅ **Specialized**: Service optimized for AR-specific needs
- ✅ **Clean Architecture**: Each service has clear responsibility
- ✅ **Future-Proof**: Easy to add group AR chats later

**Cons:**
- ❌ **Code Duplication**: Some logic duplicated (room management)
- ❌ **More Services**: Additional service to maintain
- ❌ **Complexity**: More moving parts

**Verdict**: ✅ **Recommended** - The benefits outweigh the costs, especially for future group AR chats.

---

## 16. Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. **Create AR Conversations Service**
   - Service structure
   - MongoDB models (AR Room, AR Message)
   - Basic API endpoints

2. **Room Management**
   - Create/resume AR room
   - Get AR room
   - End AR room
   - List user's AR rooms

3. **Database Setup**
   - MongoDB deployment
   - Redis deployment
   - Indexes

### Phase 2: Streaming (Week 3-4)

4. **WebSocket Server**
   - WebSocket endpoint
   - Connection management
   - Authentication

5. **AI Gateway Integration**
   - Streaming support
   - Marker injection
   - Event publishing

6. **Stream Management**
   - Stream state (Redis)
   - Stream lifecycle
   - Interruption handling

### Phase 3: Client Integration (Week 5-6)

7. **Client-Side Components**
   - AR Conversation Screen
   - WebSocket client
   - Marker parser
   - TTS controller
   - Animation controller

8. **Agent Detail Integration**
   - "Video Chat" button
   - Navigation to AR screen
   - Room resumption logic

### Phase 4: Polish (Week 7-8)

9. **Error Handling**
   - Stream failures
   - Connection recovery
   - Fallback mechanisms

10. **Optimization**
    - Marker quality
    - Animation smoothing
    - TTS quality

---

## 17. Open Questions

1. **Marker Quality**: How reliable is AI at generating markers?
   - **Answer**: Start with prompt engineering, add post-processing if needed

2. **TTS Provider**: Web Speech API or ElevenLabs?
   - **Answer**: Web Speech API for MVP (free), ElevenLabs for production (quality)

3. **Animation Assets**: Where do animations come from?
   - **Answer**: Pre-generated in GLTF model, or generate via AI service

4. **Stream Interruption**: How to handle user interrupting agent?
   - **Answer**: Send interrupt event, cancel stream, start new stream

5. **Room Persistence**: Should AR rooms persist after ending?
   - **Answer**: Yes, for history. Status changes to 'ended', can be resumed later

6. **Message History**: Should AR messages be stored?
   - **Answer**: Yes, for context. Store in AR Message collection.

---

## 18. Data Flow Diagram

```
User clicks "Video Chat" on Agent Detail
  ↓
Client: POST /api/ar-conversations/rooms { agentId }
  ↓
AR Service: Create/resume AR room
  ↓
Client: Navigate to AR Conversation Screen
  ↓
Client: Connect WebSocket ws://ar-conversations-srv/ar-stream?roomId=...
  ↓
User types message → Client sends via WebSocket
  ↓
AR Service: Creates message, publishes ARMessageRequestEvent
  ↓
AI Gateway: Receives event, streams response with markers
  ↓
AI Gateway: Publishes ARStreamChunkEvent for each chunk
  ↓
AR Service: Receives chunks, forwards via WebSocket
  ↓
Client: Parses markers, updates 3D model, speaks text
```

---

## 19. Security Considerations

1. **Authentication**
   - JWT token required for all endpoints
   - WebSocket connection validates token
   - Room access restricted to owner

2. **Authorization**
   - User can only access their own AR rooms
   - Agent ownership verified
   - WebSocket connections validated per room

3. **Rate Limiting**
   - Limit AR message requests per user
   - Limit WebSocket connections per user
   - Prevent abuse

---

## 20. Monitoring & Observability

### Metrics to Track

1. **Room Metrics**
   - Active AR rooms count
   - Rooms created per day
   - Average session duration

2. **Stream Metrics**
   - Active streams count
   - Stream latency (chunk arrival time)
   - Stream completion rate
   - Interruption rate

3. **Performance Metrics**
   - WebSocket connection count
   - Message processing time
   - AI Gateway response time

### Logging

- AR room creation/resumption
- Stream start/end/interrupt
- WebSocket connection/disconnection
- Errors and failures

---

## 21. Future Enhancements (Phase 2+)

1. **Group AR Chats**
   - Multiple users + agents
   - Team meetings in AR
   - Shared AR environment

2. **Voice Input**
   - Speech-to-text for user messages
   - Real-time transcription
   - Voice commands

3. **Advanced Animations**
   - AI-generated movements
   - Context-aware gestures
   - Environmental interactions

4. **AR Environments**
   - Custom backgrounds
   - Shared virtual spaces
   - Spatial audio

---

## Conclusion

This design provides:
- ✅ **Separate AR Service**: Clean separation from chat
- ✅ **Private Rooms**: Not listed in chat, accessible from agent detail
- ✅ **1-on-1 Conversations**: User + Agent only (Phase 1)
- ✅ **Streaming Architecture**: Real-time with markers
- ✅ **Client-Side Processing**: TTS and animations on client
- ✅ **Scalable**: Can scale independently
- ✅ **Future-Proof**: Easy to add group AR chats later

The architecture balances simplicity (Phase 1) with extensibility (Phase 2+).

