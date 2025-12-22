# Meshy Animation Research & Implementation

## Research Summary

Based on Meshy.ai documentation and Three.js best practices, this document outlines how to properly animate Meshy-generated 3D models and fix common issues.

## Meshy API Structure

### Correct API Endpoints

**Auto-Rigging:**
- **Endpoint**: `POST /openapi/v1/rigging`
- **Request**: 
  ```json
  {
    "model_url": "URL_TO_YOUR_3D_MODEL",
    "rig_preset": "STANDARD_HUMANOID" // Optional
  }
  ```
- **Response**: `{ "rigging_task_id": "..." }`
- **Polling**: `GET /openapi/v1/rigging/{id}`

**Animation:**
- **Endpoint**: `POST /openapi/v1/animations`
- **Request**:
  ```json
  {
    "rig_task_id": "RIGGING_TASK_ID",
    "action_id": 1, // From Meshy animation library
    "fps": 30 // Optional
  }
  ```
- **Response**: `{ "animation_task_id": "..." }`
- **Polling**: `GET /openapi/v1/animations/{id}`

### Animation Library

Meshy has 500+ animation presets with unique `action_id` values. You need to:
1. Check Meshy's animation library documentation: https://docs.meshy.ai/api/animation-library
2. Map your movement states (idle, talking, walking) to Meshy `action_id` values
3. Apply multiple animations by calling the animation API multiple times (one per animation)

**Note**: Currently, the implementation uses `action_id: 1` as a placeholder. You should:
- Query Meshy's animation library API to get available animations
- Map `MovementState` enum values to appropriate `action_id` values
- Store multiple animations in the GLB model (Meshy may support this, or you may need to combine them)

## Model Disappearing Issue - Root Causes & Fixes

### Problem
When clicking animation test buttons, the avatar model disappears from view.

### Root Causes (from Three.js research)

1. **Frustum Culling with Skinned Meshes**
   - Skinned meshes (required for animations) have dynamic bounding boxes
   - Three.js may incorrectly cull the model during animation
   - **Fix**: Disable frustum culling for skinned meshes

2. **Bounding Box Not Updating**
   - Skinned mesh bounding boxes don't update automatically during animation
   - Model may be culled when it moves outside the original bounding box
   - **Fix**: Expand bounding box and disable culling

3. **Fallback Animation Issues**
   - Fallback animations were using large scale/rotation changes (1.05 scale, 0.1 rotation)
   - This could move the model outside the camera's view frustum
   - **Fix**: Use very subtle changes (1.02 scale, 0.05 rotation)

4. **Camera Near/Far Planes**
   - If camera planes are too narrow, model may disappear when it moves
   - **Fix**: Ensure camera can see the entire model range

### Implemented Fixes

#### 1. Disable Frustum Culling for Skinned Meshes
```typescript
if (child instanceof THREE.SkinnedMesh) {
  child.frustumCulled = false;
  // Expand bounding box
  if (child.geometry) {
    child.geometry.computeBoundingBox();
    if (child.geometry.boundingBox) {
      child.geometry.boundingBox.expandByScalar(2);
    }
  }
}
```

#### 2. Subtle Fallback Animations
- **Talking**: Scale 1.02 (was 1.05) - very subtle pulse
- **Thinking**: Rotation 0.05 (was 0.1) - subtle tilt
- **Walking**: Rotation -0.05 (was -0.1) - subtle lean
- **Idle**: Reset to original position/scale

#### 3. Camera Plane Adjustment
```typescript
// Ensure camera can see the entire model
const modelDistance = Math.max(size.x, size.y, size.z) * scale * 2;
camera.near = 0.01;
camera.far = Math.max(modelDistance, 1000);
camera.updateProjectionMatrix();
```

## Implementation Status

### ✅ Completed
- Fixed Meshy API endpoints (`/openapi/v1/rigging` and `/openapi/v1/animations`)
- Fixed model disappearing issue (frustum culling, bounding boxes)
- Improved fallback animations (more subtle)
- Camera plane adjustments

### ⚠️ TODO
1. **Map Meshy Animation Library**
   - Query Meshy's animation library API
   - Map `MovementState` enum to Meshy `action_id` values
   - Update `meshy-provider.ts` to use correct `action_id` for each movement

2. **Multiple Animations**
   - Determine if Meshy supports multiple animations in one GLB
   - If not, generate separate GLB files per animation and combine client-side
   - Or use Meshy's animation API multiple times and merge results

3. **Animation Testing**
   - Test with actual Meshy-rigged and animated models
   - Verify animations play correctly in Three.js
   - Test animation transitions

## Workflow for Meshy Models with Animations

1. **Generate Model** (text-to-3D)
   - `POST /v2/text-to-3d` → Get `modelUrl`

2. **Auto-Rig Model**
   - `POST /openapi/v1/rigging` with `model_url`
   - Poll `GET /openapi/v1/rigging/{id}` until complete
   - Get rigged `modelUrl`

3. **Add Animations** (for each animation needed)
   - `POST /openapi/v1/animations` with `rig_task_id` and `action_id`
   - Poll `GET /openapi/v1/animations/{id}` until complete
   - Get animated `modelUrl` (GLB format)

4. **Load in Three.js**
   - Load GLB with `GLTFLoader`
   - Check for `gltf.animations` array
   - Use `AnimationController` to play animations

## Resources

- **Meshy Rigging & Animation API**: https://docs.meshy.ai/en/api/rigging-and-animation
- **Meshy Animation Library**: https://docs.meshy.ai/api/animation-library
- **Three.js GLTF Animation**: https://threejs.org/docs/#manual/en/introduction/Animation-system
- **Three.js Frustum Culling**: https://threejs.org/docs/#api/en/core/Object3D.frustumCulled

## Testing Checklist

- [ ] Test with Meshy-rigged model (no animations) - should not disappear
- [ ] Test with Meshy-animated model - animations should play
- [ ] Test fallback animations - should be subtle and not cause disappearing
- [ ] Test animation transitions - should be smooth
- [ ] Test with different camera angles - model should remain visible
- [ ] Test with multiple animations - all should work
