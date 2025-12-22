# Meshy.ai: Rigging & Animation Guide

## Overview

This guide explains how to rig and animate Meshy-generated 3D models for mobile AR applications. Meshy provides:
- ✅ Auto-rigging for humanoid characters
- ✅ Body animations (idle, walk, run, gestures)
- ✅ GLB export suitable for mobile engines (Viro, Unity, Babylon)

**Important Reality Check:**
- ❌ Meshy does **NOT** generate facial viseme animation
- ✅ Meshy does **body animations** (idle, walk, run, gestures)
- ✅ For facial visemes, you'll need to:
  - Drive blendshapes at runtime (your "semi-live" approach)
  - OR use prebaked talking clips made elsewhere

## Input Requirements

Your model must be:
- ✅ **GLB/GLTF format**
- ✅ **Textured** (not just preview geometry)
- ✅ **Lightweight** (6k-12k triangles for mobile)
- ✅ **One humanoid mesh**
- ✅ **Neutral pose** (T-pose or A-pose recommended)
- ✅ **Reasonable proportions** (human-like skeleton)

## Step 1: Auto-Rigging

### Endpoint
```
POST https://api.meshy.ai/openapi/v1/rigging
```

### Request Body
```json
{
  "model_url": "https://your-domain.com/character.glb",
  "height_meters": 1.7
}
```

**Parameters:**
- `model_url` (required) - Your final textured GLB URL (must be publicly accessible)
- `height_meters` (optional but recommended) - Character height in meters (improves skeleton scaling)
- `rig_preset` (optional) - "STANDARD_HUMANOID" or "QUADRUPED" (auto-detected if not specified)
- `texture_image_url` (optional) - Base color texture URL

**Alternative:** Use `input_task_id` instead of `model_url`:
```json
{
  "input_task_id": "refine_task_id",
  "height_meters": 1.7
}
```

### Response
```json
{
  "id": "rig_task_id_123",
  "status": "SUCCEEDED",
  "rigged_character_glb_url": "https://assets.meshy.ai/.../rigged.glb"
}
```

**Important Fields:**
- `id` - Save this as `rig_task_id` (needed for animations)
- `rigged_character_glb_url` - The rigged model (base character)

### Polling
```
GET https://api.meshy.ai/openapi/v1/rigging/{rig_task_id}
```

Poll until `status === "SUCCEEDED"` or `status === "COMPLETED"`.

## Step 2: Generate Animations

Meshy provides an **Animation Library** with predefined actions. Each animation is generated separately and returns its own GLB.

### Endpoint
```
POST https://api.meshy.ai/openapi/v1/animations
```

### Recommended Minimal Animation Set

For AR characters (light, expressive, non-gamey):

| Purpose | Action | Recommended action_id |
|---------|--------|---------------------|
| Default | Idle | `0` |
| Interaction | Thinking / Gesture | `5` (verify in library) |
| Movement | Walk | `2` (verify in library) |
| Movement (Alt) | Fly | `3` (verify in library) |

**Note:** Animation IDs may vary by library version. Always check Meshy's Animation Library Reference: https://docs.meshy.ai/api/animation-library

### Example: Idle Animation

```json
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 0,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}
```

**Parameters:**
- `rig_task_id` (required) - From rigging step
- `action_id` (required) - Animation ID from library (0 = Idle)
- `post_process.operation_type` (optional) - "change_fps"
- `post_process.fps` (optional) - 24, 25, 30, or 60 (24 fps recommended for mobile AR)

### Example: Thinking / Gesture Animation

```json
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 5,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}
```

### Example: Walk Animation

```json
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 2,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}
```

### Response

Each animation request returns:

```json
{
  "id": "animation_task_id_456",
  "status": "SUCCEEDED",
  "animation_glb_url": "https://assets.meshy.ai/.../idle.glb"
}
```

**Important:**
- You get **separate GLBs per animation**
- Each animation has its own `animation_task_id`
- Save the `animation_glb_url` for each animation

### Polling
```
GET https://api.meshy.ai/openapi/v1/animations/{animation_task_id}
```

Poll until `status === "SUCCEEDED"` or `status === "COMPLETED"`.

## Step 3: Using Animations in Your Engine

**Important:** Meshy does **NOT** merge animations automatically. You get:
- 1 rigged base character GLB
- N separate animation GLB files (one per animation)

### Typical Workflow

1. **Load rigged base character GLB** (from rigging step)
2. **Load animation GLBs as animation clips** (from animation step)
3. **Apply animations in your engine:**
   - **ViroReact**: Use `ViroAnimation` with animation clips
   - **Unity**: Import GLBs, extract animation clips
   - **Babylon**: Load GLBs, access animation groups
   - **Three.js**: Use `GLTFLoader`, access `gltf.animations` array

### Example: Three.js / Viro

```typescript
// Load rigged base character
const characterGLB = await loader.loadAsync(riggedCharacterUrl);

// Load animation GLBs
const idleGLB = await loader.loadAsync(idleAnimationUrl);
const walkGLB = await loader.loadAsync(walkAnimationUrl);

// Extract animation clips
const idleClip = idleGLB.animations[0];
const walkClip = walkGLB.animations[0];

// Apply to character
const mixer = new THREE.AnimationMixer(characterGLB.scene);
const idleAction = mixer.clipAction(idleClip);
const walkAction = mixer.clipAction(walkClip);

// Play animation
idleAction.play();
```

## Lightweight Best Practices

### Geometry
- ✅ Target **6k-12k triangles** total for characters
- ✅ One skinned mesh if possible
- ✅ Avoid extra accessories early

### Textures
- ✅ **BaseColor only** (no PBR - `enable_pbr: false`)
- ✅ **512×512 or 1K max** resolution
- ✅ No normal maps unless necessary

### Animations
- ✅ **24 fps** (lighter than 30/60 fps)
- ✅ No root motion unless needed
- ✅ Idle loops short (2-4 seconds)

### Runtime (AR)
- ✅ Anchor character
- ✅ Animate locally, never move the anchor
- ✅ Drive visemes separately via blendshapes (jaw open + noise)

## Complete Workflow Example

```typescript
// 1. Rig the model
const rigResponse = await axios.post('https://api.meshy.ai/openapi/v1/rigging', {
  model_url: 'https://your-model.glb',
  height_meters: 1.7
});
const rigTaskId = rigResponse.data.id;

// Poll for rigging completion
let riggedUrl = null;
while (!riggedUrl) {
  const status = await axios.get(`https://api.meshy.ai/openapi/v1/rigging/${rigTaskId}`);
  if (status.data.status === 'SUCCEEDED') {
    riggedUrl = status.data.rigged_character_glb_url;
    break;
  }
  await sleep(5000);
}

// 2. Generate animations
const animations = [
  { name: 'idle', action_id: 0 },
  { name: 'thinking', action_id: 5 },
  { name: 'walk', action_id: 2 }
];

const animationUrls = {};
for (const anim of animations) {
  const animResponse = await axios.post('https://api.meshy.ai/openapi/v1/animations', {
    rig_task_id: rigTaskId,
    action_id: anim.action_id,
    post_process: {
      operation_type: 'change_fps',
      fps: 24
    }
  });
  const animTaskId = animResponse.data.id;
  
  // Poll for animation completion
  while (true) {
    const status = await axios.get(`https://api.meshy.ai/openapi/v1/animations/${animTaskId}`);
    if (status.data.status === 'SUCCEEDED') {
      animationUrls[anim.name] = status.data.animation_glb_url;
      break;
    }
    await sleep(5000);
  }
}

// 3. You now have:
// - riggedUrl: Base rigged character
// - animationUrls.idle: Idle animation GLB
// - animationUrls.thinking: Thinking animation GLB
// - animationUrls.walk: Walk animation GLB
```

## Animation Library Reference

Meshy has **500+ animation presets**. Common action IDs (verify in library):

| Action | Typical ID | Notes |
|--------|-----------|------|
| Idle | `0` | Default idle pose |
| Walk | `2` | Walking cycle |
| Run | `3` | Running cycle |
| Fly | `4` | Flying animation |
| Gesture | `5` | Thinking/gesture |
| Wave | `6` | Waving gesture |

**Important:** Always check Meshy's Animation Library for exact IDs:
- **Animation Library**: https://docs.meshy.ai/api/animation-library
- IDs may vary by library version
- Some animations may not be available for all character types

## What This Pipeline Gives You

After completing this workflow, you'll have:

✅ **A rigged GLB** - Base character with skeleton  
✅ **Idle animation** - Default pose  
✅ **Gesture/Thinking animation** - For interactions  
✅ **Walk/Fly animation** - For movement  
✅ **Lightweight** - Suitable for real-time mobile AR  
✅ **Compatible** - Works with semi-live facial animation plan  

## Limitations & Next Steps

### What Meshy Provides
- ✅ Body animations (idle, walk, run, gestures)
- ✅ Skeletal rigging
- ✅ GLB export

### What You Still Need
- ❌ **Facial visemes** - Not generated by Meshy
- ❌ **Talking animations** - Body only, no mouth movement
- ❌ **Blendshapes** - Not included

### Solutions for Facial Animation

1. **Runtime Blendshapes** (Recommended for "semi-live")
   - Add blendshape targets to model in Blender
   - Drive visemes at runtime based on TTS phonemes
   - Works with your existing viseme system

2. **Prebaked Talking Clips**
   - Create talking animations in Blender/Maya
   - Export as separate animation clips
   - Load alongside Meshy animations

3. **ARKit/ARCore Blend Shapes**
   - If using native AR, use ARKit/ARCore facial tracking
   - Map to model blendshapes
   - Real-time facial animation

## Animation Library Reference

Based on Meshy's Animation Library (500+ presets):

| action_id | Name | Category | Description |
|-----------|------|----------|-------------|
| **0** | **Idle** | DailyActions | Standard idle animation (recommended) |
| **1** | **Walking_Woman** | WalkAndRun | Standard walking animation (recommended) |
| **2** | (Various) | WalkAndRun | Alternative walking/running animations |
| **25** | **Agree_Gesture** | DailyActions | Gesture indicating agreement (good for thinking) |
| **26** | Angry_Stomp | DailyActions | Gesture showing anger |
| **27** | Big_Heart_Gesture | BodyMovements | Heart shape gesture |
| **28** | Big_Wave_Hello | DailyActions | Large waving gesture |
| **29** | Call_Gesture | BodyMovements | Calling/beckoning gesture |

**Recommended Minimal Set for Mobile AR:**
- **Idle**: `action_id: 0` - Default pose
- **Thinking/Gesture**: `action_id: 25` (Agree_Gesture) or `28` (Big_Wave_Hello)
- **Walk**: `action_id: 1` (Walking_Woman)

**Note:** Always verify action IDs in Meshy's Animation Library as they may vary:
- **Animation Library**: https://docs.meshy.ai/api/animation-library

## Resources

- **Meshy Rigging API**: https://docs.meshy.ai/en/api/rigging-and-animation
- **Meshy Animation API**: https://docs.meshy.ai/api/animation-library
- **Meshy Animation Library**: https://docs.meshy.ai/api/animation-library
- **For lightweight models**: @see docs/MESHY_LIGHTWEIGHT_MODELS.md

## Implementation Checklist

- [ ] Generate lightweight textured model (6k-12k triangles)
- [ ] Rig model with `height_meters` parameter
- [ ] Generate idle animation (action_id: 0, 24 fps)
- [ ] Generate thinking/gesture animation (action_id: 5, 24 fps)
- [ ] Generate walk animation (action_id: 2, 24 fps)
- [ ] Load rigged base character in engine
- [ ] Load animation GLBs as clips
- [ ] Implement animation state machine
- [ ] Test on mobile device
- [ ] Add facial visemes separately (Blender/runtime)
