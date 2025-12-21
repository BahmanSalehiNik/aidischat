# Meshy.ai Rigging & Animation - Deep Research

## Executive Summary

✅ **Preview models CAN be rigged** - Both Preview and HD modes support rigging and animation. Preview mode is actually ideal for lightweight, fast-to-generate models.

## Key Findings

### 1. Preview vs HD Mode for Rigging

**Preview Mode:**
- ✅ **Supports rigging and animation** - Fully compatible
- ✅ **Faster generation** - Ideal for rapid prototyping
- ✅ **Lower resolution** - Creates lightweight models perfect for mobile
- ✅ **Lower cost** - Uses fewer API credits
- ✅ **Faster rigging** - Less geometry to process

**HD Mode:**
- ✅ **Supports rigging and animation** - Fully compatible
- ❌ **Slower generation** - Takes longer to create
- ❌ **Higher resolution** - Larger file sizes (may be too heavy for mobile)
- ❌ **Higher cost** - Uses more API credits
- ⚠️ **Slower rigging** - More geometry to process

**Recommendation**: Use **Preview Mode** for mobile avatars. It's perfect for lightweight, riggable models.

### 2. Rigging Requirements

#### ✅ What Works:
- **Format**: GLB (recommended), GLTF, OBJ, FBX, STL
- **Model Type**: Humanoid (bipedal) with clear limbs and body structure
- **Texture**: Must be textured (not untextured meshes)
- **Pose**: T-pose or A-pose (recommended for best results)
- **Access**: Model must be publicly accessible via URL

#### ❌ What Doesn't Work:
- Untextured meshes
- Non-humanoid assets
- Humanoid assets with unclear limb/body structures
- Models in complex poses (not T/A-pose)

### 3. API Endpoints & Parameters

#### Text-to-3D (Step 1)
```
POST /v2/text-to-3d
{
  "prompt": "a skinny boxer",
  "mode": "preview",  // or "hd"
  "art_style": "sculpture",  // or "realistic"
  "negative_prompt": "blurry, low quality, distorted, deformed"
}
```

**Response**: `{ "result": "task_id" }`

**Polling**: `GET /v2/text-to-3d/{task_id}`

**Returns**: Model URL (GLB format)

#### Auto-Rigging (Step 2)
```
POST /openapi/v1/rigging
{
  "model_url": "https://public-url.com/model.glb",
  "rig_preset": "STANDARD_HUMANOID",  // Optional
  "height_meters": 1.75  // Optional - improves rigging accuracy
}
```

**Response**: `{ "rigging_task_id": "..." }`

**Polling**: `GET /openapi/v1/rigging/{rigging_task_id}`

**Returns**: Rigged model URL (GLB format)

#### Animation (Step 3)
```
POST /openapi/v1/animations
{
  "rig_task_id": "rigging_task_id",
  "action_id": 1,  // From Meshy animation library
  "fps": 30  // Optional
}
```

**Response**: `{ "animation_task_id": "..." }`

**Polling**: `GET /openapi/v1/animations/{animation_task_id}`

**Returns**: Animated model URL (GLB format)

### 4. Creating Lightweight Riggable Models

#### Strategy 1: Use Preview Mode (Recommended)
```typescript
{
  mode: 'preview',  // Lower resolution = lighter weight
  art_style: 'sculpture',  // Stylized = fewer polygons
  prompt: 'a simple humanoid character in T-pose'  // Explicit T-pose request
}
```

**Benefits**:
- Fast generation (~30-60 seconds)
- Lightweight output (~1-5 MB)
- Perfect for mobile
- Still fully riggable

#### Strategy 2: Optimize Prompt for Lightweight
```typescript
{
  prompt: 'a low-poly humanoid character, simple geometry, T-pose, game-ready',
  negative_prompt: 'high poly, detailed, complex geometry, high resolution'
}
```

#### Strategy 3: Post-Processing (If Needed)
After generation, you could:
1. Use Meshy's remeshing API to reduce polygons
2. Compress textures
3. Use GLB compression

### 5. T-Pose / A-Pose Requirement

**Critical**: Models should be in T-pose or A-pose for best rigging results.

**Options**:
1. **Request in prompt**: "a humanoid character in T-pose"
2. **Use Meshy UI**: There's an A/T-Pose switch in Meshy's UI (but not clear if available via API)
3. **Post-process**: Use Blender to convert to T-pose (adds complexity)

**Current Implementation**: We should add T-pose to the prompt.

### 6. Model URL Accessibility

**Requirement**: Model URL must be publicly accessible.

**Options**:
1. **Meshy's CDN**: Models from Meshy API are already publicly accessible
2. **Your Storage**: Upload to Azure/S3 with public access
3. **Temporary URL**: Generate signed URL with long expiration

**Current Implementation**: We download and store in Azure/S3, so we need to ensure public access or use signed URLs.

### 7. Animation Library

Meshy has **500+ animation presets** with unique `action_id` values.

**Common Animations** (need to query library for actual IDs):
- Idle animations: ~1-50
- Walking animations: ~100-200
- Talking animations: ~300-400
- Combat animations: ~500-600

**To Get Animation IDs**:
- Query Meshy's animation library API (if available)
- Or use Meshy UI to find action_id values
- Or use default/common IDs (1, 2, 3, etc.)

### 8. Cost & Performance

**Preview Mode**:
- Text-to-3D: ~5-10 credits
- Rigging: 5 credits
- Animation: 3 credits per animation
- **Total**: ~13-18 credits per avatar (with 1 animation)

**HD Mode**:
- Text-to-3D: ~20-30 credits
- Rigging: 5 credits
- Animation: 3 credits per animation
- **Total**: ~28-38 credits per avatar (with 1 animation)

**Recommendation**: Use Preview Mode to save credits and get faster results.

### 9. Workflow Optimization

#### Current Workflow (Inefficient):
1. Generate model (Preview) ✅
2. Download & store ✅
3. Rig model ✅
4. Add animation ✅
5. Download & store again ❌ (duplicate storage)

#### Optimized Workflow:
1. Generate model (Preview) → Get URL
2. Rig model (use Meshy URL directly) → Get rigged URL
3. Add animation (use rigged URL) → Get animated URL
4. Download & store final animated model (once)

**Benefit**: Only store final model, not intermediate versions.

### 10. Error Handling

**Common Issues**:
1. **"Model not humanoid"**: Ensure prompt specifies humanoid character
2. **"Untextured mesh"**: Meshy text-to-3d should always texture, but verify
3. **"Unclear body structure"**: Add explicit body parts to prompt
4. **"Rigging failed"**: Check model is in T-pose, try different rig_preset
5. **"Animation failed"**: Verify rigging completed, check action_id exists

## Implementation Recommendations

### 1. Update Text-to-3D Prompt
```typescript
const prompt = `${description.text}, humanoid character in T-pose, simple geometry, game-ready, mobile-optimized`;
```

### 2. Add Height Parameter
```typescript
{
  model_url: modelUrl,
  rig_preset: 'STANDARD_HUMANOID',
  height_meters: 1.75  // Average human height, improves rigging
}
```

### 3. Use Preview Mode (Already Done)
```typescript
mode: 'preview'  // ✅ Already correct
```

### 4. Optimize Storage
- Only store final animated model
- Use Meshy URLs directly for rigging/animation steps
- Download once at the end

### 5. Add Multiple Animations
- Request multiple animations (idle, talking, walking)
- Each animation costs 3 credits
- Store all animations in one GLB (if Meshy supports it) or separate files

## Testing Checklist

- [ ] Generate Preview model with T-pose in prompt
- [ ] Verify model is publicly accessible
- [ ] Test rigging with STANDARD_HUMANOID preset
- [ ] Test rigging with height_meters parameter
- [ ] Test animation with action_id: 1 (idle)
- [ ] Verify animated model loads in Three.js/Viro
- [ ] Check file size (should be < 5 MB for Preview)
- [ ] Test on mobile device
- [ ] Verify animations play correctly

## Resources

- **Meshy Rigging API**: https://docs.meshy.ai/en/api/rigging-and-animation
- **Meshy Text-to-3D API**: https://docs.meshy.ai/api-reference/text-to-3d
- **Meshy Animation Library**: https://docs.meshy.ai/api/animation-library
- **Meshy Help - T-Pose**: https://help.meshy.ai/en/articles/10255659-how-do-i-create-an-a-t-pose-model

## Conclusion

✅ **Preview models are perfect for rigging** - They're lightweight, fast, and fully compatible with Meshy's rigging/animation API.

✅ **Current implementation is on the right track** - Using Preview mode is correct.

⚠️ **Improvements needed**:
1. Add T-pose to prompt
2. Add height_meters parameter
3. Optimize storage (don't store intermediate models)
4. Use Meshy URLs directly for rigging steps
