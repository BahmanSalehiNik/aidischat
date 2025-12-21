# Meshy.ai: Creating Lightweight Textured Models for Mobile

## Overview

This guide explains how to create **lightweight, textured, riggable 3D models** using Meshy.ai's API for mobile applications. The goal is to generate models that are:
- ✅ **Textured** (not just preview geometry)
- ✅ **Lightweight** (6k-15k triangles for AR characters)
- ✅ **Fast to generate** (optimized workflow)
- ✅ **Fast to render** (mobile-optimized)
- ✅ **Riggable** (ready for animations)

## Key Parameters for Lightweight Models

### Main "Make It Light" Knobs

1. **`target_polycount`** - Main "how light" dial
   - Mobile AR characters: **6,000-15,000 triangles**
   - Mobile props: **1,000-8,000 triangles**
   - Lower = lighter but may lose detail

2. **`topology`** - Mesh structure
   - **`"triangle"`** - Best for mobile runtime (recommended)
   - `"quad"` - May require conversion to triangles anyway

3. **`should_remesh`** - Critical for polycount control
   - **Must be `true`** if you want `target_polycount`/`topology` to actually take effect
   - Without this, you get "highest precision triangular mesh" and it ignores your poly target

4. **Texture Choices** - Keep it simple
   - **`should_texture: true`** - You want colors
   - **`enable_pbr: false`** - Base color only (lighter & faster)
   - Avoid extra maps (normal, roughness, metallic) for mobile

5. **Optional but Helpful**
   - **`symmetry_mode`** - Helps consistency
   - **`pose_mode: "t-pose"` or `"a-pose"`** - Essential for humanoid rigging

## Workflow: Text-to-3D (Two-Stage Process)

Meshy's Text-to-3D is **explicitly two-stage**: Preview (geometry) → Refine (texture)

### Stage 1: Preview (Geometry Generation)

**Endpoint**: `POST /v2/text-to-3d` with `mode: "preview"`

**Parameters**:
```json
{
  "prompt": "a humanoid character in T-pose",
  "mode": "preview",
  "art_style": "sculpture",
  "target_polycount": 10000,        // 6k-15k for mobile characters
  "topology": "triangle",           // Best for mobile
  "should_remesh": true,            // CRITICAL: Must be true!
  "pose_mode": "t-pose",            // Essential for rigging
  "symmetry_mode": "x",              // Optional: helps consistency
  "negative_prompt": "high poly, complex geometry"
}
```

**Response**: `{ "result": "preview_task_id" }`

**Polling**: `GET /v2/text-to-3d/{preview_task_id}`

**Returns**: Geometry-only model (no textures yet)

### Stage 2: Refine (Add Textures)

**Endpoint**: `POST /v2/text-to-3d` with `mode: "refine"`

**Parameters**:
```json
{
  "mode": "refine",
  "preview_task_id": "preview_task_id_from_stage_1",
  "enable_pbr": false,              // Base color only (lighter)
  "texture_prompt": "same as original prompt",  // Optional
  "texture_image_url": "url_to_reference_image" // Optional
}
```

**Response**: `{ "result": "refine_task_id" }`

**Polling**: `GET /v2/text-to-3d/{refine_task_id}`

**Returns**: Textured model URL in `model_urls.glb`

### Stage 3: Optional Remesh Pass (Final Optimization)

Even if you set a low polycount during generation, do a final "shipping" pass:

**Endpoint**: `POST /openapi/v1/remesh`

**Parameters**:
```json
{
  "model_url": "https://assets.meshy.ai/.../model.glb",
  "target_formats": ["glb"],
  "topology": "triangle",
  "target_polycount": 10000,        // Final target
  "resize_height": 1.75,            // Optional: character height in meters
  "origin_at": "center"             // Optional: nice for AR placement
}
```

**Response**: `{ "result": "remesh_task_id" }`

**Polling**: `GET /openapi/v1/remesh/{remesh_task_id}`

**Returns**: Optimized model URL

## Alternative: Image-to-3D (Single Stage)

If you have a reference image, you can generate textured model in one step:

**Endpoint**: `POST /openapi/v1/image-to-3d`

**Parameters**:
```json
{
  "image_url": "https://your-image-url.com/image.jpg",
  "target_polycount": 10000,
  "topology": "triangle",
  "should_remesh": true,
  "should_texture": true,
  "enable_pbr": false,
  "pose_mode": "t-pose"
}
```

**Benefits**:
- Single API call (faster)
- Direct textured output
- Good for character consistency

**Drawbacks**:
- Requires reference image
- Less flexible than text-to-3d

## Rigging & Animation Workflow

### Step 1: Auto-Rig the Model

**Endpoint**: `POST /openapi/v1/rigging`

**Parameters**:
```json
{
  "model_url": "https://assets.meshy.ai/.../model.glb",
  "rig_preset": "STANDARD_HUMANOID",
  "height_meters": 1.75,            // Optional: improves rigging accuracy
  "texture_image_url": "url"         // Optional: base color texture
}
```

**Alternative**: Use `input_task_id` instead of `model_url`:
```json
{
  "input_task_id": "refine_task_id",
  "rig_preset": "STANDARD_HUMANOID",
  "height_meters": 1.75
}
```

**Response**: `{ "rigging_task_id": "..." }`

**Polling**: `GET /openapi/v1/rigging/{rigging_task_id}`

**Returns**:
- `rigged_character_glb_url` - Rigged model
- Basic animations (walking/running) as GLB/FBX URLs in the result

### Step 2: Add More Animations

**Endpoint**: `POST /openapi/v1/animations`

**Parameters**:
```json
{
  "rig_task_id": "rigging_task_id",
  "action_id": 0,                    // From Animation Library (0 = Idle)
  "post_process": {
    "operation_type": "change_fps",
    "fps": 30                         // 24/25/30/60
  }
}
```

**Animation Library**: https://docs.meshy.ai/api/animation-library

**Common Action IDs** (verify in library):
- `0` - Idle
- `1` - Walking
- `2` - Running
- `3` - Talking (if available)

**Response**: `{ "animation_task_id": "..." }`

**Polling**: `GET /openapi/v1/animations/{animation_task_id}`

**Returns**: Animated model URL

## Complete Workflow Example

```typescript
// 1. Generate Preview (Geometry)
const previewTaskId = await createPreview({
  prompt: "a humanoid character in T-pose",
  target_polycount: 10000,
  topology: "triangle",
  should_remesh: true,
  pose_mode: "t-pose"
});

// 2. Refine (Add Textures)
const refineTaskId = await createRefine({
  preview_task_id: previewTaskId,
  enable_pbr: false  // Base color only
});

// 3. Optional: Remesh (Final Optimization)
const remeshTaskId = await remesh({
  model_url: refinedModelUrl,
  target_polycount: 10000,
  topology: "triangle"
});

// 4. Rig
const rigTaskId = await rig({
  input_task_id: refineTaskId,  // Or use model_url
  rig_preset: "STANDARD_HUMANOID",
  height_meters: 1.75
});

// 5. Add Animations
const idleAnimId = await addAnimation({
  rig_task_id: rigTaskId,
  action_id: 0  // Idle
});

const walkAnimId = await addAnimation({
  rig_task_id: rigTaskId,
  action_id: 1  // Walking
});
```

## Mobile Performance Targets

### Recommended Settings

**AR Characters**:
- Polycount: **6,000-15,000 triangles**
- Topology: **Triangle**
- Textures: **Base color only** (`enable_pbr: false`)
- Texture Resolution: **1024x1024** (or lower if acceptable)

**AR Props**:
- Polycount: **1,000-8,000 triangles**
- Topology: **Triangle**
- Textures: **Base color only**

### Performance Notes

- **Polycount is only one part of performance** - You'll still want to benchmark on device
- **Texture size matters** - 1024x1024 is usually sufficient for mobile
- **Animation complexity** - More bones = more CPU usage
- **Test on target devices** - Different devices have different capabilities

## Important Notes

### About "Preview Model"

- **"Preview"** in Meshy means **geometry-only** (no textures)
- **"Not preview"** = **textured model** (from refine stage)
- For mobile, you want **textured** but **lightweight** (use refine with `enable_pbr: false`)

### About Rigging

- Models must be **humanoid** with clear limb/body structure
- **T-pose or A-pose** is essential for best results
- Rigging works on **both preview and refined models**
- Use `input_task_id` when possible (more efficient than `model_url`)

### About Animations

- Meshy provides **body animations** (walking, idle, etc.)
- **Visemes/facial blendshapes** are NOT included
- For talking animations, you may need to add facial blendshapes separately (Blender/Maya)
- Animation library has 500+ presets - check docs for action_id values

### About Visemes

- Meshy's rigging + animation gives you **body animations only**
- **Viseme-ready facial blendshapes** are a separate requirement
- You'll likely need to:
  - Add/clean up facial blendshapes in Blender/Maya
  - Or use a character pipeline that guarantees ARKit/OVR-style visemes

## Parameter Reference

### Text-to-3D Preview
- `ai_model` - AI model to use
- `topology` - "triangle" or "quad"
- `target_polycount` - Target polygon count
- `should_remesh` - **Must be true** for polycount to work
- `symmetry_mode` - "x", "y", "z", or null
- `pose_mode` - "t-pose", "a-pose", or null

### Text-to-3D Refine
- `enable_pbr` - Set to `false` for lightweight (base color only)
- `texture_prompt` - Optional text prompt for texturing
- `texture_image_url` - Optional reference image

### Remesh
- `target_formats` - ["glb"] or ["gltf"]
- `topology` - "triangle" or "quad"
- `target_polycount` - Final target
- `resize_height` - Character height in meters
- `origin_at` - "center", "bottom", etc.

### Rigging
- `input_task_id` - Task ID from previous stage (preferred)
- `model_url` - Direct model URL (alternative)
- `rig_preset` - "STANDARD_HUMANOID" or "QUADRUPED"
- `height_meters` - Character height (improves accuracy)
- `texture_image_url` - Base color texture (optional)

### Animation
- `rig_task_id` - From rigging stage
- `action_id` - From Animation Library
- `post_process.operation_type` - "change_fps"
- `post_process.fps` - 24, 25, 30, or 60

## Common Mistakes to Avoid

1. ❌ **Forgetting `should_remesh: true`** - Your polycount target will be ignored
2. ❌ **Using `enable_pbr: true`** - Adds unnecessary texture maps (heavier)
3. ❌ **Skipping refine stage** - You'll get untextured geometry
4. ❌ **Not using T-pose** - Rigging may fail or be inaccurate
5. ❌ **Too high polycount** - 50k+ triangles is overkill for mobile
6. ❌ **Using quad topology** - Triangles are better for mobile runtime

## Resources

- **Meshy Text-to-3D API**: https://docs.meshy.ai/api-reference/text-to-3d
- **Meshy Remesh API**: https://docs.meshy.ai/api/remesh
- **Meshy Rigging API**: https://docs.meshy.ai/en/api/rigging-and-animation
- **Meshy Animation API**: https://docs.meshy.ai/api/animation-library
- **Meshy Animation Library**: https://docs.meshy.ai/api/animation-library

## Implementation Checklist

- [ ] Set `target_polycount` to 6k-15k for characters
- [ ] Set `topology: "triangle"`
- [ ] Set `should_remesh: true` (critical!)
- [ ] Set `pose_mode: "t-pose"` for characters
- [ ] Use two-stage workflow (preview → refine)
- [ ] Set `enable_pbr: false` in refine stage
- [ ] Optional: Add remesh pass for final optimization
- [ ] Rig with `STANDARD_HUMANOID` preset
- [ ] Add animations with appropriate `action_id` values
- [ ] Test on target mobile devices
- [ ] Benchmark performance (FPS, memory usage)
