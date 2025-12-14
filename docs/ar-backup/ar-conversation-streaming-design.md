# AR Conversation Streaming Design - Phase 2 First

## Overview
This document outlines the streaming-first design for AR conversations, where AI responses are streamed in real-time with emotion and movement markers, and TTS/animations are handled client-side.

**Key Decision: Skip Phase 1, go directly to Phase 2 with streaming**
- AI Gateway streams text with emotion/movement markers
- Client-side TTS (Web Speech API or ElevenLabs streaming)
- Client-side animations based on markers
- Separate AR Streaming Service for WebSocket management

## Key Design Decision: Streaming First

**Why Streaming?**
- ✅ **Lower Latency**: User sees/hears response as it's generated (not after 7+ seconds)
- ✅ **Better UX**: More natural conversation flow
- ✅ **Emotion Synchronization**: Emotions and movements can change mid-sentence
- ✅ **Interruption Support**: User can interrupt agent naturally
- ✅ **Client-Side Processing**: Reduces server load and costs

---

## Architecture Overview

### High-Level Flow
```
User Message (Text)
  ↓
Chat Service (creates message)
  ↓
AI Gateway (streams response with markers)
  ↓
Streaming Service (manages WebSocket streams)
  ↓
Realtime Gateway (broadcasts to room)
  ↓
Client (receives stream, processes TTS + animations in real-time)
```

---

## 1. Streaming Text Format with Markers

### Emotion/Movement Marker Syntax

The AI provider will return text with inline markers:

```
[emotion:angry]NO, [emotion:calm]that is not true, [emotion:happy,gesture:wave]let's talk about it.
```

**Marker Format:**
- `[emotion:<type>]` - Changes emotion/expression
- `[gesture:<type>]` - Triggers gesture/animation
- `[pose:<type>]` - Changes body pose
- `[tone:<type>]` - Changes voice tone (for TTS)

**Supported Emotions:**
- `neutral`, `happy`, `sad`, `angry`, `surprised`, `fearful`, `disgusted`, `calm`, `excited`, `confused`, `thoughtful`

**Supported Gestures:**
- `wave`, `nod`, `shake_head`, `point`, `hand_raise`, `thumbs_up`, `shrug`, `lean_forward`, `lean_back`

**Supported Poses:**
- `idle`, `talking`, `listening`, `thinking`, `explaining`

**Supported Tones:**
- `neutral`, `excited`, `calm`, `serious`, `friendly`, `concerned`, `playful`

### Example Streaming Response

```
[emotion:thoughtful,pose:thinking]Hmm, [emotion:happy,tone:friendly]that's an interesting question! [gesture:nod,emotion:excited]Let me explain...
```

---

## 2. Service Architecture

### New Service: AR Streaming Service

**Purpose:**
- Manages WebSocket connections for AR rooms
- Routes streaming AI responses to clients
- Handles stream lifecycle (start, pause, cancel, end)
- Manages interruption signals

**Responsibilities:**
1. Accept WebSocket connections for AR rooms
2. Forward streaming text from AI Gateway to clients
3. Handle interruption signals from clients
4. Manage stream state per room/agent
5. Broadcast stream events to all clients in room

**Technology:**
- Node.js with WebSocket (ws library)
- Kafka consumer for AI Gateway streaming events
- Redis for stream state management

### AI Gateway Enhancements

**Changes:**
1. **Streaming Support**: Return streaming responses instead of complete text
2. **Marker Injection**: AI provider returns text with emotion/movement markers
3. **Stream Events**: Publish streaming chunks to Kafka topic

**Streaming Implementation:**
```typescript
// AI Gateway streams response chunks
async function* streamAIResponse(request) {
  const stream = await openai.chat.completions.create({
    model: request.modelName,
    messages: request.messages,
    stream: true, // Enable streaming
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      yield {
        type: 'text',
        content: content,
        timestamp: Date.now(),
      };
    }
  }
  
  yield {
    type: 'done',
    timestamp: Date.now(),
  };
}
```

**Marker Injection Strategy:**
- **Option A**: AI provider returns markers naturally (GPT-4 can be prompted)
- **Option B**: Post-process text to inject markers based on sentiment/context
- **Option C**: Use specialized model for emotion detection

**Recommendation**: Start with Option A (prompt engineering), add Option B/C later.

### ✅ Answer: YES, Real-Time TTS with Emotions & Body Language is Possible!

**Your Question:** "Can real-time TTS with streaming text create emotions and body language? Can the AI provider give those emotions at start of each phrase or when tone changes?"

**Answer: YES!** Here's exactly how:

**1. AI Provider Generates Markers in Stream:**
```
AI streams: "[emotion:angry]NO, [emotion:calm]that is not true, [emotion:happy,gesture:wave]let's talk about it."
```

**2. Markers Appear at Natural Breakpoints:**
- At phrase boundaries: `[emotion:angry]NO,`
- When tone changes: `[emotion:calm]that is not true,`
- For emphasis: `[emotion:happy,gesture:wave]let's talk about it.`

**3. Client Processes in Real-Time:**
- **As each chunk arrives**, client:
  1. Parses markers (emotion, gesture, tone)
  2. Updates 3D model expression/pose
  3. Triggers gesture animation
  4. Adjusts TTS voice (pitch, rate, tone)
  5. Speaks the text

**4. Everything Synchronized:**
- Voice tone matches emotion
- Facial expression matches emotion
- Gestures trigger at the right moment
- All happens as text streams (1-2s latency vs 7s+)

**Example Real-Time Flow:**
```
Chunk 1 arrives: "[emotion:angry]NO,"
  → 3D model: Set angry expression (blend shapes)
  → TTS: Speak "NO," with angry voice (low pitch, fast rate)
  → Animation: Trigger angry gesture (fist, lean forward)

Chunk 2 arrives: "[emotion:calm]that is not true,"
  → 3D model: Smooth transition to calm expression
  → TTS: Speak "that is not true," with calm voice (normal pitch, slower rate)
  → Animation: Return to neutral pose

Chunk 3 arrives: "[emotion:happy,gesture:wave]let's talk about it."
  → 3D model: Set happy expression (smile blend shapes)
  → TTS: Speak "let's talk about it." with happy voice (higher pitch, friendly rate)
  → Animation: Play wave gesture animation
```

**Why This Works:**
- ✅ GPT-4 can be prompted to include markers naturally
- ✅ Markers appear at natural language boundaries
- ✅ Client processes markers as they arrive (real-time)
- ✅ TTS can change voice parameters instantly
- ✅ 3D model can update expressions/animations instantly
- ✅ Everything stays synchronized

**Prompt for AI Provider:**
```
You are an AI assistant in an AR conversation. When responding, use emotion and gesture markers to express yourself naturally.

Format markers like: [emotion:<type>] or [gesture:<type>] or [tone:<type>]

Place markers:
- At the start of phrases that need emotion
- When your tone or emotion changes
- Before important gestures

Example: [emotion:angry]NO, [emotion:calm]that is not true, [emotion:happy,gesture:wave]let's talk about it.
```

---

## 3. Event Flow

### Stream Start Event
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

### Stream Chunk Event
```typescript
export interface ARStreamChunkEvent {
  subject: Subjects.ARStreamChunk;
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    chunk: string; // Text chunk with potential markers
    chunkIndex: number;
    timestamp: string;
    isFinal: boolean;
  };
}
```

### Stream End Event
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

### Stream Interrupt Event
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

## 4. Client-Side Processing

### Text Processing Pipeline

**Step 1: Receive Stream Chunk**
```typescript
// Client receives chunk via WebSocket
{
  type: 'ar-stream-chunk',
  streamId: 'stream-123',
  chunk: '[emotion:happy]Hello! [gesture:wave]How are you?',
  chunkIndex: 0,
  timestamp: '2024-12-14T20:00:00Z'
}
```

**Step 2: Parse Markers**
```typescript
function parseChunk(chunk: string): ParsedChunk {
  const markers: Marker[] = [];
  const text = chunk.replace(/\[([^\]]+)\]/g, (match, content) => {
    const marker = parseMarker(content); // emotion:happy, gesture:wave
    markers.push(marker);
    return ''; // Remove marker from text
  });
  
  return { text, markers };
}
```

**Step 3: Apply Markers Sequentially**
```typescript
// For each marker in chunk:
// 1. Update 3D model emotion/expression
// 2. Trigger gesture animation
// 3. Change pose if needed
// 4. Update TTS voice tone
```

**Step 4: Stream TTS**
```typescript
// Option A: Web Speech API (Browser built-in)
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1.0;
utterance.pitch = getPitchFromTone(marker.tone);
utterance.volume = 1.0;
speechSynthesis.speak(utterance);

// Option B: ElevenLabs Streaming API (Better quality, requires API key)
const stream = await elevenlabs.textToSpeechStream(agentVoiceId, text, {
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
  },
  model_id: 'eleven_turbo_v2_5', // Fast streaming model
});

// Play audio stream as it arrives
```

**Step 5: Animate 3D Model**
```typescript
// Update emotion/expression
model.setEmotion(marker.emotion);

// Trigger gesture
if (marker.gesture) {
  model.playGesture(marker.gesture);
}

// Change pose
if (marker.pose) {
  model.setPose(marker.pose);
}
```

---

## 5. Room Model Changes

### Simple Boolean (Phase 1)
```typescript
const roomSchema = new mongoose.Schema({
  // ... existing fields
  isARConversation: { type: Boolean, default: false },
});
```

### RoomCreatedEvent Update
```typescript
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

---

## 6. Service Implementation Details

### AR Streaming Service Structure

```
backEnd/ar-streaming/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── websocket-server.ts      # WebSocket server
│   ├── stream-manager.ts        # Manages active streams
│   ├── events/
│   │   ├── listeners/
│   │   │   ├── ar-stream-start-listener.ts
│   │   │   ├── ar-stream-chunk-listener.ts
│   │   │   └── ar-stream-end-listener.ts
│   │   └── publishers/
│   │       └── ar-stream-interrupt-publisher.ts
│   ├── models/
│   │   └── stream-state.ts     # Stream state model (Redis)
│   └── kafka-client.ts
├── package.json
└── Dockerfile
```

### Stream Manager

**Responsibilities:**
- Track active streams per room
- Map streamId to WebSocket connections
- Handle stream lifecycle
- Manage interruptions

**Redis State:**
```typescript
// Stream state in Redis
{
  `ar:stream:${streamId}`: {
    streamId: string;
    messageId: string;
    roomId: string;
    agentId: string;
    userId: string;
    status: 'active' | 'paused' | 'interrupted' | 'completed';
    startedAt: string;
    connections: string[]; // WebSocket connection IDs
  }
}
```

---

## 7. AI Gateway Streaming Implementation

### Enhanced AI Provider Interface

```typescript
interface StreamingAiProvider {
  // Existing
  generateResponse(request: AiProviderRequest): Promise<AiProviderResponse>;
  
  // New: Streaming
  streamResponse(
    request: AiProviderRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
}

interface StreamChunk {
  content: string; // May include markers
  isComplete: boolean;
  metadata?: {
    tokens?: number;
    finishReason?: string;
  };
}
```

### OpenAI Streaming Example

```typescript
async streamResponse(request, onChunk) {
  const stream = await this.client.chat.completions.create({
    model: request.modelName,
    messages: request.messages,
    stream: true,
    // Add system prompt for marker generation
    system: request.systemPrompt + '\n\nWhen responding, use emotion and gesture markers like [emotion:happy] or [gesture:wave] to express yourself naturally.',
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      onChunk({
        content,
        isComplete: false,
      });
    }
  }
  
  onChunk({
    content: '',
    isComplete: true,
  });
}
```

### Marker Injection Prompt

```
You are an AI assistant in an AR conversation. When responding, use emotion and gesture markers to express yourself naturally.

Format: [emotion:<type>] or [gesture:<type>] or [tone:<type>]

Available emotions: neutral, happy, sad, angry, surprised, calm, excited, thoughtful
Available gestures: wave, nod, shake_head, point, hand_raise, thumbs_up, shrug
Available tones: neutral, excited, calm, serious, friendly, concerned, playful

Example: [emotion:happy,gesture:wave]Hello! [emotion:thoughtful]Let me think about that...
```

---

## 8. Real-Time TTS with Emotions - Answer to Your Question

**Yes, real-time TTS with streaming text CAN create emotions and body language!**

### How It Works:

1. **AI Provider Generates Markers**: As GPT-4 streams text, it includes markers like `[emotion:angry]` or `[tone:calm]`
2. **Client Parses Markers**: Client receives stream chunks and extracts markers
3. **TTS Adapts in Real-Time**: TTS voice changes tone/pitch based on markers
4. **Animations Trigger**: 3D model changes expression/gesture based on markers

### Example Flow:

```
AI Streams: "[emotion:angry]NO, [emotion:calm]that is not true, [emotion:happy,gesture:wave]let's talk about it."

Client Processing:
  Chunk 1: "[emotion:angry]NO,"
    → Set 3D model to angry expression
    → TTS speaks with angry tone (lower pitch, faster rate)
    → Text: "NO,"
  
  Chunk 2: "[emotion:calm]that is not true,"
    → Transition 3D model to calm expression
    → TTS speaks with calm tone (normal pitch, slower rate)
    → Text: "that is not true,"
  
  Chunk 3: "[emotion:happy,gesture:wave]let's talk about it."
    → Set 3D model to happy expression
    → Trigger wave gesture animation
    → TTS speaks with happy tone (higher pitch, friendly rate)
    → Text: "let's talk about it."
```

### TTS Emotion Control:

**Web Speech API:**
- Can change `rate`, `pitch`, `volume` in real-time
- Limited emotion control, but works for basic emotions
- Free, no API costs

**ElevenLabs Streaming:**
- Better emotion control via voice settings
- Can adjust `stability`, `style` parameters
- Higher quality, natural emotions
- Requires API key, costs per character

**Recommendation**: Start with Web Speech API (free), upgrade to ElevenLabs if quality is important.

## 9. Client-Side TTS Options

### Option A: Web Speech API (Free, Built-in)

**Pros:**
- ✅ No API costs
- ✅ Works offline
- ✅ Low latency
- ✅ Multiple voices available

**Cons:**
- ❌ Quality varies by browser/OS
- ❌ Limited emotion control
- ❌ No voice cloning

**Implementation:**
```typescript
class WebSpeechTTS {
  private synth = window.speechSynthesis;
  
  speak(text: string, tone: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.getRateFromTone(tone);
    utterance.pitch = this.getPitchFromTone(tone);
    utterance.volume = 1.0;
    
    // Select voice based on agent
    const voices = this.synth.getVoices();
    utterance.voice = voices.find(v => v.name.includes('Male') || v.name.includes('Female'));
    
    this.synth.speak(utterance);
  }
  
  private getRateFromTone(tone: string): number {
    const rates = {
      excited: 1.2,
      calm: 0.9,
      serious: 1.0,
      friendly: 1.1,
      concerned: 1.0,
      playful: 1.15,
      neutral: 1.0,
    };
    return rates[tone] || 1.0;
  }
  
  private getPitchFromTone(tone: string): number {
    const pitches = {
      excited: 1.2,
      calm: 0.95,
      serious: 0.9,
      friendly: 1.1,
      concerned: 1.0,
      playful: 1.15,
      neutral: 1.0,
    };
    return pitches[tone] || 1.0;
  }
}
```

### Option B: ElevenLabs Streaming API (Premium Quality)

**Pros:**
- ✅ High-quality, natural voices
- ✅ Voice cloning support
- ✅ Emotion control
- ✅ Streaming support

**Cons:**
- ❌ Requires API key
- ❌ Costs per character
- ❌ Requires internet

**Implementation:**
```typescript
class ElevenLabsTTS {
  private apiKey: string;
  private voiceId: string;
  
  async stream(text: string, tone: string): Promise<ReadableStream> {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5', // Fast streaming
          voice_settings: {
            stability: this.getStabilityFromTone(tone),
            similarity_boost: 0.75,
            style: this.getStyleFromTone(tone),
          },
        }),
      }
    );
    
    return response.body!;
  }
}
```

### Option C: Azure Speech Services (Enterprise)

**Pros:**
- ✅ High quality
- ✅ SSML support for emotions
- ✅ Multiple languages
- ✅ Custom neural voices

**Cons:**
- ❌ Requires Azure account
- ❌ More complex setup
- ❌ Costs per hour

**Recommendation**: Start with Option A (Web Speech API) for MVP, upgrade to Option B (ElevenLabs) for production if quality is important.

---

## 10. Client-Side Animation System

### Marker to Animation Mapping

```typescript
class ARAnimationController {
  private model: THREE.Object3D; // 3D model
  private animator: AnimationMixer;
  
  applyMarker(marker: Marker) {
    if (marker.emotion) {
      this.setEmotion(marker.emotion);
    }
    
    if (marker.gesture) {
      this.playGesture(marker.gesture);
    }
    
    if (marker.pose) {
      this.setPose(marker.pose);
    }
  }
  
  private setEmotion(emotion: string) {
    // Update facial expression blend shapes
    const blendShapes = this.getBlendShapesForEmotion(emotion);
    this.model.morphTargetInfluences = blendShapes;
  }
  
  private playGesture(gesture: string) {
    // Play gesture animation
    const animation = this.animator.clipAction(`gesture_${gesture}`);
    animation.reset().play();
  }
  
  private setPose(pose: string) {
    // Change body pose
    const poseAnimation = this.animator.clipAction(`pose_${pose}`);
    poseAnimation.reset().fadeIn(0.3).play();
  }
}
```

### Animation Assets

**Required Animations:**
- Gestures: `gesture_wave`, `gesture_nod`, `gesture_shake_head`, etc.
- Poses: `pose_idle`, `pose_talking`, `pose_listening`, `pose_thinking`
- Emotions: Blend shapes or morph targets for facial expressions

**Format:**
- GLTF/GLB with embedded animations
- Or separate animation files (JSON keyframes)

---

## 11. WebSocket Protocol

### Client → Server Messages

**Join AR Room:**
```json
{
  "type": "join-ar-room",
  "roomId": "room-123",
  "agentId": "agent-456"
}
```

**Send Message:**
```json
{
  "type": "ar-message",
  "roomId": "room-123",
  "content": "Hello, how are you?"
}
```

**Interrupt Stream:**
```json
{
  "type": "interrupt-stream",
  "streamId": "stream-123",
  "roomId": "room-123"
}
```

### Server → Client Messages

**Stream Start:**
```json
{
  "type": "ar-stream-start",
  "streamId": "stream-123",
  "messageId": "msg-456",
  "agentId": "agent-789",
  "startedAt": "2024-12-14T20:00:00Z"
}
```

**Stream Chunk:**
```json
{
  "type": "ar-stream-chunk",
  "streamId": "stream-123",
  "chunk": "[emotion:happy]Hello! [gesture:wave]",
  "chunkIndex": 0,
  "timestamp": "2024-12-14T20:00:01Z"
}
```

**Stream End:**
```json
{
  "type": "ar-stream-end",
  "streamId": "stream-123",
  "totalChunks": 15,
  "endedAt": "2024-12-14T20:00:05Z"
}
```

---

## 12. Implementation Plan

### Phase 1: Foundation (Week 1-2)

1. **Room Model Changes**
   - Add `isARConversation` boolean
   - Update RoomCreatedEvent
   - Update room creation endpoint

2. **AR Streaming Service Setup**
   - Create service structure
   - WebSocket server
   - Basic stream management

3. **AI Gateway Streaming**
   - Add streaming support to providers
   - Marker injection via prompts
   - Publish stream events to Kafka

### Phase 2: Core Features (Week 3-4)

4. **Stream Processing**
   - Stream chunk listener
   - WebSocket broadcasting
   - Stream state management

5. **Client Integration**
   - WebSocket connection
   - Marker parsing
   - Basic TTS (Web Speech API)
   - Basic animations

### Phase 3: Polish (Week 5-6)

6. **Advanced Features**
   - Interruption handling
   - Error recovery
   - Stream queuing

7. **Optimization**
   - Marker post-processing
   - Animation smoothing
   - TTS quality improvements

---

## 13. Pros and Cons Analysis

### Streaming Approach

**Pros:**
- ✅ **Low Latency**: User sees response immediately (1-2s vs 7s+)
- ✅ **Natural Flow**: More like real conversation
- ✅ **Emotion Sync**: Emotions change naturally mid-sentence
- ✅ **Interruption Support**: User can interrupt naturally
- ✅ **Client-Side Processing**: Reduces server load
- ✅ **Cost Effective**: No Azure Storage for voice files
- ✅ **Scalable**: Server just streams text, client does heavy lifting

**Cons:**
- ❌ **Complexity**: More moving parts (streaming service, WebSocket management)
- ❌ **Marker Parsing**: Need robust parser for markers
- ❌ **Client Requirements**: Requires capable device for TTS/animations
- ❌ **Network Dependency**: Requires stable connection
- ❌ **Marker Quality**: Depends on AI provider generating good markers

**Open Questions:**
1. ❓ **Marker Generation**: How reliable is AI at generating markers?
   - **Answer**: Start with prompt engineering, add post-processing if needed

2. ❓ **TTS Quality**: Is Web Speech API good enough?
   - **Answer**: Good for MVP, upgrade to ElevenLabs for production

3. ❓ **Animation Assets**: Where do animations come from?
   - **Answer**: Pre-generated animations in GLTF model, or generate via AI

4. ❓ **Stream Management**: How to handle multiple concurrent streams?
   - **Answer**: One stream per agent per room, queue others

5. ❓ **Error Handling**: What if stream fails mid-way?
   - **Answer**: Retry logic, fallback to non-streaming mode

---

## 14. Alternative: Hybrid Approach

### Fallback Strategy

If streaming fails or client doesn't support it:
1. Fall back to pre-generated approach (Phase 1 design)
2. AI Gateway generates complete response
3. TTS and movements generated server-side
4. Return signed URLs

**Implementation:**
```typescript
// Client checks streaming support
if (supportsStreaming && room.isARConversation) {
  // Use streaming
  connectToARStream(roomId);
} else {
  // Fall back to pre-generated
  sendRegularMessage(roomId, content);
}
```

---

## 15. Cost Analysis

### Streaming Approach Costs

**Server-Side:**
- AI Gateway: Same as before (AI API costs)
- Streaming Service: Minimal (just WebSocket management)
- Kafka: Same as before
- **Total**: ~$0 additional (just AI API costs)

**Client-Side:**
- Web Speech API: Free
- ElevenLabs (optional): ~$0.18 per 1000 characters
- **Total**: Free (Web Speech) or ~$0.18 per conversation (ElevenLabs)

### Pre-Generated Approach Costs

**Server-Side:**
- AI Gateway: Same
- TTS Service: ~$0.015 per 1000 characters (Azure)
- Azure Storage: ~$0.0001 per GB
- Bandwidth: ~$0.05 per GB
- **Total**: ~$0.015+ per message

**Comparison:**
- Streaming: **Free** (Web Speech) or **$0.18/1000 chars** (ElevenLabs)
- Pre-generated: **$0.015/1000 chars** (Azure TTS) + storage + bandwidth

**Winner**: Streaming with Web Speech API is **free** and better UX!

---

## 16. Recommended Architecture

### Services

1. **Chat Service** (existing)
   - Creates messages
   - Publishes `MessageCreatedEvent`
   - Detects AR rooms

2. **AI Gateway** (enhanced)
   - Streams AI responses with markers
   - Publishes `ARStreamChunkEvent` to Kafka

3. **AR Streaming Service** (new)
   - Manages WebSocket connections
   - Routes stream chunks to clients
   - Handles interruptions

4. **Realtime Gateway** (enhanced)
   - Broadcasts AR stream events
   - Or: AR Streaming Service handles this directly

### Data Flow

```
User → Chat Service → MessageCreatedEvent
  ↓
AI Gateway → Streams response → ARStreamChunkEvent (Kafka)
  ↓
AR Streaming Service → WebSocket → Client
  ↓
Client → Parses markers → TTS + Animations
```

---

## 17. Next Steps

1. ✅ **Approve streaming-first approach**
2. ✅ **Create AR Streaming Service structure**
3. ✅ **Enhance AI Gateway for streaming**
4. ✅ **Update Room model**
5. ✅ **Implement client-side marker parsing**
6. ✅ **Integrate Web Speech API**
7. ✅ **Create animation system**
8. ✅ **Testing and optimization**

---

## Conclusion

**Streaming-first approach is recommended because:**
- ✅ Better UX (lower latency, natural flow)
- ✅ Lower cost (free with Web Speech API)
- ✅ More scalable (client-side processing)
- ✅ Supports real-time emotions/movements
- ✅ Enables natural interruptions

**Key Success Factors:**
1. Reliable marker generation (prompt engineering + post-processing)
2. Robust marker parsing (handle edge cases)
3. Smooth animations (pre-generated assets)
4. Quality TTS (Web Speech for MVP, ElevenLabs for production)

This approach sets a strong foundation for future enhancements (voice input, real-time gestures, etc.).

