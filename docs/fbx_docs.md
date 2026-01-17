# FBX in Unity vs GLB (glTF) + Meshy Outputs — Findings

## Summary

- **Unity FBX pipeline is mature** for skinned meshes + animations (classic DCC → Unity workflows).
- **GLB is usually better for “single file includes textures”** (embedded images/materials), *if the GLB actually contains materials/textures*.
- In our current Meshy runs, we observed cases where:
  - Meshy’s **textured model** (`.../output/model.glb`) **does contain** textures/materials.
  - Meshy’s **rigged base** (`.../Character_output.glb`) **does not contain** textures/materials (0 images/textures/materials).
  - Meshy’s **animation-with-skin** GLBs (`Animation_*_withSkin.glb`) can also be **untextured** (0 images/textures/materials).

This means “no color” in Unity can be caused by the **asset returned by Meshy rigging/animation** being untextured, not by Unity/URP stripping textures.

---

## Is FBX easier to use with Unity?

### Pros
- **Strong native import**: Unity’s built-in FBX pipeline is widely used and stable.
- **Common for rigs/animations**: humanoid rigs, animation clips, retargeting, and Animator workflows are typically FBX-first in many teams.

### Cons / gotchas
- **Textures are often not self-contained**:
  - In many pipelines, FBX references external texture image files rather than embedding them.
  - Even when “embedding” is possible, Unity import behavior depends on exporter settings and the originating tool.
- **Runtime loading**: GLB/glTF is commonly used for runtime loading (e.g., glTFast). FBX runtime loading is not a standard Unity feature.

**Practical takeaway**: FBX can be “easier” inside Unity for animation workflows, but it is not automatically better for “single file includes textures”.

---

## Does Meshy provide FBX with textures + animation?

### What our backend already expects
In `backEnd/ar-avatar/src/services/providers/meshy-provider.ts`, the rigging poller will accept FBX if Meshy returns it:

```ts
modelUrl: result.rigged_character_glb_url ||
         result.rigged_character_fbx_url ||
         result.model_urls?.glb || 
         result.model_urls?.gltf || 
         result.model_url || 
         result.url || '',
```

So **Meshy can provide an FBX URL** (`rigged_character_fbx_url`) for the rigged character.

### What is NOT yet confirmed (needs validation)
- Whether Meshy’s **FBX** output:
  - **embeds textures**, or
  - references textures as separate files, or
  - returns additional URLs (texture images) that Unity must download/import alongside the FBX.
- Whether Meshy’s **animation endpoints** can return FBX (similar to GLB) with the same rig.

---

## Key evidence from our environment

### 1) Textured Meshy model is truly textured
We downloaded Meshy’s remeshed `output/model.glb` and inspected the GLB JSON:
- `images: 1`, `textures: 1`, `materials: 1`
- has `pbrMetallicRoughness.baseColorTexture`

### 2) Rigged Meshy GLB can be untextured
We downloaded Meshy’s `Character_output.glb` and inspected the GLB JSON:
- `images: 0`, `textures: 0`, `materials: 0`

### 3) Azure-stored GLB Unity receives can be untextured
We downloaded the Azure Blob URL Unity uses and inspected it:
- `images: 0`, `textures: 0`, `materials: 0`

Meaning: Unity is receiving an untextured asset, so it can’t show “color” unless we override it with a debug material.

---

## Recommended next checks (no merging/extraction)

1. **If Meshy returns `rigged_character_fbx_url`, download it and inspect**:
   - Does it include texture data or references?
2. **Confirm whether Meshy supports a “textured rig” output directly** via:
   - rigging with `input_task_id` (refine task id), and/or
   - any optional `texture_image_url` parameter, and/or
   - alternative Meshy endpoints/settings for “textured rigged character export”.

---

## Notes
- This document intentionally avoids suggesting any **client-side merging** (GLB<->GLTF conversion, extraction, or material/clip merging). The focus is on what Meshy provides and how Unity typically consumes FBX/GLB assets.


