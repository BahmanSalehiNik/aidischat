# AR Stream - Execution Plan

## Overview
Implementation plan for streaming AR conversations with real-time text, client-side TTS, and animations.

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Room Service Enhancement
**Tasks:**
- [ ] Add `type: 'chat' | 'ar' | 'group'` field to Room model
- [ ] Add `capabilities: string[]` field to Room model
- [ ] Add `agentId?: string` field (for AR rooms)
- [ ] Add `status?: 'active' | 'paused' | 'ended'` field (for AR rooms)
- [ ] Update `POST /api/rooms` to accept `type` and `capabilities`
- [ ] Update `GET /api/rooms` to filter AR rooms by default (`?excludeAR=true`)
- [ ] Add endpoint: `GET /api/rooms?type=ar` (for AR room lookup)
- [ ] Update `RoomCreatedEvent` to include `type` and `capabilities`

**Files:**
- `backEnd/room/src/models/room.ts`
- `backEnd/room/src/routes/createRoom.ts`
- `backEnd/room/src/routes/getRooms.ts`
- `@aichatwar/shared` - Update RoomCreatedEvent interface

**Estimated Time:** 2-3 days

---

### 1.2 AR Conversations Service Setup
**Tasks:**
- [ ] Create new service: `backEnd/ar-conversations/`
- [ ] Set up project structure (models, routes, events, services)
- [ ] Configure MongoDB connection
- [ ] Configure Kafka client
- [ ] Set up Express server
- [ ] Add Dockerfile and Kubernetes deployment YAML
- [ ] Add to Skaffold config

**Project Structure:**
```
backEnd/ar-conversations/
├── src/
│   ├── index.ts
│   ├── models/
│   │   └── ar-message.ts
│   ├── routes/
│   │   ├── ar-messages.ts
│   │   └── ar-tokens.ts
│   ├── events/
│   │   ├── listeners/
│   │   │   └── ar-stream-chunk-listener.ts
│   │   └── publishers/
│   │       └── ar-message-request-publisher.ts
│   ├── services/
│   │   ├── token-service.ts
│   │   └── message-service.ts
│   └── kafka-client.ts
├── package.json
└── Dockerfile
```

**Files:**
- Create new service directory structure
- `infra/k8s/ar-conversations-depl.yaml`
- Update `skaffold.yaml`

**Estimated Time:** 2-3 days

---

### 1.3 AR Message Model
**Tasks:**
- [ ] Create AR Message model with fields:
  - `id`, `roomId`, `senderId`, `senderType`, `content`, `markers`, `status`, `createdAt`
- [ ] Add indexes: `roomId`, `senderId`, `createdAt`
- [ ] Add validation logic

**Files:**
- `backEnd/ar-conversations/src/models/ar-message.ts`

**Estimated Time:** 1 day

---

## Phase 2: Core Backend (Week 3-4)

### 2.1 AR Message Endpoints
**Tasks:**
- [ ] `POST /api/ar-rooms/:roomId/messages` - Send message, publish ARMessageRequestEvent
- [ ] `GET /api/ar-rooms/:roomId/messages` - Get message history
- [ ] Add JWT authentication middleware
- [ ] Add room access validation (verify user owns room)

**Files:**
- `backEnd/ar-conversations/src/routes/ar-messages.ts`

**Estimated Time:** 2 days

---

### 2.2 Token Management Service
**Tasks:**
- [ ] `GET /api/ar-rooms/:roomId/provider-tokens` - Generate signed tokens
- [ ] Implement token generation for TTS providers (ElevenLabs, Azure Speech)
- [ ] Implement token generation for animation providers
- [ ] Add token expiration (1 hour)
- [ ] Add token rotation logic
- [ ] Add rate limiting per token

**Files:**
- `backEnd/ar-conversations/src/routes/ar-tokens.ts`
- `backEnd/ar-conversations/src/services/token-service.ts`

**Estimated Time:** 3-4 days

---

### 2.3 Kafka Events
**Tasks:**
- [ ] Create `ARMessageRequestEvent` publisher
- [ ] Create `ARStreamChunkEvent` listener
- [ ] Add event interfaces to `@aichatwar/shared`
- [ ] Add Kafka topics: `ar.message.request`, `ar.stream.chunk`, `ar.stream.start`, `ar.stream.end`

**Files:**
- `backEnd/ar-conversations/src/events/publishers/ar-message-request-publisher.ts`
- `backEnd/ar-conversations/src/events/listeners/ar-stream-chunk-listener.ts`
- `@aichatwar/shared` - Add event interfaces

**Estimated Time:** 2 days

---

### 2.4 AI Gateway Streaming Enhancement
**Tasks:**
- [ ] Add streaming support to AI providers (OpenAI, Anthropic)
- [ ] Add marker injection to AI prompts
- [ ] Create `ARMessageRequestEvent` listener
- [ ] Publish `ARStreamStartEvent`, `ARStreamChunkEvent`, `ARStreamEndEvent`
- [ ] Handle streaming errors and retries

**Files:**
- `backEnd/ai/aiGateway/src/events/listeners/ar-message-request-listener.ts`
- `backEnd/ai/aiGateway/src/providers/openai-provider.ts` - Add streaming
- `backEnd/ai/aiGateway/src/providers/anthropic-provider.ts` - Add streaming

**Estimated Time:** 4-5 days

---

### 2.5 Realtime Gateway Enhancement
**Tasks:**
- [ ] Add `ARStreamChunkEvent` listener
- [ ] Publish to Redis channel: `ar-room:${roomId}`
- [ ] Update WebSocket server to handle AR room channels
- [ ] Add AR stream message types to WebSocket protocol

**Files:**
- `backEnd/realtime-gateway/src/events/listeners/ar-stream-chunk-listener.ts`
- `backEnd/realtime-gateway/src/ws-server.ts` - Add AR room handling

**Estimated Time:** 2-3 days

---

## Phase 3: Client Implementation (Week 5-6)

### 3.1 "Video Chat" Button
**Tasks:**
- [ ] Add "Video Chat" button to Agent Detail Page
- [ ] Show button only when `avatarStatus === 'ready'`
- [ ] Handle button click: create/get AR room
- [ ] Navigate to AR Chat Screen

**Files:**
- `client/mobile-app/app/(main)/AgentDetailScreen.tsx`

**Estimated Time:** 1 day

---

### 3.2 AR Chat Screen
**Tasks:**
- [ ] Create new AR Chat Screen component
- [ ] Set up WebSocket connection to `/ws/ar-rooms/:roomId`
- [ ] Request provider tokens on screen load
- [ ] Display text input for user messages
- [ ] Handle WebSocket messages (stream chunks)
- [ ] Display streaming text with markers

**Files:**
- `client/mobile-app/app/(main)/ARChatScreen.tsx` (new)
- `client/mobile-app/utils/arApi.ts` (new)

**Estimated Time:** 3-4 days

---

### 3.3 Marker Parsing
**Tasks:**
- [ ] Create marker parser utility
- [ ] Parse emotion markers: `[emotion:happy]`
- [ ] Parse gesture markers: `[gesture:wave]`
- [ ] Parse pose markers: `[pose:thinking]`
- [ ] Parse tone markers: `[tone:excited]`
- [ ] Extract clean text from markers

**Files:**
- `client/mobile-app/utils/markerParser.ts` (new)

**Estimated Time:** 2 days

---

### 3.4 TTS Integration
**Tasks:**
- [ ] Integrate Web Speech API (free option)
- [ ] Or integrate ElevenLabs streaming API (premium option)
- [ ] Apply tone markers to TTS voice
- [ ] Stream audio as text chunks arrive
- [ ] Handle audio playback synchronization

**Files:**
- `client/mobile-app/services/ttsService.ts` (new)

**Estimated Time:** 3-4 days

---

### 3.5 Viseme Generation (Client-Side)
**Tasks:**
- [ ] Choose viseme solution (see options below)
- [ ] Download/install viseme library/package
- [ ] Create viseme service to generate visemes from text
- [ ] Map visemes to 3D model blend shapes/morph targets
- [ ] Synchronize visemes with audio playback
- [ ] Handle real-time viseme updates as text streams

**Recommended Options:**

**Option 1: HeadTTS (Recommended - Free, Offline)**
- Free neural TTS with viseme timestamps
- Runs in-browser with WebGPU/WASM
- Can be downloaded once and used offline
- Provides both TTS audio and viseme data
- GitHub: https://github.com/met4citizen/HeadTTS
- **Pros**: Free, offline, provides both TTS and visemes
- **Cons**: May need React Native bindings for mobile

**Option 2: Phoneme-to-Viseme Mapping (Simple, Offline)**
- Static JSON mapping file (download once)
- Map phonemes from text to viseme IDs
- Use timing from TTS audio to sync visemes
- Lightweight, no external dependencies
- **Pros**: Simple, fully offline, no API calls
- **Cons**: Less accurate than ML-based solutions

**Option 3: Azure Speech SDK (API-based)**
- Provides viseme events during TTS
- Requires API key (backend provides token)
- Real-time viseme data
- **Pros**: High quality, real-time
- **Cons**: Requires internet, API costs

**Option 4: Custom Phoneme Parser + Viseme Map**
- Use text-to-phoneme library (e.g., `cmu-pronouncing-dictionary`)
- Map phonemes to visemes using static mapping
- Calculate timing from audio duration
- **Pros**: Fully offline, lightweight
- **Cons**: Less accurate timing

**Files:**
- `client/mobile-app/services/visemeService.ts` (new)
- `client/mobile-app/utils/phonemeToViseme.ts` (new - if using Option 2/4)
- `client/mobile-app/data/visemeMapping.json` (new - download once)

**Estimated Time:** 3-5 days (depending on option chosen)

---

### 3.6 Animation Integration
**Tasks:**
- [ ] Apply emotion markers to 3D model (blend shapes)
- [ ] Trigger gesture animations from markers
- [ ] Change poses based on markers
- [ ] Apply visemes to mouth/lip movements
- [ ] Synchronize all animations with audio

**Files:**
- `client/mobile-app/services/animationService.ts` (new)
- `client/mobile-app/components/avatar/ARModelViewer.tsx` (new)

**Estimated Time:** 3-4 days

---

### 3.7 3D Model AR Rendering
**Tasks:**
- [ ] Enhance 3D model loading with colors/textures
- [ ] Implement AR rendering (ARKit/ARCore)
- [ ] Apply emotion blend shapes
- [ ] Play gesture animations
- [ ] Update poses in real-time
- [ ] Synchronize with audio and animations

**Files:**
- `client/mobile-app/components/avatar/Model3DViewer.tsx` - Enhance for AR
- `client/mobile-app/components/avatar/ARModelViewer.tsx` (new)

**Estimated Time:** 5-6 days

---

## Phase 4: Integration & Testing (Week 7-8)

### 4.1 End-to-End Testing
**Tasks:**
- [ ] Test AR room creation flow
- [ ] Test message sending and streaming
- [ ] Test marker parsing and application
- [ ] Test TTS synchronization
- [ ] Test animation synchronization
- [ ] Test 3D model rendering in AR

**Estimated Time:** 3-4 days

---

### 4.2 Error Handling
**Tasks:**
- [ ] Handle WebSocket disconnections
- [ ] Handle streaming errors
- [ ] Handle TTS provider failures
- [ ] Handle animation provider failures
- [ ] Add retry logic
- [ ] Add fallback mechanisms

**Estimated Time:** 2-3 days

---

### 4.3 Performance Optimization
**Tasks:**
- [ ] Optimize 3D model loading (texture compression)
- [ ] Optimize marker parsing
- [ ] Optimize WebSocket message handling
- [ ] Add caching for provider tokens
- [ ] Optimize animation transitions

**Estimated Time:** 2-3 days

---

### 4.4 Polish & Bug Fixes
**Tasks:**
- [ ] Fix UI/UX issues
- [ ] Fix synchronization issues
- [ ] Add loading states
- [ ] Add error messages
- [ ] Improve marker reliability (if needed)

**Estimated Time:** 2-3 days

---

## Dependencies & Prerequisites

### Backend
- [ ] Room Service must support `type` and `capabilities` fields
- [ ] Kafka topics must be created
- [ ] Redis must be available for pub/sub
- [ ] MongoDB must be available

### Client
- [ ] ARKit (iOS) or ARCore (Android) support
- [ ] Web Speech API or ElevenLabs API key
- [ ] Viseme generation library/package (see `docs/ar-viseme-options.md`)
  - Recommended: Phoneme-to-Viseme mapping (Option 2) for MVP
  - Or: HeadTTS (Option 1) for better quality

---

## Open Questions to Resolve

1. **Viseme Generation**: Which client-side solution to use?
   - **Recommendation**: Start with **Phoneme-to-Viseme Mapping** (Option 2) for simplicity
   - Upgrade to **HeadTTS** (Option 1) if better quality needed
   - Both can be downloaded once and used offline

2. **TTS Provider**: Start with Web Speech API (free) or ElevenLabs (premium)?
   - **Recommendation**: Start with Web Speech API, upgrade later
   - If using HeadTTS, it provides both TTS and visemes

3. **Marker Reliability**: How reliable is AI at generating markers?
   - May need post-processing or fallback logic

4. **AR Platform**: ARKit (iOS) or ARCore (Android) or both?
   - **Recommendation**: Start with one platform, expand later

---

## Estimated Timeline

- **Phase 1 (Foundation)**: 2 weeks
- **Phase 2 (Core Backend)**: 2 weeks
- **Phase 3 (Client Implementation)**: 2 weeks
- **Phase 4 (Integration & Testing)**: 2 weeks

**Total: 8 weeks (2 months)**

---

## Success Criteria

- [ ] User can click "Video Chat" on agent detail page
- [ ] AR room is created/retrieved successfully
- [ ] User can send messages in AR chat
- [ ] AI responses stream with emotion/movement markers
- [ ] Client receives stream chunks via WebSocket
- [ ] TTS plays audio synchronized with text
- [ ] Animations play synchronized with audio
- [ ] 3D model renders in AR space with colors
- [ ] Emotions and gestures update in real-time
- [ ] No AR rooms appear in regular chat listings

---

## Next Steps

1. **Start with Phase 1.1**: Room Service Enhancement
2. **Set up AR Conversations Service**: Phase 1.2
3. **Implement AR Message Model**: Phase 1.3
4. **Proceed sequentially** through phases

