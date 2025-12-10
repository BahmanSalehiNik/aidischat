# AR Avatar System - Design Document

## Overview

This document describes the design for an Augmented Reality (AR) avatar system that creates 3D or anime-style models based on agent profiles. These avatars can appear in AR space (similar to Pokemon Go) and animate with lip-sync when agents receive text from AI providers.

**Inspired by**: Pokemon Go AR, Ready Player Me, VRoid, Live2D

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [3D Model System](#3d-model-system)
3. [Model Generation & Selection](#model-generation--selection)
4. [AR Rendering System](#ar-rendering-system)
5. [Animation & Lip-Sync](#animation--lip-sync)
6. [Integration with Agent System](#integration-with-agent-system)
7. [Mobile App Integration](#mobile-app-integration)
8. [Model Storage & Delivery](#model-storage--delivery)
9. [Technical Stack](#technical-stack)
10. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Profile Service                          │
│  (Contains: age, gender, hairColor, eyeColor, personality, etc.)  │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AR Avatar Service                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Model      │  │   Model     │  │   Animation  │         │
│  │   Generator  │  │   Selector  │  │   Controller │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Lip-Sync   │  │   Model      │  │   AR         │         │
│  │   Engine     │  │   Store      │  │   Renderer   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Chat Service                                │
│  (Sends text messages → triggers lip-sync animation)              │
└──────────────────────────┬───────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile App (AR View)                          │
│  - AR Camera View                                                │
│  - 3D Model Rendering                                            │
│  - Real-time Animation                                           │
│  - Lip-sync during speech                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **AR Avatar Service**: Backend service managing avatar models
2. **Model Generator**: Creates/selects 3D models from agent profiles
3. **Model Store**: Stores and serves 3D model files
4. **Animation Controller**: Manages animations (idle, talking, gestures)
5. **Lip-Sync Engine**: Synchronizes mouth movements with speech
6. **AR Renderer**: Mobile app component for AR rendering

---

## 3D Model System

### Model Types

#### 1. **3D Models (Full 3D)**
- **Format**: glTF 2.0 / GLB (recommended), FBX, OBJ
- **Style**: Realistic, stylized, or anime-inspired
- **Polygon Count**: 5K-15K triangles (mobile optimized)
- **Textures**: Diffuse, normal, emissive maps
- **Rigging**: Humanoid rig (bones for animation)

**Use Cases**:
- Human agents
- Fantasy characters
- Realistic avatars

#### 2. **Anime Models (2.5D)**
- **Format**: Live2D Cubism, VRM (VRoid), or custom 2D sprite sheets
- **Style**: Anime/manga aesthetic
- **Rigging**: 2D bone system (Live2D) or 3D bones (VRM)

**Use Cases**:
- Anime-style agents
- Mascot characters
- Stylized avatars

#### 3. **Hybrid Models**
- **Format**: 3D base with 2D face overlay
- **Style**: 3D body, 2D anime face
- **Best of both worlds**: 3D movement + anime aesthetic

### Model Structure

```typescript
interface AvatarModel {
  modelId: string;
  agentId: string;
  
  // Model Metadata
  type: '3d' | 'anime' | 'hybrid';
  format: 'glb' | 'vrm' | 'live2d' | 'fbx';
  version: number;
  
  // Model Files
  files: {
    model: string;        // Main model file URL
    textures?: string[];  // Texture file URLs
    animations?: string[]; // Animation file URLs
    metadata?: string;    // Metadata JSON URL
  };
  
  // Model Properties
  properties: {
    polygonCount: number;
    textureResolution: number;
    boneCount: number;
    animationCount: number;
  };
  
  // Rendering Settings
  rendering: {
    scale: number;       // Default scale in AR
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
  
  // Animation Configuration
  animations: {
    idle: string;        // Idle animation name
    talking: string;     // Talking animation name
    gestures: string[];  // Available gesture animations
  };
  
  // Lip-Sync Configuration
  lipSync: {
    enabled: boolean;
    method: 'viseme' | 'bone' | 'blendshape';
    visemeMap?: Record<string, string>; // Phoneme → viseme mapping
  };
  
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Model Generation & Selection

### Model Generation Approaches

#### Approach 1: Template-Based Selection (Phase 1)
**How it works**:
- Pre-built model library with variations
- Match agent profile to closest template
- Apply customization (colors, textures)

**Pros**:
- Fast generation (< 1 second)
- Consistent quality
- Lower storage costs

**Cons**:
- Limited uniqueness
- Requires large template library

**Implementation**:
```typescript
interface ModelTemplate {
  templateId: string;
  baseModel: string; // Base model file
  
  // Customization Parameters
  customizable: {
    hairColor: string[];
    eyeColor: string[];
    skinTone: string[];
    clothing: string[];
    accessories: string[];
  };
  
  // Profile Matching Rules
  matching: {
    gender?: string[];
    ageRange?: string[];
    breed?: string[];
    profession?: string[];
  };
}

// Selection Algorithm
function selectModel(agentProfile: AgentProfile): ModelTemplate {
  // 1. Filter by gender, age, breed
  const candidates = templates.filter(t => 
    matchesProfile(t, agentProfile)
  );
  
  // 2. Score by profile similarity
  const scored = candidates.map(t => ({
    template: t,
    score: calculateSimilarity(t, agentProfile)
  }));
  
  // 3. Select best match
  return scored.sort((a, b) => b.score - a.score)[0].template;
}
```

#### Approach 2: Procedural Generation (Phase 2+)
**How it works**:
- Generate models procedurally from profile
- Use ML models for face/body generation
- Customize based on profile attributes

**Pros**:
- Unique models per agent
- Better profile matching
- Scalable

**Cons**:
- Slower generation (5-30 seconds)
- Requires ML infrastructure
- Higher compute costs

**Implementation**:
```typescript
// Procedural Generation Pipeline
async function generateModel(agentProfile: AgentProfile): Promise<AvatarModel> {
  // 1. Extract features from profile
  const features = extractFeatures(agentProfile);
  
  // 2. Generate base mesh
  const baseMesh = await generateBaseMesh(features);
  
  // 3. Apply textures and colors
  const textured = await applyTextures(baseMesh, features);
  
  // 4. Rig and animate
  const rigged = await rigModel(textured);
  
  // 5. Export to target format
  const model = await exportModel(rigged, 'glb');
  
  return model;
}
```

#### Approach 3: AI-Generated Models (Phase 3+)
**How it works**:
- Use AI models (Stable Diffusion, DALL-E) for texture generation
- Use 3D generation models (DreamFusion, etc.)
- Fine-tune based on agent profile

**Pros**:
- Most unique and creative
- Can match any profile description
- Future-proof

**Cons**:
- Very slow (30-60 seconds)
- Expensive compute
- Quality may vary

### Profile-to-Model Mapping

```typescript
interface ProfileMapping {
  // Physical Attributes → Model Parameters
  physical: {
    gender: string → 'male' | 'female' | 'neutral' base model
    age: number → age-appropriate model proportions
    height: string → model scale
    build: string → body shape parameters
    hairColor: string → hair texture/material color
    eyeColor: string → eye texture color
    skinTone: string → skin texture color
    breed: string → species-specific model (if applicable)
  };
  
  // Personality → Animation Style
  personality: {
    personality: string[] → animation intensity, gesture frequency
    communicationStyle: string → talking animation speed
    speechPattern: string → lip-sync style
  };
  
  // Profession → Clothing/Accessories
  profession: {
    profession: string → profession-specific clothing/accessories
    role: string → role-appropriate appearance
  };
  
  // Visual Style → Model Style
  visual: {
    colorScheme: { primaryColor, secondaryColor } → model color accents
    tags: string[] → style tags (anime, realistic, fantasy, etc.)
  };
}

// Example Mapping
const mapping: ProfileMapping = {
  physical: {
    gender: 'female',
    age: 25,
    hairColor: 'blonde',
    eyeColor: 'blue',
    skinTone: 'fair',
    build: 'slim'
  },
  personality: {
    personality: ['friendly', 'energetic'],
    communicationStyle: 'casual',
    speechPattern: 'fast-paced'
  },
  profession: {
    profession: 'chef',
    role: 'culinary expert'
  },
  visual: {
    colorScheme: { primaryColor: '#FF6B6B', secondaryColor: '#4ECDC4' },
    tags: ['anime', 'cute']
  }
};

// Result: Anime-style female chef model with blonde hair, blue eyes,
//        friendly/energetic animations, fast speech pattern
```

---

## AR Rendering System

### AR Framework Selection

#### Option 1: ARCore (Android) + ARKit (iOS) - Native
**Pros**:
- Best performance
- Native platform features
- Best AR tracking

**Cons**:
- Platform-specific code
- More development effort

#### Option 2: Unity AR Foundation (Recommended)
**Pros**:
- Cross-platform (iOS + Android)
- Mature AR framework
- Good 3D rendering
- Large community

**Cons**:
- Requires Unity knowledge
- Larger app size

#### Option 3: React Native + ViroReact / Expo AR
**Pros**:
- JavaScript/TypeScript
- Easier integration with existing React Native app
- Faster development

**Cons**:
- Lower performance than native
- Limited AR features

**Recommendation**: **Unity AR Foundation** for best balance of performance and cross-platform support.

### AR Rendering Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  AR Camera Feed                                                  │
│  (ARCore/ARKit tracking)                                         │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AR Session Manager                                              │
│  - Plane detection                                               │
│  - Hit testing                                                   │
│  - Anchor management                                             │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  3D Model Loader                                                 │
│  - Load model from CDN                                           │
│  - Parse glTF/VRM format                                         │
│  - Load textures                                                 │
│  - Initialize animations                                         │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  AR Anchor                                                       │
│  - Place model in AR space                                       │
│  - Track position relative to camera                            │
│  - Handle model scaling/rotation                                 │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Animation Controller                                            │
│  - Play idle animation                                           │
│  - Trigger talking animation on speech                          │
│  - Handle gesture animations                                    │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Lip-Sync Engine                                                 │
│  - Receive text/audio from AI                                    │
│  - Generate visemes/phonemes                                     │
│  - Animate mouth in real-time                                    │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Render Pipeline                                                 │
│  - Render 3D model                                               │
│  - Apply lighting                                                │
│  - Composite with AR camera feed                                │
└─────────────────────────────────────────────────────────────────┘
```

### AR Placement Modes

#### 1. **Surface Placement** (Pokemon Go style)
- User taps on detected surface
- Model appears at tap location
- Model stays anchored to surface

```typescript
interface SurfacePlacement {
  mode: 'surface';
  detection: {
    planeDetection: boolean;
    horizontalPlanes: boolean;
    verticalPlanes: boolean;
  };
  placement: {
    onTap: boolean;
    autoPlace: boolean;
    minDistance: number; // meters from camera
    maxDistance: number;
  };
}
```

#### 2. **World Anchored**
- Model placed at fixed world position
- Persists across AR sessions
- Requires AR Cloud (future)

#### 3. **Face Tracking** (Selfie mode)
- Model appears in front of user's face
- Follows face movement
- Good for video calls

#### 4. **Marker-Based** (Optional)
- Place model on QR code/marker
- Good for demos, marketing

---

## Animation & Lip-Sync

### Animation System

#### Animation Types

1. **Idle Animations**
   - Breathing
   - Subtle movements
   - Blinking
   - Occasional gestures

2. **Talking Animations**
   - Mouth movements (lip-sync)
   - Facial expressions
   - Head movements
   - Body gestures

3. **Gesture Animations**
   - Hand gestures
   - Body language
   - Emotion expressions

4. **Transition Animations**
   - Idle → Talking
   - Talking → Idle
   - Gesture transitions

### Lip-Sync Implementation

#### Method 1: Viseme-Based (Recommended for 3D)
**How it works**:
- Map phonemes to visemes (visual mouth shapes)
- Play viseme animations based on speech

**Viseme Set** (Oculus/Facebook standard):
```
- Silence (mouth closed)
- A, I (wide open)
- E (slight open)
- O, U (rounded)
- W, Q (puckered)
- M, B, P (closed lips)
- F, V (teeth on lip)
- L (tongue up)
- Th (tongue out)
- etc.
```

**Implementation**:
```typescript
interface LipSyncEngine {
  // Convert text to phonemes
  textToPhonemes(text: string): Phoneme[];
  
  // Convert phonemes to visemes
  phonemesToVisemes(phonemes: Phoneme[]): Viseme[];
  
  // Animate model based on visemes
  animateVisemes(visemes: Viseme[], timing: number[]): void;
}

// Example
const text = "Hello, how are you?";
const phonemes = textToPhonemes(text);
// → ['HH', 'EH', 'L', 'OW', ',', 'HH', 'AW', 'AA', 'R', 'Y', 'UW', '?']

const visemes = phonemesToVisemes(phonemes);
// → ['silence', 'A', 'L', 'O', 'silence', 'A', 'O', 'A', 'L', 'A', 'U', 'silence']

animateVisemes(visemes, [0, 0.1, 0.2, 0.3, 0.4, ...]);
```

#### Method 2: Audio-Based (Real-time)
**How it works**:
- Analyze audio waveform in real-time
- Extract frequency bands
- Map to mouth shapes

**Pros**:
- Works with any audio
- Real-time synchronization

**Cons**:
- Requires audio stream
- More complex

#### Method 3: Blendshape-Based (3D Models)
**How it works**:
- Use blendshapes (morph targets) for mouth shapes
- Interpolate between blendshapes
- Smooth transitions

**Implementation**:
```typescript
interface BlendshapeLipSync {
  blendshapes: {
    'mouth_open': number;      // 0-1
    'mouth_wide': number;      // 0-1
    'mouth_round': number;     // 0-1
    'mouth_pucker': number;    // 0-1
    'mouth_smile': number;     // 0-1
    // ... more blendshapes
  };
  
  visemeToBlendshape(viseme: Viseme): BlendshapeValues;
}
```

### Real-Time Speech Processing

```typescript
// Flow: AI Text → TTS → Audio → Lip-Sync
interface SpeechPipeline {
  // 1. Receive text from AI
  onAIMessage(text: string, agentId: string): void;
  
  // 2. Convert to speech (TTS)
  async textToSpeech(text: string, voiceId: string): Promise<AudioBuffer>;
  
  // 3. Analyze audio for lip-sync
  analyzeAudio(audio: AudioBuffer): {
    visemes: Viseme[];
    timing: number[];
    emotions?: Emotion[];
  };
  
  // 4. Animate model
  animateModel(agentId: string, visemes: Viseme[], timing: number[]): void;
}
```

### Emotion & Expression

```typescript
interface EmotionSystem {
  // Detect emotion from text
  detectEmotion(text: string): Emotion;
  
  // Map emotion to facial expression
  emotionToExpression(emotion: Emotion): Expression;
  
  // Animate expression
  animateExpression(expression: Expression, intensity: number): void;
}

type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral' | 'excited';

interface Expression {
  eyebrows: 'raised' | 'lowered' | 'neutral';
  eyes: 'wide' | 'narrow' | 'closed' | 'neutral';
  mouth: 'smile' | 'frown' | 'open' | 'neutral';
  intensity: number; // 0-1
}
```

---

## Integration with Agent System

### Agent Profile Integration

```typescript
// Extend AgentProfile model
interface AgentProfileWithAvatar extends AgentProfile {
  avatar: {
    modelId?: string;
    modelType?: '3d' | 'anime' | 'hybrid';
    modelUrl?: string;
    status: 'pending' | 'generating' | 'ready' | 'failed';
    generatedAt?: Date;
    customization?: {
      hairColor?: string;
      eyeColor?: string;
      clothing?: string;
      accessories?: string[];
    };
  };
}
```

### Event-Driven Integration

```typescript
// Events
interface AgentAvatarEvents {
  // Agent created → generate avatar
  'agent.created': {
    agentId: string;
    profile: AgentProfile;
  };
  
  // Agent profile updated → regenerate avatar if needed
  'agent.profile.updated': {
    agentId: string;
    profile: AgentProfile;
    changedFields: string[];
  };
  
  // Avatar generated → notify client
  'agent.avatar.generated': {
    agentId: string;
    modelId: string;
    modelUrl: string;
  };
  
  // AI message → trigger animation
  'ai.message.created': {
    agentId: string;
    roomId: string;
    text: string;
    audioUrl?: string;
  };
}
```

### API Integration

```typescript
// AR Avatar Service APIs
interface AvatarServiceAPI {
  // Generate avatar for agent
  POST /api/avatars/generate
  Request: { agentId: string; profile: AgentProfile }
  Response: { modelId: string; status: 'generating' | 'ready' }
  
  // Get avatar model
  GET /api/avatars/:agentId
  Response: { model: AvatarModel; modelUrl: string }
  
  // Update avatar customization
  PUT /api/avatars/:agentId/customize
  Request: { customization: CustomizationOptions }
  Response: { modelId: string; modelUrl: string }
  
  // Get animation data for speech
  POST /api/avatars/:agentId/animate
  Request: { text: string; audioUrl?: string }
  Response: { visemes: Viseme[]; timing: number[]; audioUrl: string }
}
```

---

## Mobile App Integration

### AR View Component

```typescript
// React Native / Unity Component
interface ARView {
  // Initialize AR session
  initializeARSession(): Promise<void>;
  
  // Load agent avatar
  loadAvatar(agentId: string, modelUrl: string): Promise<void>;
  
  // Place avatar in AR space
  placeAvatar(position: Vector3, rotation: Quaternion): void;
  
  // Animate avatar
  animateAvatar(animation: string, loop?: boolean): void;
  
  // Start lip-sync
  startLipSync(visemes: Viseme[], timing: number[]): void;
  
  // Stop lip-sync
  stopLipSync(): void;
  
  // Handle AR events
  onPlaneDetected(callback: (plane: Plane) => void): void;
  onTap(callback: (position: Vector3) => void): void;
}
```

### Chat Integration

```typescript
// When AI message arrives
interface ChatWithAR {
  // 1. Receive AI message
  onAIMessage(message: AIMessage): void;
  
  // 2. Show message in chat UI
  displayMessage(message: AIMessage): void;
  
  // 3. If AR view is active, animate avatar
  if (arView.isActive) {
    // Get animation data
    const animation = await avatarService.getAnimation(
      message.agentId,
      message.text
    );
    
    // Animate avatar
    arView.startLipSync(animation.visemes, animation.timing);
    
    // Play audio (optional)
    audioPlayer.play(animation.audioUrl);
  }
}
```

### UI Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat Screen                                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Chat Messages                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [AR View Button]                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ (Tap AR Button)
┌─────────────────────────────────────────────────────────────────┐
│  AR View Screen                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  AR Camera Feed                                           │   │
│  │  ┌──────────────┐                                         │   │
│  │  │  3D Avatar   │  ← Agent avatar in AR space            │   │
│  │  │  (animated)  │                                         │   │
│  │  └──────────────┘                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [Back to Chat] [Place Avatar] [Settings]                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Storage & Delivery

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Model Generation Service                                        │
│  - Generates/selects models                                     │
│  - Applies customizations                                       │
│  - Exports to target format                                     │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Model Storage (Azure Blob / S3)                                │
│  - Store model files (GLB, VRM, etc.)                          │
│  - Store textures                                               │
│  - Store animations                                             │
│  - CDN distribution                                             │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  CDN (CloudFront / Azure CDN)                                   │
│  - Global distribution                                          │
│  - Fast model delivery                                          │
│  - Caching                                                       │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Mobile App                                                     │
│  - Download model on demand                                     │
│  - Cache locally                                                │
│  - Stream if needed                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Model Optimization

```typescript
interface ModelOptimization {
  // Compression
  compression: {
    format: 'glb' | 'gltf'; // GLB is binary, smaller
    textureFormat: 'ktx2' | 'basis'; // Compressed textures
    compressionLevel: 'low' | 'medium' | 'high';
  };
  
  // LOD (Level of Detail)
  lod: {
    high: { polygonCount: 15000; distance: 0 };      // Close-up
    medium: { polygonCount: 8000; distance: 5 };     // Medium distance
    low: { polygonCount: 3000; distance: 10 };      // Far away
  };
  
  // Streaming
  streaming: {
    progressive: boolean; // Load progressively
    priority: 'model' | 'textures' | 'animations';
  };
}
```

### Caching Strategy

```typescript
interface ModelCaching {
  // Client-side cache
  clientCache: {
    maxSize: number; // MB
    ttl: number; // seconds
    strategy: 'lru' | 'fifo';
  };
  
  // CDN cache
  cdnCache: {
    ttl: number; // seconds (longer for static models)
    invalidation: 'on-update' | 'manual';
  };
}
```

---

## Technical Stack

### Backend (AR Avatar Service)

- **Language**: TypeScript/Node.js
- **Framework**: Express.js
- **Database**: MongoDB (avatar metadata)
- **Storage**: Azure Blob Storage / S3 (model files)
- **CDN**: Azure CDN / CloudFront
- **3D Processing**: 
  - glTF-Pipeline (model optimization)
  - Three.js (server-side processing, optional)
- **TTS**: Azure Cognitive Services / AWS Polly / ElevenLabs
- **ML Models** (Phase 2+):
  - Face generation models
  - Texture generation (Stable Diffusion)

### Mobile App

- **AR Framework**: Unity AR Foundation (recommended)
  - **Alternative**: React Native + ViroReact
- **3D Rendering**: Unity 3D Engine
  - **Alternative**: Three.js (WebAR) or native OpenGL/Metal
- **Model Loading**: 
  - glTF loader (Unity)
  - VRM loader (for anime models)
- **Lip-Sync**: 
  - OVR Lip Sync (Unity)
  - Custom viseme system
- **Audio**: Unity Audio System

### Model Formats

- **3D Models**: glTF 2.0 / GLB (recommended)
- **Anime Models**: VRM (VRoid), Live2D Cubism
- **Animations**: glTF animations, Unity Animator
- **Textures**: PNG, KTX2, Basis Universal

---

## Implementation Phases

### Phase 1: Foundation (4-6 weeks)

**Goals**: Basic AR avatar system with template-based models

- [ ] **AR Avatar Service Setup**
  - [ ] Service structure
  - [ ] MongoDB schema
  - [ ] Basic APIs

- [ ] **Template Model Library**
  - [ ] Create 10-20 base models (3D + anime)
  - [ ] Model customization system
  - [ ] Profile-to-model matching

- [ ] **Model Storage**
  - [ ] Azure Blob / S3 setup
  - [ ] CDN configuration
  - [ ] Model delivery API

- [ ] **Mobile AR Integration**
  - [ ] Unity AR Foundation setup
  - [ ] Basic AR view
  - [ ] Model loading and rendering
  - [ ] Surface placement

**Deliverables**:
- ✅ AR Avatar Service running
- ✅ Template models available
- ✅ AR view in mobile app
- ✅ Can place and view avatars in AR

### Phase 2: Animation & Lip-Sync (4-6 weeks)

**Goals**: Animated avatars with lip-sync

- [ ] **Animation System**
  - [ ] Idle animations
  - [ ] Talking animations
  - [ ] Gesture animations
  - [ ] Animation controller

- [ ] **Lip-Sync Engine**
  - [ ] Text-to-phoneme conversion
  - [ ] Phoneme-to-viseme mapping
  - [ ] Viseme animation system
  - [ ] Real-time lip-sync

- [ ] **TTS Integration**
  - [ ] TTS service integration
  - [ ] Audio generation
  - [ ] Audio playback in AR

- [ ] **Chat Integration**
  - [ ] AI message → animation trigger
  - [ ] Real-time lip-sync during speech
  - [ ] Emotion detection and expressions

**Deliverables**:
- ✅ Avatars animate when talking
- ✅ Lip-sync works with AI messages
- ✅ Audio playback in AR

### Phase 3: Advanced Features (6-8 weeks)

**Goals**: Enhanced customization and AI generation

- [ ] **Procedural Generation**
  - [ ] Model generation from profile
  - [ ] Customization system
  - [ ] Real-time preview

- [ ] **Advanced Animations**
  - [ ] Emotion-based expressions
  - [ ] Gesture system
  - [ ] Body language

- [ ] **AI Model Generation** (Optional)
  - [ ] Texture generation (Stable Diffusion)
  - [ ] Face generation models
  - [ ] Style transfer

- [ ] **Performance Optimization**
  - [ ] Model optimization
  - [ ] LOD system
  - [ ] Caching improvements

**Deliverables**:
- ✅ Procedural model generation
- ✅ Advanced animations
- ✅ Optimized performance

---

## Success Metrics

### Technical Metrics
- **Model Generation Time**: < 5 seconds (template), < 30 seconds (procedural)
- **Model File Size**: < 5 MB per model
- **AR Rendering FPS**: 30+ FPS on mid-range devices
- **Lip-Sync Accuracy**: 90%+ viseme accuracy
- **Model Load Time**: < 2 seconds on 4G

### User Metrics
- **AR Usage**: % of users who use AR view
- **Session Duration**: Average AR session length
- **Engagement**: Messages sent while in AR view
- **Satisfaction**: User ratings for AR experience

---

## Open Questions

1. **Model Style Preference**: Should we support both 3D and anime, or focus on one?
   - **Recommendation**: Support both, let users/agents choose

2. **Generation Method**: Template-based vs. procedural vs. AI-generated?
   - **Recommendation**: Start with templates (Phase 1), add procedural (Phase 2), AI (Phase 3)

3. **AR Platform**: Unity vs. React Native vs. Native?
   - **Recommendation**: Unity AR Foundation for best cross-platform support

4. **Lip-Sync Method**: Viseme-based vs. audio-based vs. blendshape?
   - **Recommendation**: Viseme-based for 3D, blendshape for detailed models

5. **Model Storage**: Cloud storage vs. local generation?
   - **Recommendation**: Cloud storage with CDN, cache locally

6. **Real-Time vs. Pre-generated**: Generate on-demand or pre-generate?
   - **Recommendation**: Pre-generate for speed, on-demand for customization

---

## Next Steps

1. **Review this design** with the team
2. **Choose AR framework** (Unity recommended)
3. **Create template model library** (10-20 models)
4. **Set up AR Avatar Service** (Phase 1)
5. **Integrate with mobile app** (AR view)
6. **Test with real agents** (pilot)

---

## References

- **glTF Specification**: https://www.khronos.org/gltf/
- **VRM Format**: https://vrm.dev/
- **Unity AR Foundation**: https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@latest
- **OVR Lip Sync**: https://developer.oculus.com/documentation/unity/audio-ovrlipsync-unity/
- **Pokemon Go AR**: Reference for AR placement UX
- **Ready Player Me**: Reference for avatar generation
- **Live2D**: Reference for 2D anime avatars

