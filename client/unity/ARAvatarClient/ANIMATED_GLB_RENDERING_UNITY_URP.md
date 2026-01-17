# Animated GLB Rendering in Unity (URP) — Best Shaders + Required Setup

This doc focuses on **animated GLB** (typically **skinned** characters) loaded at runtime in Unity **URP** (with GLTFast), and answers:

- Why **Duck.glb** can render while **Fox.glb** doesn’t
- Whether it’s **shader** vs **animation** vs **culling**
- What shader is “best” for animated GLBs
- What project/code changes are required to make this robust **on device**

## Key point: animation ≠ special shader, but skinned meshes are less forgiving

Animated character GLBs usually use `SkinnedMeshRenderer`. That changes:

- how Unity computes **bounds** for visibility (frustum culling)
- how “root motion” can move the model out of view
- how critical it is that your post-load code **does not crash**

Static models like Duck use `MeshRenderer`/`MeshFilter` and often render “fine” even if post-load code fails.

## What “best shader” means in practice

There are two “best” answers depending on your goal:

### A) Best for glTF material fidelity (recommended for glTF/GLB)

**Use GLTFast’s glTF shader graphs** (e.g. `glTF-pbrMetallicRoughness`, `glTF-unlit`) when possible.

Why:
- They’re designed to match glTF’s PBR material model (metallic-roughness, etc.)
- They’re intended to be pipeline-compatible with URP
- They reduce the “property mismatch” issues when you try to force URP/Lit yourself

### B) Best “generic Unity URP” shader

**`Universal Render Pipeline/Lit`** is the standard URP PBR shader.

However, it’s not automatically “best” for runtime glTF assets because:
- glTF uses different packing conventions for metallic/roughness than URP expects
- your code might set the wrong properties (`_BaseColor` vs `_Color`, `_BaseMap` vs `_MainTex`)
- most importantly: **it can be stripped from builds** (then `Shader.Find(...)` returns null on device)

### Debug shader (to prove geometry/texture)

**`Universal Render Pipeline/Unlit`** is the best debug shader in URP:
- removes lighting from the equation
- makes it obvious whether the mesh/texture is present

## Why “URP/Lit resulted in no render” (most common causes)

### 1) Shader stripping in builds

On Android builds, Unity may strip shaders/variants that are not referenced by assets/scenes at build time.

Symptoms:
- `Shader.Find("Universal Render Pipeline/Lit")` returns **null** on device
- creating a `new Material(null)` can throw `ArgumentNullException`
- your loader coroutine can crash post-instantiation, leaving the scene half-configured

Fix options (choose one):
- **Always Included Shaders**: add `Universal Render Pipeline/Lit` (and Unlit) in **Project Settings → Graphics**
- **GLTFast ProjectSetup workflow**: build a **ShaderVariantCollection** and add it to **Preloaded Shaders**

Reference:
- GLTFast Project Setup: `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`

### 2) Material property mismatch

URP/Lit uses `_BaseColor` and `_BaseMap`.
Built-in shaders use `_Color` and `_MainTex`.

If you override materials and only set `material.color` or `_Color` without ensuring `_BaseColor` is set, appearance can break.
This usually causes “wrong look”, not total invisibility, but it matters if you’re relying on a debug override.

### 3) You’re overriding materials at all

If you override all materials with a debug material, you:
- throw away importer-generated textures/material settings
- increase your dependence on a fallback shader being present in the build

For animated/skinned models, if your “post-load” step crashes, the model often ends up invisible or culled.

## Why Duck is visible but Fox isn’t (most likely causes)

### 1) Post-load code crash affects Fox more

If the coroutine crashes immediately after instantiation (common when a fallback shader is null), Duck might still show because:
- the instantiated meshes are static and immediately visible

Fox might not show because:
- it’s skinned and may need bounds stabilization (`updateWhenOffscreen`, correct bounds) to avoid being culled
- or it begins animating and quickly moves out of view

### 2) SkinnedMeshRenderer bounds / frustum culling

Skinned meshes can disappear if their bounds are wrong.

Common fixes:
- `SkinnedMeshRenderer.updateWhenOffscreen = true`
- set `SkinnedMeshRenderer.localBounds` large enough to cover the animation range

### 3) Root motion (Run/Walk clips translate the character)

Fox sample clips like Run/Walk translate the rig, so the model can “walk away” and appear to vanish.

Mitigations:
- default to an idle clip (“Survey”)
- disable/ignore root motion or lock the root transform’s translation

## Required changes checklist (robust on-device)

### Project setup (URP + GLTFast)

- Ensure GLTFast shader graphs you rely on are included in builds:
  - ShaderVariantCollection / Preloaded Shaders, per GLTFast ProjectSetup
- Ensure URP fallback shaders you rely on are included in builds (if you use them):
  - `Universal Render Pipeline/Lit`
  - `Universal Render Pipeline/Unlit`

### Runtime loader behavior

- Prefer **not** overriding materials when testing “real” textures.
- If you *do* override, always:
  - select URP-compatible shader first
  - handle property names correctly (`_BaseColor` / `_BaseMap`)
  - **never** create a material from a null shader; guard against null

### Skinned/animated model visibility

- After instantiation:
  - enable renderers + parent GameObjects
  - set `SkinnedMeshRenderer.updateWhenOffscreen = true`
  - expand `SkinnedMeshRenderer.localBounds` if you see culling
- Handle root-motion clips:
  - pick an idle clip by default
  - optionally lock root translation

### Animation import

GLTFast exposes clips via `GetAnimationClips()` behind a compile-time define:

- `#if UNITY_ANIMATION`

If you see no clips on device, verify your build scripting defines / Unity version settings include animation support for GLTFast.

## Practical “best shader” recommendation for your app

Given you are loading glTF/GLB at runtime in URP:

- **Primary**: GLTFast’s **glTF PBR shader graph** (`glTF-pbrMetallicRoughness`)
- **Fallback/debug**: `Universal Render Pipeline/Unlit`
- **Generic**: `Universal Render Pipeline/Lit` only if you also handle:
  - shader inclusion in build
  - property mapping for textures/colors

## References

- URP Lit shader docs: `https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@16.0/manual/lit-shader.html`
- GLTFast Project Setup: `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`


