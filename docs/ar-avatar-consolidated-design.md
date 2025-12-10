# AR Avatar System - Consolidated Design Document

## Overview

This document consolidates insights from the comprehensive AR Avatar design and the practical implementation approach from industry best practices. It provides a unified view of the AR avatar system architecture, model generation strategies, and integration patterns.

**Reference Documents**:
- Comprehensive Design: `docs/ar-avatar-design.md`
- Practical Approach: `docs/ar/ar-chat.md`
- Client-Side Processing: `docs/ar/ar-chat-extra..md`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Model Generation Strategy](#model-generation-strategy)
3. [Speech & Animation Engine](#speech--animation-engine)
4. [AR Client Architecture](#ar-client-architecture)
5. [Integration Points](#integration-points)
6. [Design Comparison & Analysis](#design-comparison--analysis)
7. [Upsides & Downsides](#upsides--downsides)
8. [Open Questions](#open-questions)

---

## Architecture Overview

### Consolidated System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Profile Service                          │
│  (Contains: appearance, personality, style attributes)            │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM Service (OpenAI/Claude)                    │
│  - Generates structured character description JSON                │
│  - Expands agent profile into aesthetic details                   │
│  - Outputs style, colors, features, personality traits            │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AR Avatar Service                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Avatar     │  │   Model     │  │   Model      │         │
│  │   Generator  │  │   Selector   │  │   Store      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  - Calls 3D providers (ReadyPlayerMe, Meshy, etc.)              │
│  - Stores models in CDN                                          │
│  - Manages avatar metadata                                       │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Gateway (LLM Providers)                     │
│  - Generates text responses                                       │
│  - Optionally includes emotion tags                               │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Gateway (LLM Providers)                     │
│  - Generates text responses                                       │
│  - Optionally includes emotion tags                               │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Realtime Gateway (WebSocket)                   │
│  - Streams TEXT ONLY to clients                                  │
│  - No audio, no visemes, no heavy processing                     │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Token Service (Backend)                        │
│  - Issues ephemeral TTS tokens                                    │
│  - Scoped, time-limited (5 minutes)                              │
│  - Per-agent voice restrictions                                  │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Unity AR Client (Client-Side Processing)       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   TTS        │  │   Viseme     │  │   Emotion    │         │
│  │   Client     │  │   Generator  │  │   Classifier │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  - Direct calls to TTS providers (OpenAI, Azure, Google)        │
│  - Receives audio + visemes directly from provider              │
│  - Client-side emotion inference (optional)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   AR         │  │   Avatar      │  │   Animation  │         │
│  │   Renderer   │  │   Loader      │  │   Controller │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  - AR Foundation (ARCore/ARKit)                                  │
│  - Addressable Assets (on-demand model loading)                  │
│  - Real-time lip-sync and animation                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TTS Providers (Direct Client Access)            │
│  - OpenAI Realtime API (viseme stream built-in)                  │
│  - Azure TTS (SAS tokens)                                        │
│  - Google Cloud TTS (OAuth scoped tokens)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Insights (From Chat)

1. **Two-Step Generation Process**
   - LLM generates description (not 3D model)
   - Specialized 3D provider generates actual model
   - This is how major platforms (Meta, TikTok, Snapchat) do it

2. **Client-Side TTS & Animation Processing** ⭐ **NEW** (From Chat Extra)
   - **Critical Insight**: Clients call TTS providers directly (not through backend)
   - Backend only sends text, client handles all audio/viseme processing
   - Reduces backend load by 70-90%
   - Uses ephemeral tokens for secure client-to-provider access
   - Follows patterns from Snapchat, TikTok, Apple Vision Pro, Meta

3. **Client-Side Rendering**
   - All 3D rendering happens on client
   - Server only sends: text + emotion hints (no audio, no visemes)
   - Scales to millions of users

4. **Generate-Once, Reuse-Many**
   - Models generated once per agent
   - Stored in CDN, cached on client
   - Asynchronous generation (webhook/job queue)

---

## Model Generation Strategy

### Critical Insight: LLMs Cannot Generate 3D Models

**Key Finding from Chat**: General-purpose LLMs (OpenAI, Claude, Gemini) **cannot** generate 3D models directly. They can only generate:
- ✅ JSON descriptions
- ✅ Textual style descriptors
- ✅ Tags and personality traits
- ✅ Color palettes
- ❌ **Cannot produce**: .fbx, .glb, .obj, rigged meshes, texture atlases

### Recommended Two-Step Process

#### Step 1: LLM Description Generation

```typescript
// LLM generates structured description from agent profile
interface CharacterDescription {
  style: 'anime' | 'realistic' | 'cartoon' | 'chibi' | 'robot' | 'fantasy';
  subcategory?: string; // e.g., "fantasy ranger", "cyberpunk hacker"
  gender: 'male' | 'female' | 'neutral';
  species: 'human' | 'elf' | 'android' | 'animal' | 'creature';
  bodyType: 'slim' | 'average' | 'strong' | 'small';
  height: string;
  hair: {
    color: string;
    style: string; // e.g., "silver long", "black short"
  };
  eyes: {
    color: string; // e.g., "emerald green", "blue"
  };
  clothing: string; // e.g., "light leather armor", "casual t-shirt"
  colorPalette: string[]; // e.g., ["#2E8B57", "#C0C0C0"]
  expressionBaseline: 'calm' | 'energetic' | 'cute' | 'dramatic';
  build: string; // e.g., "slim athletic", "muscular"
  accessories?: string[]; // e.g., ["glasses", "scarf"]
}

// LLM Prompt Example
const prompt = `
Given this agent profile:
${JSON.stringify(agentProfile, null, 2)}

Generate a detailed character description in JSON format with:
- style, subcategory, gender, species, bodyType
- hair color and style
- eye color
- clothing description
- color palette (2-3 colors)
- expression baseline
- build description
- accessories (if any)

Return only valid JSON.
`;
```

#### Step 2: 3D Model Generation via Specialized Providers

**Provider Comparison** (from chat analysis):

| Provider | Best For | Pros | Cons | Rating |
|----------|----------|------|------|--------|
| **Ready Player Me** | Scalable avatars, AR/Unity | Fully rigged, cross-platform, customizable, production-ready | Not extreme anime style | ⭐⭐⭐⭐⭐ |
| **Meshy.ai** | Anime-style / stylized 3D | Great visual style, text→3D improving | Rig quality varies | ⭐⭐⭐⭐ |
| **Kaedim** | Game-ready meshes | Good auto-3D, stylized | Requires cleanup, rigging | ⭐⭐⭐ |
| **Luma AI** | Realistic 3D | High quality, NeRF-based | Not stylized, no rigging | ⭐⭐ |
| **Live2D** | Anime 2D avatars | AR-capable, great style, easier | Not 3D, limited mobility | ⭐⭐⭐⭐ |
| **OpenAI/Claude** | Descriptions only | Perfect at descriptive JSON | Cannot make 3D at all | ❌ |

**Recommended Architecture**:

```typescript
// Avatar Generator Service
interface AvatarGeneratorService {
  // Step 1: LLM generates description
  async generateDescription(agentProfile: AgentProfile): Promise<CharacterDescription> {
    const prompt = buildDescriptionPrompt(agentProfile);
    const response = await llmService.generate(prompt);
    return JSON.parse(response);
  }
  
  // Step 2: 3D provider generates model
  async generateModel(description: CharacterDescription, style: '3d' | 'anime'): Promise<AvatarModel> {
    let model;
    
    if (style === 'anime') {
      // Use Meshy.ai or Live2D for anime
      model = await meshyAPI.generate(description);
    } else {
      // Use Ready Player Me for 3D
      model = await readyPlayerMeAPI.generate(description);
    }
    
    // Store in CDN
    const modelUrl = await cdnService.upload(model);
    
    return {
      modelId: generateId(),
      modelUrl,
      format: model.format,
      metadata: description
    };
  }
}
```

### Model Generation Workflow

```
Agent Profile Created/Updated
        ↓
Avatar Generator Service Triggered
        ↓
Step 1: LLM (OpenAI/Claude)
  - Generates character description JSON
  - Expands profile details
  - Outputs aesthetic details
        ↓
Step 2: 3D Provider Selection
  - Anime style → Meshy.ai or Live2D
  - 3D style → Ready Player Me
  - Game assets → Kaedim
        ↓
Step 3: Model Generation
  - Provider generates model
  - Model is rigged and animation-ready
        ↓
Step 4: Storage & Distribution
  - Upload to CDN (Azure Blob / S3)
  - Store metadata in MongoDB
  - Cache in CDN
        ↓
Step 5: Client Download
  - Unity Addressables loads model on-demand
  - Model cached locally
  - Ready for AR rendering
```

---

## Speech & Animation Engine

### ⚠️ **ARCHITECTURAL SHIFT: AI Provider Calls via Events** (Phase 2)

**Current (Phase 1)**: AR Avatar Service calls AI providers (LLM, TTS) directly
- Direct API calls from AR Avatar Service to OpenAI, Claude, etc.
- Simple but couples service to providers
- All provider calls go through AR Avatar Service

**Future (Phase 2)**: All AI provider calls go through AI Gateway via events
- AR Avatar Service publishes events for AI operations
- AI Gateway handles all external AI provider calls
- Better separation of concerns
- Centralized AI provider management
- Client-side TTS will still call providers directly (with ephemeral tokens)
- LLM calls (character description) will go through AI Gateway

**Migration Path**:
1. Phase 1: Direct calls (current implementation)
2. Phase 2: Migrate LLM calls to events → AI Gateway
3. Phase 2: TTS moves to client-side (direct provider calls with tokens)
4. Phase 2: Remove TTS routes from API Gateway (client-side only)

### ⚠️ **ARCHITECTURAL SHIFT: Client-Side Processing** (From Chat Extra)

**Critical Update**: Instead of a backend Speech & Animation Engine, **clients call TTS providers directly**.

**Before (Heavier)**:
```
LLM → text → Backend → TTS → Backend → Client (audio + visemes)
```

**After (Lighter)**:
```
LLM → text → Backend → Client (text only)
Client → TTS Provider (direct) → Client (audio + visemes)
```

**Benefits**:
- Backend load reduction: 70-90%
- Backend bandwidth: -70% to -90%
- Backend CPU: -90%
- Memory footprint: -80%
- Better latency (direct provider calls)
- Lower cost (no server processing)

### Ephemeral Token System

**Security Model**: Clients cannot access provider APIs directly with backend keys. Instead, backend issues **ephemeral, scoped, time-limited tokens**.

#### Option A: Provider-Issued Client Tokens
Some providers support this natively:
- OpenAI Realtime API
- Google TTS (OAuth scoped tokens)
- Azure TTS (SAS tokens)

Backend issues short-lived tokens (5 minutes) scoped to:
- `tts.synthesize`
- `tts.viseme_stream`
- `agent.voice.{voiceId}`

#### Option B: Proxy Token Signer (Recommended)
Backend owns real API keys, issues temporary tokens:

```typescript
// Client requests token
POST /api/voice/token
{
  "agentId": "agent_99"
}

// Backend returns
{
  "provider": "openai",
  "voiceId": "agent_voice_bright_01",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 300,  // 5 minutes
  "allowedOperations": ["tts.synthesize", "tts.viseme_stream"],
  "maxInputLength": 5000
}
```

**Security Features**:
- Ephemeral tokens (5-minute expiry)
- Per-agent voiceId restrictions
- Rate limiting
- Token revocation
- User authentication required

### Client-Side Processing Flow

```
Step 1: Backend sends text only
  WebSocket: {
    "type": "ai.message.created",
    "text": "Hello! Let's explore this world together.",
    "emotionHint": "excited",  // Optional, from LLM
    "agentId": "agent_99"
  }

Step 2: Client requests ephemeral token
  POST /api/voice/token
  { "agentId": "agent_99" }
  
  Response: {
    "provider": "openai",
    "voiceId": "agent_voice_bright_01",
    "token": "...",
    "expiresIn": 300
  }

Step 3: Client calls TTS provider directly
  POST https://api.openai.com/v1/audio/speech
  Headers: { Authorization: "Bearer {token}" }
  Body: {
    "text": "Hello! Let's explore this world together.",
    "voice": "agent_voice_bright_01",
    "format": "viseme_stream"
  }
  
  Provider returns:
  - Audio chunks (streaming)
  - Visemes with timing
  - Pitch/energy data

Step 4: Client animates avatar locally
  - Apply visemes → lip sync
  - Apply emotion → face blendshapes
  - Apply gestures → animation clips
  - Play spatial audio in AR
  
  Backend sees ZERO load from this.
```

### Emotion Processing Options

**Option A: LLM Produces Emotion Tags** (Simpler)
```typescript
// LLM includes emotion in response
{
  "text": "Hello! Let's explore!",
  "emotion": "excited",
  "gesture": "wave",
  "intensity": 0.8
}
```
- No backend processing needed
- Client uses directly for animation

**Option B: Client-Side Emotion Classifier** (Offline)
- Unity runs small transformer model (~5-20 MB ONNX)
- Emotion classifier + tone detector
- Works fully offline
- No backend dependency

**Recommendation**: Start with Option A (LLM tags), add Option B (client classifier) for offline support.

### Service Architecture

```typescript
interface SpeechAnimationEngine {
  // Input: Text from AI Gateway
  // Output: Audio + Visemes + Emotion + Gestures
  
  async processText(text: string, agentId: string, context?: ConversationContext): Promise<AnimationData> {
    // 1. Emotion Classification (separate service recommended)
    const emotion = await emotionClassifier.classify(text, context);
    
    // 2. TTS Generation
    const audio = await ttsService.generate(text, {
      voiceId: agent.voiceId,
      emotion: emotion.type,
      language: 'en'
    });
    
    // 3. Viseme Generation
    const visemes = await visemeGenerator.generate(text, audio);
    
    // 4. Gesture Selection
    const gesture = await gestureSelector.select(emotion, text);
    
    return {
      audioUrl: audio.url,
      visemes: visemes.timeline,
      emotion: emotion.type,
      gesture: gesture.type,
      duration: audio.duration
    };
  }
}
```

### TTS Provider Options (from chat)

| Provider | Viseme Support | Quality | Best For |
|----------|----------------|---------|----------|
| **OpenAI Realtime API** | ✅ Built-in viseme stream | High | Real-time streaming |
| **Google Cloud TTS** | ✅ Viseme + pitch | High | Production use |
| **Azure Neural Voices** | ✅ Supports visemes | High | Enterprise |
| **WellSaid Labs** | ⚠️ Limited | Very High | Premium voices |
| **ElevenLabs** | ⚠️ Limited | Very High | Natural voices |

### Emotion Classification Approaches

**Option A: LLM-Based** (from chat)
```typescript
// LLM generates emotion tags in response
{
  "text": "Hello! Want to explore?",
  "emotion": "excited",
  "tone": "friendly",
  "arGesture": "wave",
  "energy": 0.8
}
```

**Option B: Separate Emotion Classifier Service** (Recommended at scale)
```typescript
// Dedicated service analyzes text + context
interface EmotionClassifier {
  classify(text: string, context: ConversationContext): Promise<Emotion>;
}

// Benefits:
// - Keeps LLM clean (text-only)
// - Better separation of concerns
// - Can use specialized models
// - Easier to A/B test
```

### Animation Data Format

```typescript
interface AnimationData {
  audioUrl: string;
  visemes: Array<{
    time: number;      // seconds
    shape: string;     // "A", "O", "E", "M", etc.
    intensity?: number; // 0-1
  }>;
  emotion: {
    type: 'happy' | 'sad' | 'angry' | 'excited' | 'neutral' | 'bashful';
    intensity: number; // 0-1
    duration: number;  // seconds
  };
  gesture?: {
    type: 'point' | 'wave' | 'idle' | 'nod' | 'shake';
    startTime: number;
    duration: number;
  };
  duration: number; // total animation duration
}
```

---

## AR Client Architecture

### Unity AR Foundation (Recommended)

**From Chat**: Unity AR Foundation is the best choice for cross-platform iOS + Android support.

### Client Components (from chat)

```
AR/
  AvatarLoader.cs          // Loads model from CDN (Addressables)
  AvatarAnimator.cs         // Controls animation state machine
  LipSyncController.cs      // Maps visemes to blendshapes
  EmotionController.cs      // Blends facial expressions
  GestureController.cs      // Chooses and plays gesture animations
  ARPlacementController.cs  // Handles AR placement (surface, world, etc.)
  MessageSubscriber.cs      // Listens to WebSocket messages
  AnimationBlender.cs       // Blends multiple animations
```

### Client Pipeline (from chat)

```
Step 1: User opens AR mode
  ↓
Step 2: Client loads agent 3D model (based on agent profile)
  - Unity Addressables downloads from CDN
  - Model is rigged and animation-ready
  ↓
Step 3: Client subscribes to WebSocket messages from Realtime Gateway
  - Listens for AI messages
  - Listens for animation data
  ↓
Step 4: When AI message arrives
  - Client calls Speech & Animation Engine
  - OR receives animation data via WebSocket
  ↓
Step 5: Speech Engine returns:
  - audio clip
  - visemes timeline
  - emotion timeline
  - gesture cues
  ↓
Step 6: Unity animates:
  - Play audio
  - For each viseme: blendshape[shape] = intensity
  - Set emotion → blend in Face_Happy
  - Trigger gesture animation: wave
  ↓
Step 7: Avatar animates + speaks in AR
  - User sees agent speaking in real world
```

### Unity Addressables (from chat)

**Key Feature**: On-demand model loading
- Models downloaded only when needed
- Cached locally after first download
- Supports progressive loading
- Reduces initial app size

---

## Integration Points

### Integration with Realtime Gateway

**From Chat**: WebSocket integration for real-time updates

```typescript
// Realtime Gateway streams to AR client
interface ARMessage {
  type: 'ai.message.created';
  agentId: string;
  text: string;
  animationData?: AnimationData; // Optional, if pre-processed
}

// Client subscribes
realtimeGateway.subscribe('ai.message.created', (message) => {
  if (arView.isActive) {
    // Process message for AR animation
    arView.animateAvatar(message);
  }
});
```

### Integration with Agent Profile

**Extended Profile Schema** (from chat):

```typescript
interface AgentProfileWithAR extends AgentProfile {
  appearance: {
    style: 'anime' | 'realistic' | 'cartoon' | 'chibi' | 'robot' | 'fantasy';
    gender: 'male' | 'female' | 'neutral';
    species: 'human' | 'elf' | 'android' | 'animal' | 'creature';
    bodyType: 'slim' | 'average' | 'strong' | 'small';
    height: string;
    hairColor: string;
    eyeColor: string;
    accessories: string[];
    colorPalette: string[];
    emotionBaseline: 'calm' | 'energetic' | 'cute' | 'dramatic';
  };
  
  avatar: {
    modelId?: string;
    modelUrl?: string;
    modelType?: '3d' | 'anime' | 'live2d';
    status: 'pending' | 'generating' | 'ready' | 'failed';
    voiceId?: string; // For TTS
  };
}
```

---

## Design Comparison & Analysis

### Comparison: Comprehensive Design vs. Practical Approach

| Aspect | Comprehensive Design | Practical Approach (Chat) | Consolidated Approach |
|--------|---------------------|--------------------------|----------------------|
| **Model Generation** | Template-based → Procedural → AI | LLM description → 3D provider | **LLM description → 3D provider** (practical) |
| **3D Providers** | Not specified | Ready Player Me, Meshy, Kaedim | **Ready Player Me (3D), Meshy (anime)** |
| **Speech Engine** | Part of AR Avatar Service | **Separate Speech & Animation Engine** | **Separate service** (better separation) |
| **Emotion** | Mentioned | **Separate classifier service recommended** | **Separate service at scale** |
| **Client Framework** | Unity AR Foundation | Unity AR Foundation + Addressables | **Unity AR Foundation + Addressables** |
| **Integration** | Event-driven | **WebSocket via Realtime Gateway** | **WebSocket + Events** (hybrid) |
| **TTS Providers** | Generic mention | **Specific providers listed** | **OpenAI Realtime, Google Cloud, Azure** |
| **Scaling Strategy** | CDN + caching | **Generate-once, reuse-many** | **Generate-once, client-side rendering** |

### Improvements from Consolidation

#### 1. **Two-Step Model Generation** (From Chat)
- **Upside**: LLMs excel at descriptions, specialized providers excel at 3D
- **Implementation**: LLM → JSON description → 3D provider API
- **Impact**: Better quality, more scalable, production-ready

#### 2. **Separate Speech & Animation Engine** (From Chat)
- **Upside**: Keeps AI Gateway clean, better scalability
- **Implementation**: Dedicated microservice for TTS + visemes + emotion
- **Impact**: Easier to scale, better separation of concerns

#### 3. **Provider-Specific Recommendations** (From Chat)
- **Upside**: Clear provider choices for different use cases
- **Implementation**: Ready Player Me for 3D, Meshy for anime, Live2D for 2D
- **Impact**: Faster implementation, proven solutions

#### 4. **Unity Addressables** (From Chat)
- **Upside**: On-demand loading, smaller app size
- **Implementation**: Addressable Assets system
- **Impact**: Better user experience, faster app startup

#### 5. **WebSocket Integration** (From Chat)
- **Upside**: Real-time updates, lower latency
- **Implementation**: Realtime Gateway streams animation data
- **Impact**: More responsive AR experience

---

## Upsides & Downsides

### Upsides

1. **Scalability** ⭐ **ENHANCED with Client-Side TTS**
   - ✅ Client-side rendering (no server load)
   - ✅ **Client-side TTS processing (70-90% backend load reduction)**
   - ✅ **Backend only handles text (minimal bandwidth)**
   - ✅ Generate-once, reuse-many model strategy
   - ✅ CDN distribution for models
   - ✅ WebSocket for text only (very efficient)
   - ✅ **Each user hits TTS provider directly (distributed load)**

2. **Performance** ⭐ **ENHANCED**
   - ✅ **Direct provider calls (faster, fewer hops)**
   - ✅ **Full-duplex streaming from providers**
   - ✅ **Optimized provider networks**
   - ✅ Unity Addressables for efficient model loading
   - ✅ Local caching reduces bandwidth
   - ✅ Client-side rendering leverages device GPU
   - ✅ **Lower latency (no backend processing delay)**

3. **Cost** ⭐ **NEW BENEFIT**
   - ✅ **No server CPU for TTS processing**
   - ✅ **No server bandwidth for audio streaming**
   - ✅ **No server memory for audio buffering**
   - ✅ **Users consume TTS directly (through your billing)**
   - ✅ **Better margins (no infrastructure overhead)**

4. **Quality**
   - ✅ Specialized 3D providers (Ready Player Me, Meshy) produce high-quality models
   - ✅ LLMs excel at generating detailed descriptions
   - ✅ Professional TTS providers (OpenAI, Google, Azure) for natural voices
   - ✅ **Direct provider access = best quality streams**

5. **Flexibility**
   - ✅ Support multiple styles (3D, anime, Live2D)
   - ✅ Multiple provider options (can switch if needed)
   - ✅ Modular architecture (easy to add features)
   - ✅ **Client can choose provider based on device/capabilities**

6. **Separation of Concerns** ⭐ **ENHANCED**
   - ✅ **Backend only handles text (clean separation)**
   - ✅ **Client handles all media processing**
   - ✅ Emotion classification can be client-side (offline support)
   - ✅ Model generation separate from rendering

7. **Production-Ready**
   - ✅ Uses proven solutions (Ready Player Me, Unity AR Foundation)
   - ✅ Follows patterns from major platforms (Meta, TikTok, Snapchat, Apple Vision Pro)
   - ✅ Industry-standard formats (glTF, VRM, Live2D)
   - ✅ **Ephemeral token pattern (Stripe, Firebase, AWS STS)**

### Downsides / Challenges

1. **Complexity** ⭐ **ENHANCED with Client-Side TTS**
   - ❌ Multiple services to coordinate (Avatar Service, Token Service)
   - ❌ Multiple provider APIs to integrate (Ready Player Me, Meshy, TTS providers)
   - ❌ Unity development requires specialized knowledge
   - ❌ **Client-side TTS integration adds complexity to mobile app**
   - ❌ **Ephemeral token management system needed**
   - ❌ **Client must handle multiple TTS provider SDKs**

2. **Security Concerns** ⭐ **NEW**
   - ❌ **Token management complexity (ephemeral tokens)**
   - ❌ **Risk of token leakage (if client compromised)**
   - ❌ **Need robust token revocation system**
   - ❌ **Rate limiting must be enforced**
   - ❌ **Per-user/per-agent token quotas**

3. **Cost** ⭐ **PARTIALLY MITIGATED**
   - ❌ 3D model generation APIs can be expensive (per model)
   - ✅ **TTS costs moved to client (but still paid by platform)**
   - ❌ CDN storage and bandwidth costs
   - ❌ Unity license costs (if not using Personal edition)
   - ❌ **Token service infrastructure costs**

4. **Latency** ⭐ **IMPROVED**
   - ❌ Model generation can take 5-30 seconds (async)
   - ✅ **TTS latency improved (direct provider calls)**
   - ❌ Model download time (depends on size and connection)
   - ❌ **Token request adds one extra round-trip**

5. **Provider Dependencies** ⭐ **ENHANCED**
   - ❌ Reliance on third-party APIs (Ready Player Me, Meshy, TTS)
   - ❌ API changes can break integration
   - ❌ Provider downtime affects service
   - ❌ **Client directly depends on TTS provider availability**
   - ❌ **Multiple provider SDKs in client app (larger app size)**

6. **Client-Side Challenges** ⭐ **NEW**
   - ❌ **Client must handle TTS provider errors**
   - ❌ **Client must manage token refresh**
   - ❌ **Network issues affect client directly (no backend buffer)**
   - ❌ **Offline support more complex (need cached tokens)**
   - ❌ **Client app size increases (TTS SDKs)**

7. **Model Quality Variability**
   - ❌ Generated models may need manual cleanup
   - ❌ Rig quality varies by provider
   - ❌ Some providers don't support all styles

8. **Device Requirements** ⭐ **ENHANCED**
   - ❌ AR requires ARCore (Android) or ARKit (iOS)
   - ❌ 3D rendering requires capable GPU
   - ❌ Older devices may not support AR
   - ❌ **TTS processing requires network connection**
   - ❌ **Device must handle audio streaming**

9. **Storage & Bandwidth** ⭐ **PARTIALLY MITIGATED**
   - ❌ 3D models can be large (1-10 MB per model)
   - ❌ Multiple models per agent (LOD levels)
   - ✅ **Audio streaming handled by provider (not your bandwidth)**
   - ❌ **Client bandwidth usage increases (direct to provider)**

10. **Testing Complexity** ⭐ **ENHANCED**
    - ❌ AR testing requires physical devices
    - ❌ Different devices have different AR capabilities
    - ❌ Hard to automate AR testing
    - ❌ **Must test token system with real providers**
    - ❌ **Client-side TTS testing more complex**

---

## Open Questions & Recommendations

### 1. **Model Generation Strategy**
- **Question**: Should we generate models on-demand or pre-generate for all agents?
- **Options**:
  - A) On-demand: Generate when agent is first viewed in AR (slower first load, lower storage)
  - B) Pre-generate: Generate all models when agent is created (faster AR load, higher storage)
  - C) Hybrid: Pre-generate popular agents, on-demand for others
- **Original Recommendation**: **Hybrid (C)** - Pre-generate for active agents, on-demand for others
- **Detailed Recommendation**:
  - **Phase 1 (MVP)**: Pre-generate for all agents (simpler, ensures quality)
  - **Phase 2+**: Implement hybrid with smart pre-generation:
    - Pre-generate agents with >10 interactions in last 7 days
    - Pre-generate agents owned by premium users
    - Queue on-demand generation for others (background job)
    - Cache generated models for 30 days, then archive
  - **Storage Strategy**: 
    - Active models: Hot storage (CDN)
    - Inactive models: Cold storage (cheaper, slower access)
    - Archive after 90 days of inactivity

### 2. **Provider Selection**
- **Question**: Should we use one provider or multiple providers based on style?
- **Options**:
  - A) Single provider (Ready Player Me) for all styles
  - B) Multiple providers (Ready Player Me for 3D, Meshy for anime)
  - C) Provider selection based on agent profile
- **Original Recommendation**: **Multiple providers (B)** - Better quality for each style
- **Detailed Recommendation**:
  - **Primary Strategy**: Multiple providers with style-based routing
    - **3D/Realistic**: Ready Player Me (primary), Kaedim (fallback)
    - **Anime/Stylized**: Meshy.ai (primary), Live2D (2D fallback)
    - **Chibi/Cartoon**: Ready Player Me with custom parameters
  - **Fallback Chain**: If primary provider fails → try fallback → use template
  - **Cost Optimization**: 
    - Use cheaper provider for low-priority agents
    - Premium agents get best quality provider
  - **Quality Monitoring**: Track generation success rates, switch providers if quality drops

### 3. **Emotion Classification**
- **Question**: LLM-based vs. separate emotion classifier service?
- **Options**:
  - A) LLM generates emotion tags in response (simpler, but couples LLM)
  - B) Separate emotion classifier service (better separation, more scalable)
  - C) Hybrid: LLM for simple cases, classifier for complex
- **Original Recommendation**: **Separate service (B)** for scale, but start with LLM (A) for MVP
- **Detailed Recommendation**:
  - **Phase 1 (MVP)**: LLM includes emotion tags in response
    - System prompt: "Always include emotion, gesture, intensity in JSON response"
    - Simple, no additional service needed
    - Good enough for initial launch
  - **Phase 2**: Add client-side emotion classifier (offline support)
    - Small ONNX model (~10MB) in Unity
    - Fallback when LLM doesn't provide emotion
    - Works offline
  - **Phase 3**: Separate backend emotion service (if needed)
    - Only if LLM + client-side insufficient
    - Use specialized emotion models (RoBERTa, etc.)
    - Better for complex multi-turn conversations
  - **Best Practice**: Start simple, add complexity only when needed

### 4. **TTS Provider**
- **Question**: Which TTS provider to use?
- **Options**:
  - A) OpenAI Realtime API (viseme stream built-in)
  - B) Google Cloud TTS (viseme + pitch)
  - C) Azure Neural Voices (enterprise features)
  - D) ElevenLabs (natural voices)
- **Original Recommendation**: **OpenAI Realtime (A)** for built-in visemes, or **Google Cloud (B)** for production
- **Detailed Recommendation**:
  - **Primary Choice**: **OpenAI Realtime API**
    - Built-in viseme stream (no separate processing)
    - Real-time streaming (low latency)
    - Good voice quality
    - WebSocket-based (efficient)
  - **Fallback**: **Google Cloud TTS**
    - Better pricing for high volume
    - More voice options
    - Enterprise-grade reliability
    - Requires separate viseme generation
  - **Premium Option**: **ElevenLabs** (for premium users)
    - Best voice quality
    - Most natural sounding
    - Higher cost
  - **Strategy**: 
    - Default: OpenAI Realtime
    - Fallback: Google Cloud (if OpenAI fails)
    - Premium tier: ElevenLabs
  - **Multi-Provider Support**: Client SDK should support multiple providers, switch based on availability

### 5. **Model Format**
- **Question**: glTF, VRM, or Live2D?
- **Options**:
  - A) glTF for all (universal, but not optimized for anime)
  - B) VRM for anime, glTF for 3D (better quality, more complex)
  - C) Live2D for 2D anime (simpler, but limited)
- **Original Recommendation**: **VRM for anime, glTF for 3D (B)** - Best quality for each style
- **Detailed Recommendation**:
  - **Format Selection**:
    - **3D/Realistic**: glTF 2.0 / GLB (universal, well-supported)
    - **Anime 3D**: VRM (VRoid format, optimized for anime)
    - **Anime 2D**: Live2D Cubism (best for 2D anime, easier animation)
  - **Client Support**: Unity should support all three formats
    - glTF: Unity GLTFast plugin
    - VRM: UniVRM plugin
    - Live2D: Live2D Cubism SDK
  - **Conversion Strategy**: 
    - Store in original format from provider
    - Convert to target format if needed (background job)
    - Cache both formats if conversion needed
  - **Performance**: 
    - glTF: Best for 3D, good performance
    - VRM: Optimized for anime, slightly larger files
    - Live2D: Lightweight, best for 2D
  - **Recommendation**: Support all three, choose based on agent style preference

### 6. **AR Placement Mode**
- **Question**: Surface placement, world anchor, or face tracking?
- **Options**:
  - A) Surface placement only (Pokemon Go style)
  - B) Multiple modes (user chooses)
  - C) Auto-detect best mode
- **Original Recommendation**: **Multiple modes (B)** - More flexibility, better UX
- **Detailed Recommendation**:
  - **Primary Mode**: Surface placement (Pokemon Go style)
    - Most intuitive for users
    - Works in most environments
    - Good for group viewing
  - **Secondary Modes**:
    - **Face tracking**: For selfie/video call mode
    - **World anchor**: For persistent placement (future, requires AR Cloud)
    - **Marker-based**: For demos, marketing (optional)
  - **Implementation**:
    - Default: Surface placement
    - User can switch modes in AR settings
    - Auto-fallback: If surface detection fails → try face tracking
  - **UX Flow**:
    1. Open AR → Auto-detect surface
    2. User taps to place avatar
    3. Settings button → Switch mode if needed
  - **Recommendation**: Start with surface placement, add face tracking in Phase 2

### 7. **Animation Quality**
- **Question**: How detailed should animations be?
- **Options**:
  - A) Basic (idle + talking only)
  - B) Medium (idle + talking + gestures)
  - C) Advanced (idle + talking + gestures + emotions + body language)
- **Original Recommendation**: **Start with Medium (B)**, add Advanced (C) in Phase 2
- **Detailed Recommendation**:
  - **Phase 1 (MVP)**: Medium quality
    - Idle animations (breathing, blinking, subtle movements)
    - Talking animations (lip-sync with visemes)
    - Basic gestures (wave, nod, point) - 5-10 gestures
    - Simple emotion expressions (happy, sad, neutral)
  - **Phase 2**: Enhanced animations
    - More gestures (20+ gestures)
    - Emotion blending (smooth transitions)
    - Body language (posture changes, leaning)
    - Context-aware animations (reacts to environment)
  - **Phase 3**: Advanced animations
    - Full body language system
    - Micro-expressions
    - Personality-driven animation style
    - Physics-based hair/clothing
  - **Performance Consideration**: 
    - Low-end devices: Basic animations
    - Mid-range: Medium animations
    - High-end: Advanced animations
  - **Recommendation**: Start Medium, scale based on device capabilities

### 8. **Offline Support**
- **Question**: Should AR work offline?
- **Options**:
  - A) Online only (simpler, requires connection)
  - B) Offline support (cache models + animations, more complex)
- **Original Recommendation**: **Online for MVP (A)**, add offline (B) later
- **Detailed Recommendation**:
  - **Phase 1**: Online only
    - Simpler implementation
    - No cache management complexity
    - Clear error messages when offline
  - **Phase 2**: Partial offline support
    - Cache models locally (downloaded agents)
    - Cache recent TTS audio (last 10 messages)
    - Cache viseme data
    - Show cached avatar, but no new TTS
  - **Phase 3**: Full offline support
    - Client-side TTS fallback (lower quality, offline-capable)
    - Full model cache
    - Queue messages, sync when online
  - **Storage Strategy**:
    - Cache models: Up to 500MB per user
    - Cache audio: Last 50 messages (~10MB)
    - Auto-cleanup: Remove unused models after 30 days
  - **Recommendation**: Start online-only, add partial offline in Phase 2

### 9. **Multi-Agent AR**
- **Question**: Can multiple agents appear in AR simultaneously?
- **Options**:
  - A) Single agent only (simpler)
  - B) Multiple agents (more complex, better for group chats)
- **Original Recommendation**: **Single agent for MVP (A)**, add multi-agent (B) in Phase 2
- **Detailed Recommendation**:
  - **Phase 1**: Single agent only
    - Simpler rendering
    - Lower performance requirements
    - Easier to debug
  - **Phase 2**: Multiple agents (2-3 agents)
    - Group chat scenarios
    - Agents can interact with each other
    - Performance optimization needed (LOD, culling)
  - **Phase 3**: Many agents (5+)
    - Conference/meeting scenarios
    - Advanced performance optimizations
    - Agent positioning algorithms
  - **Technical Considerations**:
    - Performance: Each agent = more polygons, animations, audio
    - Positioning: Need algorithm to place agents in space
    - Interaction: Agents should face each other when talking
    - Culling: Hide agents outside camera view
  - **Recommendation**: Start single, add 2-3 agents in Phase 2, scale up later

### 10. **Model Customization**
- **Question**: Can users customize agent avatars?
- **Options**:
  - A) Fixed based on profile (simpler)
  - B) User can customize (clothing, colors, etc.)
  - C) Owner can customize, users see fixed version
- **Original Recommendation**: **Owner customization (C)** - Balance between flexibility and simplicity
- **Detailed Recommendation**:
  - **Phase 1**: Fixed based on profile
    - Avatar generated from agent profile
    - No customization (simpler)
    - Consistent appearance for all users
  - **Phase 2**: Owner customization
    - Agent owner can customize:
      - Clothing/accessories
      - Colors (hair, eyes, clothing)
      - Accessories (glasses, hats, etc.)
    - Users see owner's customized version
    - Regenerate model when customization changes
  - **Phase 3**: User customization (optional)
    - Users can apply "skins" or "outfits"
    - Client-side only (no server regeneration)
    - Premium feature
  - **Customization Limits**:
    - Owner: Full customization (regenerates model)
    - User: Surface-level (textures, colors) - client-side only
  - **Recommendation**: Start fixed, add owner customization in Phase 2

### 11. **Performance Optimization**
- **Question**: LOD (Level of Detail) system?
- **Options**:
  - A) Single model (simpler, may be slow on low-end devices)
  - B) LOD system (high/medium/low quality based on distance)
  - C) Device-based (high-end gets high quality, low-end gets low quality)
- **Original Recommendation**: **LOD system (B)** - Better performance, scales to all devices
- **Detailed Recommendation**:
  - **LOD Strategy**: Distance-based + Device-based hybrid
    - **Distance-based LOD**:
      - Close (< 2m): High quality (15K triangles)
      - Medium (2-5m): Medium quality (8K triangles)
      - Far (> 5m): Low quality (3K triangles)
    - **Device-based fallback**:
      - High-end: Always use high quality
      - Mid-range: Use medium quality, switch to low if FPS drops
      - Low-end: Use low quality, disable advanced features
  - **Implementation**:
    - Generate 3 LOD versions per model
    - Store all in CDN
    - Client switches based on distance + device capability
    - Smooth transitions between LOD levels
  - **Additional Optimizations**:
    - Texture compression (KTX2, Basis Universal)
    - Animation culling (disable animations for far avatars)
    - Occlusion culling (hide avatars behind objects)
    - Frustum culling (hide avatars outside camera view)
  - **Recommendation**: Implement LOD system from Phase 1, essential for performance

### 12. **Cost Management**
- **Question**: How to manage costs for model generation and TTS?
- **Options**:
  - A) Unlimited (may be expensive)
  - B) Per-agent limits (e.g., 1 model per agent)
  - C) Subscription tiers (free: basic, premium: advanced)
- **Original Recommendation**: **Per-agent limits (B)** for MVP, add tiers (C) later
- **Detailed Recommendation**:
  - **Model Generation Costs**:
    - **Free tier**: 1 model per agent (regeneration costs credits)
    - **Premium tier**: Unlimited model regenerations
    - **Cost per model**: ~$0.10-0.50 (depending on provider)
  - **TTS Costs** (client-side, but billed through platform):
    - **Free tier**: 10K characters/month per user
    - **Premium tier**: 100K characters/month
    - **Enterprise**: Unlimited
    - **Cost per character**: ~$0.000015 (OpenAI)
  - **Cost Controls**:
    - Rate limiting: Max 100 TTS requests/hour per user
    - Budget alerts: Warn users at 80% of limit
    - Auto-pause: Pause TTS when limit reached
  - **Revenue Model**:
    - Users pay for TTS usage (markup on provider cost)
    - Premium subscriptions include higher limits
    - Model generation: One-time fee or included in premium
  - **Recommendation**: 
    - Start with generous free tier (attract users)
    - Add premium tiers as usage grows
    - Monitor costs closely, adjust limits based on actual usage

### 13. **Client-Side TTS Architecture** ⭐ **NEW**
- **Question**: Should clients call TTS providers directly or go through backend?
- **Options**:
  - A) Client-side TTS (direct provider calls with ephemeral tokens)
  - B) Backend TTS service (backend processes, streams to client)
  - C) Hybrid (backend for some, client for others)
- **Original Recommendation**: **Client-side (A)** for scale, but start with backend (B) for MVP simplicity
- **Detailed Recommendation**:
  - **Phase 1 (MVP)**: Backend TTS service
    - Simpler to implement
    - Easier to debug
    - Centralized control
    - Good for initial launch (< 1000 concurrent users)
  - **Phase 2**: Migrate to client-side TTS
    - When user base grows (> 1000 concurrent)
    - Implement ephemeral token system
    - Migrate gradually (feature flag)
  - **Phase 3**: Full client-side
    - All TTS processing on client
    - Backend only issues tokens
    - Scales to millions
  - **Migration Strategy**:
    - Feature flag: `ENABLE_CLIENT_SIDE_TTS`
    - A/B test: 10% users → 50% → 100%
    - Monitor: Latency, error rates, costs
    - Rollback plan: Can switch back to backend if issues
  - **Recommendation**: Start backend for MVP, migrate to client-side when scaling

### 14. **Token Management Strategy** ⭐ **NEW**
- **Question**: How to manage ephemeral tokens for client TTS access?
- **Options**:
  - A) Short-lived tokens (5 minutes), frequent refresh
  - B) Longer-lived tokens (1 hour), less frequent refresh
  - C) Session-based tokens (valid for entire AR session)
- **Original Recommendation**: **Short-lived (A)** for security, with automatic refresh
- **Detailed Recommendation**:
  - **Token Lifetime**: 5 minutes (short-lived)
    - Balance between security and refresh frequency
    - Short enough to limit damage if compromised
    - Long enough to avoid excessive refresh calls
  - **Refresh Strategy**: Proactive refresh
    - Refresh at 80% of lifetime (4 minutes)
    - Background refresh (don't wait for expiry)
    - Cache new token before old expires
    - Seamless transition (no interruption)
  - **Token Scope**:
    - Scoped to specific agent voice
    - Scoped to TTS operations only
    - Rate limited (e.g., 100 requests/hour)
    - Max text length (e.g., 5000 characters)
  - **Security Features**:
    - JWT-based tokens (signed by backend)
    - Include user ID, agent ID, timestamp
    - Revocation list (if token compromised)
    - Audit logging (track token usage)
  - **Error Handling**:
    - If token expires: Auto-refresh, retry request
    - If refresh fails: Fallback to backend TTS (temporary)
    - If revoked: Request new token, log incident
  - **Recommendation**: 5-minute tokens with proactive refresh at 4 minutes

### 15. **TTS Provider Selection for Client** ⭐ **NEW**
- **Question**: Which TTS provider should clients use?
- **Options**:
  - A) OpenAI Realtime API (built-in visemes, streaming)
  - B) Google Cloud TTS (OAuth tokens, good quality)
  - C) Azure TTS (SAS tokens, enterprise features)
  - D) Multiple providers (client chooses based on device)
- **Original Recommendation**: **OpenAI Realtime (A)** for MVP (best viseme support), add others (D) later
- **Detailed Recommendation**:
  - **Primary Provider**: OpenAI Realtime API
    - Best viseme support (built-in)
    - Real-time streaming
    - Good voice quality
    - WebSocket-based (efficient)
  - **Fallback Providers**:
    - Google Cloud TTS (if OpenAI down)
    - Azure TTS (enterprise customers)
  - **Provider Selection Logic**:
    - Default: OpenAI Realtime
    - If OpenAI fails → Try Google Cloud
    - If both fail → Fallback to backend TTS (temporary)
    - Premium users: Can choose provider preference
  - **Client SDK Design**:
    - Abstract provider interface
    - Plugin architecture (easy to add providers)
    - Automatic failover
    - Provider health monitoring
  - **Cost Optimization**:
    - Use cheaper provider for non-premium users
    - Premium users get best quality
    - Monitor costs per provider
  - **Recommendation**: Start with OpenAI Realtime, add Google Cloud as fallback

### 16. **Emotion Processing Location** ⭐ **NEW**
- **Question**: Where should emotion classification happen?
- **Options**:
  - A) LLM includes emotion in response (simplest)
  - B) Backend emotion classifier service
  - C) Client-side emotion classifier (offline support)
  - D) Hybrid (LLM for simple, classifier for complex)
- **Original Recommendation**: **LLM tags (A)** for MVP, add client-side (C) for offline support
- **Detailed Recommendation**:
  - **Phase 1**: LLM includes emotion tags
    - System prompt: "Always respond with emotion, gesture, intensity"
    - JSON response format
    - No additional service needed
    - Works well for most cases
  - **Phase 2**: Add client-side classifier
    - Small ONNX model (~10MB) in Unity
    - Fallback when LLM doesn't provide emotion
    - Works offline
    - Fast inference (< 50ms)
  - **Phase 3**: Hybrid approach (if needed)
    - LLM for primary emotion
    - Client-side for fine-grained emotions
    - Backend classifier for complex multi-turn conversations
  - **Emotion Granularity**:
    - Basic: happy, sad, angry, neutral, excited
    - Advanced: 20+ emotions (surprised, confused, thoughtful, etc.)
  - **Recommendation**: Start with LLM tags, add client-side classifier for offline/fallback

### 17. **Token Security & Abuse Prevention** ⭐ **NEW**
- **Question**: How to prevent token abuse?
- **Options**:
  - A) Rate limiting per token
  - B) Per-user quotas
  - C) Per-agent restrictions
  - D) All of the above
- **Original Recommendation**: **All of the above (D)** - Multi-layer security
- **Detailed Recommendation**:
  - **Multi-Layer Security**:
    1. **Token-level**: Rate limit per token (100 requests/hour)
    2. **User-level**: Per-user quotas (10K characters/day free, 100K premium)
    3. **Agent-level**: Per-agent restrictions (only specific voice IDs)
    4. **IP-level**: Detect suspicious patterns (multiple tokens from same IP)
    5. **Device-level**: Device fingerprinting (detect token sharing)
  - **Token Scoping**:
    - Scoped to specific agent voice ID
    - Scoped to TTS operations only
    - Cannot access other APIs
    - Max text length per request (5000 chars)
  - **Monitoring & Detection**:
    - Track token usage patterns
    - Alert on anomalies (sudden spike, unusual patterns)
    - Auto-revoke suspicious tokens
    - Log all token requests for audit
  - **Abuse Prevention**:
    - Rate limiting: 100 requests/hour per token
    - Quota limits: Per-user daily/monthly limits
    - Cooldown: If limit exceeded, wait before retry
    - Graduated response: Warn → Throttle → Block
  - **Recommendation**: Implement all layers, start strict, relax based on usage patterns

### 18. **Offline Support with Client-Side TTS** ⭐ **NEW**
- **Question**: How to handle offline scenarios?
- **Options**:
  - A) Online only (simpler, requires connection)
  - B) Cache tokens for offline use (limited)
  - C) Client-side TTS fallback (lower quality, offline-capable)
  - D) Queue requests, process when online
- **Original Recommendation**: **Online only (A)** for MVP, add queue (D) for better UX
- **Detailed Recommendation**:
  - **Phase 1**: Online only
    - Clear error message when offline
    - Disable AR mode if no connection
    - Simple, no cache complexity
  - **Phase 2**: Partial offline support
    - Cache models (downloaded agents work offline)
    - Cache recent TTS audio (last 10-20 messages)
    - Cache viseme data
    - Show cached avatar, but no new TTS
    - Queue new messages, sync when online
  - **Phase 3**: Full offline support
    - Client-side TTS fallback (e.g., iOS AVSpeechSynthesizer)
    - Lower quality, but works offline
    - Full message queue with sync
    - Offline indicator in UI
  - **Offline Features**:
    - Model cache: Up to 500MB
    - Audio cache: Last 50 messages (~10MB)
    - Message queue: Up to 100 messages
    - Auto-sync: When connection restored
  - **Recommendation**: Start online-only, add partial offline (Phase 2), full offline (Phase 3)

### 19. **Provider Failover** ⭐ **NEW**
- **Question**: What if TTS provider is down?
- **Options**:
  - A) Show error to user
  - B) Fallback to another provider
  - C) Fallback to backend TTS service
  - D) Queue and retry
- **Original Recommendation**: **Fallback provider (B)** with backend fallback (C) as last resort
- **Detailed Recommendation**:
  - **Failover Chain**:
    1. **Primary**: OpenAI Realtime API
    2. **Fallback 1**: Google Cloud TTS (if OpenAI fails)
    3. **Fallback 2**: Azure TTS (if Google fails)
    4. **Fallback 3**: Backend TTS service (if all providers fail)
    5. **Last Resort**: Show text-only (no audio)
  - **Failure Detection**:
    - Timeout: 5 seconds
    - Error codes: 5xx = retry, 4xx = skip
    - Health check: Ping provider every 30 seconds
    - Circuit breaker: If provider fails 3 times, mark as down for 5 minutes
  - **User Experience**:
    - Seamless failover (user doesn't notice)
    - Show indicator if using fallback
    - Graceful degradation (text-only if all fail)
    - Retry failed requests when provider recovers
  - **Monitoring**:
    - Track provider uptime
    - Alert on provider failures
    - Log failover events
    - Dashboard: Provider health status
  - **Recommendation**: Multi-level failover chain, seamless to user

### 20. **Token Refresh Strategy** ⭐ **NEW**
- **Question**: How should clients refresh expired tokens?
- **Options**:
  - A) Proactive refresh (before expiry)
  - B) Reactive refresh (on expiry error)
  - C) Background refresh (continuous)
- **Original Recommendation**: **Proactive refresh (A)** - Better UX, fewer errors
- **Detailed Recommendation**:
  - **Refresh Strategy**: Proactive refresh
    - Refresh at 80% of token lifetime (4 minutes for 5-minute token)
    - Background refresh (don't block user)
    - Cache new token before old expires
    - Seamless transition (no interruption)
  - **Implementation**:
    - Timer: Check token age every 30 seconds
    - If age > 80% of lifetime → Request new token
    - Store new token, use when old expires
    - If refresh fails → Retry with exponential backoff
  - **Error Handling**:
    - If refresh fails: Use old token until expiry
    - If token expires during use: Immediate refresh, retry request
    - If refresh consistently fails: Fallback to backend TTS
  - **Optimization**:
    - Batch refresh: Refresh multiple tokens at once
    - Pre-fetch: Refresh before needed (predictive)
    - Cache: Store tokens in secure storage
  - **Security**:
    - Refresh requires user authentication
    - Rate limit refresh requests (prevent abuse)
    - Log refresh events for audit
  - **Recommendation**: Proactive refresh at 80% lifetime, with fallback handling

---

## Recommended Architecture Decisions

Based on the consolidated design, here are the recommended decisions:

### Model Generation
- ✅ **Two-step process**: LLM generates description → 3D provider generates model
- ✅ **Multiple providers**: Ready Player Me (3D), Meshy (anime), Live2D (2D anime)
- ✅ **Hybrid generation**: Pre-generate popular agents, on-demand for others

### Speech & Animation ⭐ **UPDATED**
- ✅ **Client-side TTS**: Clients call TTS providers directly (not through backend)
- ✅ **Ephemeral tokens**: Backend issues short-lived, scoped tokens for client TTS access
- ✅ **TTS provider**: OpenAI Realtime API (built-in visemes, streaming) recommended
- ✅ **Emotion**: LLM includes emotion tags (MVP), client-side classifier for offline (future)
- ✅ **Backend role**: Only sends text, issues tokens, no audio/viseme processing

### Client Architecture
- ✅ **Framework**: Unity AR Foundation (cross-platform)
- ✅ **Model loading**: Unity Addressables (on-demand)
- ✅ **Format**: glTF for 3D, VRM for anime, Live2D for 2D

### Integration ⭐ **UPDATED**
- ✅ **Real-time**: WebSocket via Realtime Gateway (text only)
- ✅ **Events**: Event-driven for model generation triggers
- ✅ **TTS**: Direct client-to-provider calls (with ephemeral tokens)
- ✅ **Data flow**: Backend → text, Client → TTS provider → audio/visemes

### Storage & Delivery
- ✅ **CDN**: Azure Blob / S3 with CDN distribution
- ✅ **Caching**: Client-side caching with Addressables
- ✅ **Optimization**: LOD system for performance

---

## Next Steps

1. **Review this consolidated design** with the team
2. **Answer open questions** based on business priorities
3. **Choose providers** (Ready Player Me, Meshy, TTS provider)
4. **Create execution plan** (similar to Ad Service plan)
5. **Start Phase 1 implementation** (MVP with template models)

---

## References

- Comprehensive Design: `docs/ar-avatar-design.md`
- Practical Approach: `docs/ar/ar-chat.md`
- Client-Side Processing: `docs/ar/ar-chat-extra..md`
- Ready Player Me: https://readyplayer.me/
- Meshy.ai: https://www.meshy.ai/
- Unity AR Foundation: https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@latest
- OpenAI Realtime API: https://platform.openai.com/docs/guides/realtime
- Ephemeral Token Patterns: Stripe, Firebase, AWS STS, Supabase

