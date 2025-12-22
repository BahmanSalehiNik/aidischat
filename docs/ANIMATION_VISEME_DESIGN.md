# Animation & Viseme Implementation Design

## Overview

This document compares different approaches for implementing avatar movements (idle, thinking, walking, flying, talking) and viseme synchronization in the React Native/Expo mobile app.

## Current State

- **3D Engine**: Three.js via `expo-three` and `expo-gl`
- **Model Format**: GLB/GLTF with support for animations and morph targets
- **Current Implementation**: Basic model loading with placeholder animation code
- **TTS**: `expo-speech` and `expo-av` available (not yet integrated)
- **Viseme Generation**: Basic phoneme-to-viseme mapping exists (`phonemeToViseme.ts`)

---

## Approach Comparison: Movement Animations

### Option 1: Three.js AnimationMixer (Native Three.js)

**Description**: Use Three.js's built-in `AnimationMixer` to play GLTF animations directly.

**Implementation**:
```typescript
import * as THREE from 'three';
import { AnimationMixer } from 'three';

class AnimationController {
  private mixer: AnimationMixer;
  private actions: Map<string, THREE.AnimationAction> = new Map();
  
  constructor(model: THREE.Group, animations: THREE.AnimationClip[]) {
    this.mixer = new AnimationMixer(model);
    animations.forEach(clip => {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    });
  }
  
  playAnimation(name: string, fadeIn: number = 0.3) {
    const action = this.actions.get(name);
    if (action) {
      action.reset().fadeIn(fadeIn).play();
    }
  }
  
  update(deltaTime: number) {
    this.mixer.update(deltaTime);
  }
}
```

**Pros**:
- ✅ Native Three.js solution - no additional dependencies
- ✅ Works with existing `expo-three` setup
- ✅ Full control over animation playback
- ✅ Supports animation blending, fading, looping
- ✅ Compatible with Expo Go (uses existing Three.js)
- ✅ Well-documented and mature
- ✅ Direct access to GLTF animation clips
- ✅ Good performance (native Three.js)

**Cons**:
- ❌ Requires manual animation state management
- ❌ Need to handle animation transitions manually
- ❌ More boilerplate code for complex state machines
- ❌ No built-in React hooks (need to manage lifecycle)

**Expo Go Compatibility**: ✅ **FULLY COMPATIBLE**

**Ease of Implementation**: ⭐⭐⭐⭐ (4/5) - Moderate, requires understanding Three.js animation system

**Maintenance**: ⭐⭐⭐⭐ (4/5) - Good, standard Three.js patterns

**Performance**: ⭐⭐⭐⭐⭐ (5/5) - Excellent, native Three.js performance

---

### Option 2: React Three Fiber (@react-three/fiber)

**Description**: Use React Three Fiber (R3F) with `@react-three/drei` for declarative 3D animations.

**Implementation**:
```typescript
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

function AnimatedAvatar({ modelUrl, currentMovement }) {
  const { scene, animations } = useGLTF(modelUrl);
  const { actions, mixer } = useAnimations(animations, scene);
  
  useEffect(() => {
    if (currentMovement && actions[currentMovement]) {
      actions[currentMovement].reset().fadeIn(0.3).play();
    }
  }, [currentMovement, actions]);
  
  useFrame((state, delta) => {
    mixer.update(delta);
  });
  
  return <primitive object={scene} />;
}
```

**Pros**:
- ✅ Declarative React-style API
- ✅ Built-in hooks (`useAnimations`, `useFrame`)
- ✅ Less boilerplate code
- ✅ Good TypeScript support
- ✅ Active community and ecosystem
- ✅ Easy animation state management with React hooks

**Cons**:
- ❌ **NOT compatible with Expo Go** (requires native modules)
- ❌ Requires development build or ejecting from managed workflow
- ❌ Additional dependency (`@react-three/fiber`, `@react-three/drei`)
- ❌ May have performance overhead (React reconciliation)
- ❌ Learning curve if not familiar with R3F
- ❌ Larger bundle size

**Expo Go Compatibility**: ❌ **NOT COMPATIBLE** (requires native modules)

**Ease of Implementation**: ⭐⭐⭐ (3/5) - Moderate, but requires setup changes

**Maintenance**: ⭐⭐⭐⭐ (4/5) - Good, React patterns

**Performance**: ⭐⭐⭐⭐ (4/5) - Good, but React overhead

---

### Option 3: Custom Animation State Machine

**Description**: Build a lightweight custom animation controller with state machine logic.

**Implementation**:
```typescript
type AnimationState = 'idle' | 'thinking' | 'walking' | 'flying' | 'talking';

class CustomAnimationController {
  private mixer: THREE.AnimationMixer;
  private currentState: AnimationState = 'idle';
  private actions: Map<string, THREE.AnimationAction>;
  private stateTransitions: Map<AnimationState, AnimationState[]>;
  
  constructor(model: THREE.Group, animations: THREE.AnimationClip[]) {
    this.mixer = new AnimationMixer(model);
    // Initialize actions and state machine
  }
  
  transitionTo(newState: AnimationState) {
    if (this.canTransition(this.currentState, newState)) {
      this.fadeOutCurrent();
      this.fadeInNew(newState);
      this.currentState = newState;
    }
  }
  
  private canTransition(from: AnimationState, to: AnimationState): boolean {
    // Define valid transitions
    return this.stateTransitions.get(from)?.includes(to) ?? false;
  }
}
```

**Pros**:
- ✅ Full control over animation logic
- ✅ Lightweight (no extra dependencies)
- ✅ Can optimize for specific use cases
- ✅ Works with Expo Go
- ✅ Easy to debug and customize

**Cons**:
- ❌ More code to write and maintain
- ❌ Need to implement state machine logic
- ❌ No built-in features (blending, etc.)
- ❌ More testing required

**Expo Go Compatibility**: ✅ **FULLY COMPATIBLE**

**Ease of Implementation**: ⭐⭐⭐ (3/5) - More work, but flexible

**Maintenance**: ⭐⭐⭐ (3/5) - More code to maintain

**Performance**: ⭐⭐⭐⭐⭐ (5/5) - Excellent, optimized for our needs

---

### Option 4: Animation Library (GSAP, Lottie, etc.)

**Description**: Use a general-purpose animation library.

**GSAP Example**:
```typescript
import { gsap } from 'gsap';

// Animate model position/rotation
gsap.to(modelRef.current.rotation, {
  y: Math.PI * 2,
  duration: 2,
  repeat: -1
});
```

**Pros**:
- ✅ Rich animation features
- ✅ Timeline control
- ✅ Easing functions

**Cons**:
- ❌ Not designed for 3D model animations
- ❌ Doesn't work with GLTF animation clips
- ❌ Better for UI animations
- ❌ Additional dependency

**Expo Go Compatibility**: ⚠️ **PARTIAL** (depends on library)

**Ease of Implementation**: ⭐⭐ (2/5) - Not ideal for 3D models

**Maintenance**: ⭐⭐⭐ (3/5) - Not the right tool

**Performance**: ⭐⭐⭐ (3/5) - Not optimized for 3D

**Recommendation**: ❌ **NOT RECOMMENDED** for 3D model animations

---

## Approach Comparison: Viseme Synchronization

### Option 1: Phoneme-to-Viseme Mapping (Current Approach)

**Description**: Use static mapping from phonemes to visemes, sync with audio timing.

**Implementation** (Already exists):
```typescript
// utils/phonemeToViseme.ts
export function generateVisemes(
  text: string,
  audioDurationMs: number
): VisemeData[] {
  const phonemes = textToPhonemes(text);
  const visemes = phonemes.map(p => PHONEME_TO_VISEME_MAP[p]);
  // Distribute timing across audio duration
  return visemes.map((v, i) => ({
    id: v,
    offset: (i * audioDurationMs) / visemes.length,
    duration: audioDurationMs / visemes.length
  }));
}
```

**Pros**:
- ✅ Already implemented
- ✅ Fully offline (no API calls)
- ✅ Lightweight
- ✅ Works with Expo Go
- ✅ Fast (no network latency)
- ✅ No additional dependencies

**Cons**:
- ❌ Less accurate timing (even distribution)
- ❌ Doesn't account for speech rate variations
- ❌ May not match actual phoneme timing in audio
- ❌ Requires text-to-phoneme conversion (currently simplified)

**Expo Go Compatibility**: ✅ **FULLY COMPATIBLE**

**Ease of Implementation**: ⭐⭐⭐⭐⭐ (5/5) - Already done!

**Maintenance**: ⭐⭐⭐⭐ (4/5) - Simple to maintain

**Accuracy**: ⭐⭐⭐ (3/5) - Good enough for MVP

---

### Option 2: Audio Analysis (Phoneme Extraction)

**Description**: Analyze audio waveform to extract phoneme timings.

**Implementation**:
```typescript
import { Audio } from 'expo-av';

async function extractPhonemesFromAudio(audioUri: string) {
  // Use audio analysis library to detect phonemes
  // Map to visemes with accurate timing
}
```

**Pros**:
- ✅ More accurate timing
- ✅ Matches actual audio
- ✅ Handles speech rate variations

**Cons**:
- ❌ Requires audio analysis library
- ❌ More complex implementation
- ❌ May need native modules (Expo Go compatibility?)
- ❌ Higher CPU usage
- ❌ Additional dependencies

**Expo Go Compatibility**: ⚠️ **UNCERTAIN** (depends on library)

**Ease of Implementation**: ⭐⭐ (2/5) - Complex

**Maintenance**: ⭐⭐⭐ (3/5) - More complex

**Accuracy**: ⭐⭐⭐⭐⭐ (5/5) - Very accurate

---

### Option 3: TTS Provider Viseme Data

**Description**: Use viseme data from TTS providers (OpenAI Realtime, Azure Speech).

**Implementation**:
```typescript
// OpenAI Realtime API provides viseme events
const response = await openai.audio.speech.create({
  model: "tts-1",
  input: text,
  voice: "alloy",
  response_format: "verbose_json", // Includes viseme data
});
```

**Pros**:
- ✅ Most accurate (from TTS engine)
- ✅ Real-time viseme events
- ✅ No client-side processing
- ✅ Professional quality

**Cons**:
- ❌ Requires TTS provider support
- ❌ Additional API calls/costs
- ❌ Network dependency
- ❌ Provider-specific format
- ❌ May need backend integration

**Expo Go Compatibility**: ✅ **COMPATIBLE** (just API calls)

**Ease of Implementation**: ⭐⭐⭐ (3/5) - Depends on provider

**Maintenance**: ⭐⭐⭐ (3/5) - Provider-dependent

**Accuracy**: ⭐⭐⭐⭐⭐ (5/5) - Most accurate

---

### Option 4: Hybrid Approach

**Description**: Use TTS provider data when available, fallback to phoneme mapping.

**Pros**:
- ✅ Best of both worlds
- ✅ Works offline (fallback)
- ✅ Accurate when online

**Cons**:
- ❌ More complex implementation
- ❌ Need to handle both paths

**Expo Go Compatibility**: ✅ **COMPATIBLE**

**Ease of Implementation**: ⭐⭐⭐ (3/5) - More work

**Maintenance**: ⭐⭐⭐ (3/5) - Two systems to maintain

---

## Recommended Implementation Plan

### Phase 1: Movement Animations (Week 1-2)

**Recommended Approach**: **Option 1 - Three.js AnimationMixer**

**Rationale**:
- ✅ Works with Expo Go (no breaking changes)
- ✅ Uses existing Three.js setup
- ✅ Good balance of control and simplicity
- ✅ No additional dependencies
- ✅ Excellent performance

**Implementation Steps**:
1. Create `AnimationController` class using `AnimationMixer`
2. Load GLTF animations on model load
3. Implement state machine for movement transitions
4. Add animation blending for smooth transitions
5. Integrate with marker system

**Files to Create**:
- `client/mobile-app/utils/animations/AnimationController.ts`
- `client/mobile-app/utils/animations/movementStateMachine.ts`
- `client/mobile-app/utils/animations/animationTypes.ts`

**Files to Modify**:
- `client/mobile-app/components/avatar/Model3DViewer.tsx`

---

### Phase 2: Viseme Synchronization (Week 2-3)

**Recommended Approach**: **Option 1 (Current) + Option 3 (Future Enhancement)**

**Rationale**:
- ✅ Use existing phoneme-to-viseme mapping for MVP
- ✅ Fast to implement (already exists)
- ✅ Works offline
- ✅ Good enough for initial release
- ⚠️ Plan to add TTS provider visemes later for better accuracy

**Implementation Steps**:
1. Enhance existing `generateVisemes()` function
2. Integrate with TTS audio playback
3. Create viseme sync controller
4. Apply visemes to model blend shapes in real-time
5. Test synchronization accuracy

**Files to Create**:
- `client/mobile-app/utils/visemes/VisemeSyncController.ts`
- `client/mobile-app/utils/visemes/audioSync.ts`

**Files to Modify**:
- `client/mobile-app/utils/phonemeToViseme.ts` (enhance)
- `client/mobile-app/components/avatar/Model3DViewer.tsx` (apply visemes)

---

### Phase 3: TTS Integration (Week 3-4)

**Recommended Approach**: Use `expo-av` for audio playback

**Rationale**:
- ✅ Already in dependencies
- ✅ Works with Expo Go
- ✅ Good audio control
- ✅ Can sync with visemes

**Implementation Steps**:
1. Create TTS service wrapper
2. Integrate with backend TTS endpoints
3. Stream audio playback
4. Sync with viseme timing
5. Handle audio state (play, pause, stop)

**Files to Create**:
- `client/mobile-app/services/ttsService.ts`
- `client/mobile-app/services/audioPlayer.ts`

---

### Phase 4: Integration & Polish (Week 4-5)

**Tasks**:
1. Integrate all systems together
2. Test animation transitions
3. Test viseme synchronization
4. Performance optimization
5. Error handling

---

## Detailed Implementation: AnimationController

### Architecture

```
AnimationController
├── AnimationMixer (Three.js)
├── AnimationActions (Map<string, AnimationAction>)
├── StateMachine (Movement states)
└── BlendShapes (Emotion/Viseme)
```

### Movement States

```typescript
enum MovementState {
  IDLE = 'idle',
  THINKING = 'thinking',
  WALKING = 'walking',
  FLYING = 'flying',
  TALKING = 'talking'
}
```

### State Transitions

```
idle → thinking ✅
idle → walking ✅
idle → talking ✅
thinking → idle ✅
thinking → talking ✅
walking → idle ✅
walking → talking ✅
flying → idle ✅
flying → talking ✅
talking → idle ✅
talking → thinking ✅
```

### Animation Priority

1. **Talking** (highest) - Interrupts all others
2. **Thinking** - Can interrupt idle/walking
3. **Walking/Flying** - Can interrupt idle
4. **Idle** (lowest) - Default state

---

## Detailed Implementation: Viseme Sync

### Architecture

```
VisemeSyncController
├── AudioPlayer (expo-av)
├── VisemeQueue (timed visemes)
├── BlendShapeMapper (viseme → blend shape)
└── SyncTimer (requestAnimationFrame)
```

### Sync Flow

```
1. TTS generates audio + text
2. Generate visemes from text
3. Start audio playback
4. Update visemes based on audio position
5. Apply visemes to model blend shapes
```

### Timing Precision

- Update visemes every frame (~16ms at 60fps)
- Sync with audio playback position
- Smooth transitions between visemes (lerp)

---

## Performance Considerations

### Optimization Strategies

1. **Animation Updates**: Only update active animations
2. **Viseme Updates**: Throttle to 30fps if needed
3. **Blend Shape Updates**: Batch updates per frame
4. **Memory**: Clean up unused animations
5. **Battery**: Reduce update frequency when idle

### Target Performance

- **Frame Rate**: 60 FPS (target), 30 FPS (minimum)
- **Animation Latency**: < 100ms
- **Viseme Sync Accuracy**: ±50ms
- **Memory Usage**: < 200MB for model + animations

---

## Testing Strategy

### Unit Tests
- Animation state transitions
- Viseme generation accuracy
- Blend shape mapping

### Integration Tests
- Animation + viseme sync
- Audio + viseme sync
- Marker → animation flow

### Performance Tests
- Frame rate on low-end devices
- Memory usage
- Battery consumption

---

## Future Enhancements

### Phase 5: Advanced Features (Post-MVP)

1. **TTS Provider Visemes**: Integrate OpenAI Realtime or Azure Speech visemes
2. **Emotion Blend Shapes**: More nuanced facial expressions
3. **Gesture Animations**: Hand/body gestures from markers
4. **Animation Queuing**: Queue multiple animations
5. **Custom Animations**: User-defined animation sequences

---

## Decision Matrix

| Approach | Expo Go | Ease | Performance | Maintenance | **Score** |
|----------|---------|------|------------|-------------|-----------|
| **Three.js AnimationMixer** | ✅ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| React Three Fiber | ❌ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Custom State Machine | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Phoneme-to-Viseme | ✅ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| Audio Analysis | ⚠️ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| TTS Provider Visemes | ✅ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## Final Recommendation

### Movement Animations
**✅ Use Three.js AnimationMixer (Option 1)**

**Why**:
- Best balance of features, compatibility, and performance
- Works with Expo Go
- No additional dependencies
- Full control over animations

### Viseme Synchronization
**✅ Use Phoneme-to-Viseme Mapping (Current) + Plan TTS Provider Integration**

**Why**:
- Already implemented
- Fast and offline
- Good enough for MVP
- Can enhance later with TTS provider data

---

## Next Steps

1. ✅ Review and approve this design
2. Create `AnimationController` class
3. Implement movement state machine
4. Enhance viseme synchronization
5. Integrate TTS audio playback
6. Test and optimize

---

## References

- [Three.js AnimationMixer Docs](https://threejs.org/docs/#api/en/animation/AnimationMixer)
- [expo-three GitHub](https://github.com/expo/expo-three)
- [expo-av Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [GLTF Animation Spec](https://www.khronos.org/gltf/)
- [ARKit Viseme Standards](https://developer.apple.com/documentation/arkit/arfaceanchor/2928251-blendshapeatlocation)
