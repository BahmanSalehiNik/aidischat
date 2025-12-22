# Meshy.ai: Complete Flow for Colors + Animations (Three.js React Native)

## Overview

This document provides the **complete, verified flow** for generating 3D characters with **both colors (textures) and animations** using Meshy.ai API, optimized for **Three.js in React Native** using **Option A** (separate base character + animation assets).

## Key Principles

1. **Option A Pattern**: One base rigged+textured GLB + separate animation assets (lightweight, cacheable)
2. **Texture Preservation**: Textures must be preserved through the rigging process
3. **Three.js Compatibility**: Use GLB format, prefer armature-only animations when available

## Complete Flow

### Step 1: Generate Textured Model (Colors)

**Two Options:**

#### Option A: Image-to-3D (Recommended - Single Step)

**Endpoint**: `POST https://api.meshy.ai/openapi/v1/image-to-3d`

**Request**:
```json
{
  "image_url": "https://example.com/character.png",
  "ai_model": "latest",
  "should_texture": true,
  "enable_pbr": false,
  "texture_prompt": "semi-realistic, natural skin tone, brown hair, blue eyes, red jacket, dark pants, simple colors, no tiny patterns",
  "should_remesh": true,
  "topology": "triangle",
  "target_polycount": 8000,
  "pose_mode": "t-pose",
  "symmetry_mode": "auto"
}
```

**Key Parameters**:
- `should_texture: true` - **CRITICAL**: Must be true for textures/colors
- `enable_pbr: false` - Base color only (lighter downloads, mobile-friendly)
- `texture_prompt` - Explicit color guidance for skin/hair/eyes/clothes
- `pose_mode: "t-pose"` - Essential for rigging
- `should_remesh: true` - **CRITICAL**: Must be true for `target_polycount` to work

**Immediate Response**:
```json
{ "result": "IMG_TASK_ID" }
```

**Retrieve Result**:
```
GET https://api.meshy.ai/openapi/v1/image-to-3d/IMG_TASK_ID
```

**Response**:
```json
{
  "status": "SUCCEEDED",
  "result": {
    "model_urls": {
      "glb": "https://assets.meshy.ai/.../model.glb?..."
    },
    "textures": [
      {
        "base_color": "https://assets.meshy.ai/.../texture_0.png?..."
      }
    ]
  }
}
```

#### Option B: Text-to-3D (Two-Stage: Preview → Refine)

**Stage 1: Preview (Geometry Only)**

**Endpoint**: `POST https://api.meshy.ai/openapi/v2/text-to-3d`

**Request**:
```json
{
  "mode": "preview",
  "prompt": "semi-realistic humanoid character, clean face, mobile AR ready",
  "art_style": "realistic",
  "should_remesh": true,
  "target_polycount": 8000,
  "topology": "triangle",
  "pose_mode": "t-pose"
}
```

**Response**: `{ "result": "PREVIEW_TASK_ID" }`

**Stage 2: Refine (Add Textures/Colors)**

**Request**:
```json
{
  "mode": "refine",
  "preview_task_id": "PREVIEW_TASK_ID",
  "enable_pbr": false,
  "texture_prompt": "natural skin tone, brown hair, green eyes, simple colored clothes, no tiny patterns"
}
```

**Response**: `{ "result": "REFINE_TASK_ID" }`

**Retrieve**:
```
GET https://api.meshy.ai/openapi/v2/text-to-3d/REFINE_TASK_ID
```

**Response**:
```json
{
  "status": "SUCCEEDED",
  "result": {
    "model_urls": {
      "glb": "https://assets.meshy.ai/.../model.glb?..."
    },
    "textures": [
      {
        "base_color": "https://assets.meshy.ai/.../texture_0.png?..."
      }
    ]
  }
}
```

### Step 2: Optional Remesh (Final Optimization)

**Recommended** for consistent polycount/origin/scale.

**Endpoint**: `POST https://api.meshy.ai/openapi/v1/remesh`

**Request**:
```json
{
  "input_task_id": "IMG_TASK_ID",  // or "REFINE_TASK_ID"
  "target_formats": ["glb"],
  "topology": "triangle",
  "target_polycount": 8000,
  "resize_height": 1.7,
  "origin_at": "bottom"
}
```

**Response**: `{ "result": "REMESH_TASK_ID" }`

**Retrieve**:
```
GET https://api.meshy.ai/openapi/v1/remesh/REMESH_TASK_ID
```

**Response**:
```json
{
  "status": "SUCCEEDED",
  "result": {
    "model_urls": {
      "glb": "https://assets.meshy.ai/.../model.glb?..."
    }
  }
}
```

### Step 3: Rigging (Base Character with Skeleton)

**Endpoint**: `POST https://api.meshy.ai/openapi/v1/rigging`

**Request**:
```json
{
  "model_url": "https://.../textured_model.glb",
  "height_meters": 1.7,
  "rig_preset": "STANDARD_HUMANOID"
}
```

**Note**: If you have the texture URL from Step 1, you can optionally pass it:
```json
{
  "model_url": "https://.../textured_model.glb",
  "height_meters": 1.7,
  "texture_image_url": "https://.../texture_0.png"  // Optional but helps preserve textures
}
```

**Response**: `{ "result": "RIG_TASK_ID" }`

**Retrieve**:
```
GET https://api.meshy.ai/openapi/v1/rigging/RIG_TASK_ID
```

**Response**:
```json
{
  "status": "SUCCEEDED",
  "result": {
    "rigged_character_glb_url": "https://assets.meshy.ai/.../Character_output.glb?...",
    "basic_animations": {
      "walking_glb_url": "https://assets.meshy.ai/.../Animation_Walking_withSkin.glb?...",
      "walking_armature_glb_url": "https://assets.meshy.ai/.../Animation_Walking_armature.glb?...",
      "running_glb_url": "https://assets.meshy.ai/.../Animation_Running_withSkin.glb?...",
      "running_armature_glb_url": "https://assets.meshy.ai/.../Animation_Running_armature.glb?..."
    }
  }
}
```

**What to Store (Option A)**:
- ✅ `rigged_character_glb_url` - **BASE CHARACTER** (mesh + textures + skeleton) - **ONE HEAVY FILE**
- ✅ `walking_armature_glb_url` - Animation-only (lightweight)
- ✅ `running_armature_glb_url` - Animation-only (lightweight)

### Step 4: Generate Additional Animations

**Endpoint**: `POST https://api.meshy.ai/openapi/v1/animations`

**Request**:
```json
{
  "rig_task_id": "RIG_TASK_ID",
  "action_id": 0,  // 0 = Idle, check animation library for others
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}
```

**Response**: `{ "result": "ANIM_TASK_ID" }`

**Retrieve**:
```
GET https://api.meshy.ai/openapi/v1/animations/ANIM_TASK_ID
```

**Response**:
```json
{
  "status": "SUCCEEDED",
  "result": {
    "animation_glb_url": "https://assets.meshy.ai/.../Animation_Idle_withSkin.glb?...",
    "animation_fbx_url": "https://assets.meshy.ai/.../Animation_Idle_withSkin.fbx?...",
    "processed_armature_fbx_url": "https://assets.meshy.ai/.../processed_armature.fbx?..."
  }
}
```

**What to Store (Option A)**:
- ✅ `processed_armature_fbx_url` - Animation-only (lightweight, but FBX format)
- ⚠️ **Note**: For Three.js, convert FBX to GLB offline, or use `animation_glb_url` and extract clips

## Three.js React Native Implementation (Option A)

### File Structure

```
Base Character (ONE file):
- rigged_character_glb_url → Contains: mesh + textures + skeleton

Animation Assets (MANY small files):
- walking_armature_glb_url → Animation tracks only
- running_armature_glb_url → Animation tracks only
- idle_clip.glb → Converted from processed_armature_fbx_url
- wave_clip.glb → Converted from processed_armature_fbx_url
```

### Loading Pattern

```typescript
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
let characterRoot;  // Base rigged character
let mixer;           // Animation mixer

// Load base character ONCE
async function loadCharacter(baseUrl) {
  const gltf = await loader.loadAsync(baseUrl);
  characterRoot = gltf.scene;
  
  // Create mixer targeting the character root
  mixer = new THREE.AnimationMixer(characterRoot);
  
  return characterRoot;
}

// Load and play animation clip
async function loadAndPlayClip(animationUrl, clipName = null) {
  const gltfAnim = await loader.loadAsync(animationUrl);
  
  // Extract animation clip
  const clip = clipName
    ? THREE.AnimationClip.findByName(gltfAnim.animations, clipName)
    : gltfAnim.animations[0];
  
  // Create and play action
  const action = mixer.clipAction(clip);
  action.reset().play();
}

// In render loop
function update(dt) {
  if (mixer) mixer.update(dt);
}
```

### Important Notes

1. **Bone Name Matching**: Animation clips must have matching bone names with the base character (same `rig_task_id` ensures this)

2. **Armature-Only GLBs**: Prefer `*_armature_glb_url` when available (walking/running from rigging response)

3. **FBX Conversion**: For custom animations, convert `processed_armature_fbx_url` to GLB offline for Three.js compatibility

4. **Texture Preservation**: Rigging should preserve textures if input model is textured. Passing `texture_image_url` helps ensure this.

## Common Animation IDs

Check Meshy Animation Library: https://docs.meshy.ai/api/animation-library

Common values:
- `0` - Idle
- `1` - Walking (also available as `walking_armature_glb_url` from rigging)
- `2` - Running (also available as `running_armature_glb_url` from rigging)
- `28` - Big Wave Hello
- `36` - Confused Scratch (thinking gesture)

## Troubleshooting

### Colors Not Appearing

1. **Check `should_texture: true`** in generation request
2. **Verify `enable_pbr: false`** for base color only
3. **Check texture_prompt** includes color guidance
4. **Verify rigging preserved textures** - check if `rigged_character_glb_url` has textures
5. **Pass `texture_image_url`** to rigging API if available

### Animations Not Working

1. **Verify model is rigged** - check for `rigged_character_glb_url`
2. **Check bone names match** - same `rig_task_id` ensures this
3. **Verify mixer is updating** - call `mixer.update(dt)` in render loop
4. **Check animation format** - prefer GLB over FBX for Three.js

### Model Too Heavy

1. **Use armature-only animations** - `*_armature_glb_url` instead of `*_withSkin.glb`
2. **Convert FBX to GLB** - smaller file size
3. **Extract clips offline** - create clip-only GLBs from `withSkin` GLBs
4. **Cache base character** - load once, reuse for all animations

## Summary

**Complete Flow**:
1. Generate textured model (Image-to-3D or Text-to-3D refine) with `should_texture: true`, `enable_pbr: false`
2. (Optional) Remesh for final optimization
3. Rig the textured model → get `rigged_character_glb_url` + basic animations
4. Generate additional animations → get `processed_armature_fbx_url` (convert to GLB for Three.js)

**Storage (Option A)**:
- **One base file**: `rigged_character_glb_url` (heavy, cache once)
- **Many animation files**: armature GLBs or converted FBX→GLB clips (lightweight, load on demand)

**Runtime (Three.js)**:
- Load base character once
- Load animation clips as needed
- Apply clips to base character using AnimationMixer

