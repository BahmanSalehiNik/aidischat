# AR Implementation - Remaining Steps

## Status
**Current Phase:** Testing & Debugging  
**Next Phase:** Core Feature Implementation  
**Last Updated:** [Current Date]

---

## Overview
This document tracks the remaining implementation steps for the AR streaming chat feature. Implementation will resume after the current progress has been tested and all debugging issues have been resolved.

---

## Remaining Features

### 1. AR Rendering (3D Model in AR Space)
**Priority:** High  
**Status:** Not Started  
**Estimated Time:** 3-5 days

**Tasks:**
- [ ] Choose AR framework (Expo AR vs Three.js + ARCore/ARKit)
- [ ] Integrate AR session initialization
- [ ] Handle camera permissions
- [ ] Implement AR plane detection
- [ ] Load 3D model (GLB/GLTF) in AR space
- [ ] Position and scale model correctly
- [ ] Handle AR session lifecycle (start, pause, resume, end)
- [ ] Implement model anchoring
- [ ] Add AR session error handling
- [ ] Test on real devices (AR doesn't work in simulators)

**Technical Considerations:**
- Use full-color models with textures (not preview mode)
- Support PBR materials
- Optimize for performance (LOD, texture compression)
- Handle model loading states
- Support model rotation and scaling gestures

**Files to Create/Modify:**
- `client/mobile-app/components/ar/ARViewer.tsx` (new)
- `client/mobile-app/components/ar/ARModelRenderer.tsx` (new)
- `client/mobile-app/app/(main)/ARChatScreen.tsx` (integrate AR viewer)

**Dependencies:**
- `expo-gl` (if using Expo AR)
- `three` (for 3D rendering)
- `expo-camera` (for AR camera)
- ARCore (Android) / ARKit (iOS) native modules

---

### 2. TTS Integration (ElevenLabs/Azure Speech)
**Priority:** High  
**Status:** Not Started  
**Estimated Time:** 2-3 days

**Tasks:**
- [ ] Integrate ElevenLabs API client
- [ ] Integrate Azure Speech SDK
- [ ] Use provider tokens from backend (`/api/ar-rooms/:roomId/provider-tokens`)
- [ ] Implement streaming audio playback
- [ ] Handle audio errors gracefully
- [ ] Add audio playback controls (play, pause, stop)
- [ ] Sync audio with text streaming
- [ ] Handle token expiration and refresh
- [ ] Add fallback between providers
- [ ] Test audio quality and latency

**Technical Considerations:**
- Stream audio chunks as they arrive
- Buffer audio for smooth playback
- Handle network interruptions
- Support multiple voice models
- Respect audio session settings (do not disturb mode)

**Files to Create/Modify:**
- `client/mobile-app/utils/tts/elevenLabsClient.ts` (new)
- `client/mobile-app/utils/tts/azureSpeechClient.ts` (new)
- `client/mobile-app/utils/tts/ttsManager.ts` (new)
- `client/mobile-app/app/(main)/ARChatScreen.tsx` (integrate TTS)

**Dependencies:**
- `@azure/msal-browser` (for Azure auth, if needed)
- `expo-av` (for audio playback)
- ElevenLabs SDK or REST API client

**API Endpoints:**
- ElevenLabs: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- Azure Speech: `wss://{region}.tts.speech.microsoft.com/cognitiveservices/v1`

---

### 3. Animation System (Emotions, Gestures, Poses)
**Priority:** High  
**Status:** Not Started  
**Estimated Time:** 3-4 days

**Tasks:**
- [ ] Parse emotion markers from streamed text
- [ ] Parse gesture markers
- [ ] Parse pose markers
- [ ] Map markers to 3D model blend shapes/animations
- [ ] Implement emotion animations (happy, sad, angry, etc.)
- [ ] Implement gesture animations (wave, nod, point, etc.)
- [ ] Implement pose changes (idle, talking, listening, thinking)
- [ ] Create animation state machine
- [ ] Handle animation transitions smoothly
- [ ] Support animation queuing
- [ ] Add animation timing controls
- [ ] Test animation synchronization with audio

**Technical Considerations:**
- Use blend shapes for facial expressions
- Use skeletal animations for gestures
- Support animation interpolation
- Handle concurrent animations
- Optimize animation performance

**Files to Create/Modify:**
- `client/mobile-app/utils/animations/markerToAnimation.ts` (new)
- `client/mobile-app/utils/animations/animationManager.ts` (new)
- `client/mobile-app/components/ar/ARModelRenderer.tsx` (apply animations)
- `client/mobile-app/app/(main)/ARChatScreen.tsx` (trigger animations)

**Animation Mapping:**
```typescript
// Emotions → Blend Shapes
emotion:happy → viseme_smile, blend_shape_happy
emotion:sad → blend_shape_sad
emotion:angry → blend_shape_angry
emotion:surprised → blend_shape_surprised

// Gestures → Skeletal Animations
gesture:wave → animation_wave_hand
gesture:nod → animation_nod_head
gesture:point → animation_point_finger

// Poses → Pose States
pose:idle → animation_idle
pose:talking → animation_talking_mouth
pose:listening → animation_listening_lean
```

---

### 4. Viseme Synchronization
**Priority:** High  
**Status:** Not Started  
**Estimated Time:** 2-3 days

**Tasks:**
- [ ] Generate visemes from phonemes (using existing `phonemeToViseme.ts`)
- [ ] Extract phonemes from TTS audio or text
- [ ] Map phonemes to viseme blend shapes
- [ ] Sync viseme timing with audio playback
- [ ] Apply visemes to 3D model in real-time
- [ ] Handle viseme transitions smoothly
- [ ] Support different viseme sets (ARKit, Oculus, custom)
- [ ] Test lip-sync accuracy
- [ ] Optimize viseme update frequency

**Technical Considerations:**
- Use existing `generateVisemes()` utility
- May need phoneme extraction from audio (if TTS doesn't provide)
- Sync with audio playback position
- Handle timing precision (millisecond accuracy)
- Support different viseme standards

**Files to Create/Modify:**
- `client/mobile-app/utils/visemes/visemeSync.ts` (new)
- `client/mobile-app/utils/visemes/audioToPhonemes.ts` (new, if needed)
- `client/mobile-app/components/ar/ARModelRenderer.tsx` (apply visemes)
- `client/mobile-app/app/(main)/ARChatScreen.tsx` (sync visemes with audio)

**Dependencies:**
- Existing: `client/mobile-app/utils/phonemeToViseme.ts`
- May need: Audio analysis library for phoneme extraction

**Viseme Standards:**
- ARKit: 15 visemes (viseme_sil, viseme_aa, viseme_ch, etc.)
- Oculus: 15 visemes (similar to ARKit)
- Custom: Map to model-specific blend shapes

---

## Implementation Order

### Phase 1: Foundation (Week 1)
1. **AR Rendering** - Get 3D model visible in AR space
2. **TTS Integration** - Get audio playback working

### Phase 2: Synchronization (Week 2)
3. **Viseme Synchronization** - Sync lip movement with audio
4. **Animation System** - Add emotions, gestures, poses

### Phase 3: Polish (Week 3)
5. Performance optimization
6. Error handling improvements
7. UI/UX enhancements
8. Testing and bug fixes

---

## Prerequisites Before Resuming

### Testing & Debugging (Current Phase)
- [ ] Test AR room creation
- [ ] Test message sending
- [ ] Test WebSocket streaming
- [ ] Test marker parsing
- [ ] Debug any connection issues
- [ ] Fix any backend errors
- [ ] Verify event flow end-to-end
- [ ] Test on real devices
- [ ] Performance testing

### Shared Package Update
- [ ] Update `@aichatwar/shared` with AR event interfaces
- [ ] Build and publish shared package
- [ ] Update all services to use new types
- [ ] Remove temporary interfaces

---

## Notes

1. **AR Rendering**: Choose framework based on:
   - Expo AR: Easier setup, less control
   - Three.js + ARCore/ARKit: More control, more complex

2. **TTS Provider Priority**:
   - Primary: ElevenLabs (better quality)
   - Fallback: Azure Speech (more reliable)

3. **Animation Performance**:
   - Use blend shapes for facial expressions (faster)
   - Use skeletal animations for body movements (more flexible)
   - Limit concurrent animations to prevent lag

4. **Viseme Accuracy**:
   - Start with phoneme-to-viseme mapping
   - Upgrade to audio-based viseme extraction if needed
   - Consider using TTS provider's viseme data if available

5. **Testing Requirements**:
   - AR features require real devices (not simulators)
   - Test on both iOS and Android
   - Test with different 3D models
   - Test with various network conditions

---

## Success Criteria

### AR Rendering
- ✅ 3D model appears in AR space
- ✅ Model is properly positioned and scaled
- ✅ Model loads with full colors and textures
- ✅ AR session handles interruptions gracefully

### TTS Integration
- ✅ Audio plays smoothly
- ✅ Audio syncs with text streaming
- ✅ Handles errors gracefully
- ✅ Supports multiple voice models

### Animation System
- ✅ Emotions display correctly
- ✅ Gestures trigger smoothly
- ✅ Poses change appropriately
- ✅ Animations don't lag or stutter

### Viseme Synchronization
- ✅ Lip movement matches audio
- ✅ Visemes transition smoothly
- ✅ Timing is accurate (within 50ms)
- ✅ Works with different audio speeds

---

**Implementation will resume after:**
1. Current progress is tested
2. All debugging issues are resolved
3. Shared package is updated
4. End-to-end flow is verified

---

**Last Updated:** [Current Date]  
**Next Review:** After testing phase completion

