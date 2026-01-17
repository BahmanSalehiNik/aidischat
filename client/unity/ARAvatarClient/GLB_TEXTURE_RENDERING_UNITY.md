# GLB Texture Rendering in Unity (Runtime + Editor) — Findings & Checklist

This doc focuses on **GLB** (binary glTF) in Unity: why textures sometimes don’t render (flat/gray) or turn **magenta/purple**, what’s different vs `.gltf`, and how to debug/fix it—especially with **URP** and runtime downloading using **GLTFast**.

## What’s different about GLB vs glTF (and what’s *not*)

### GLB is just a container

GLB is a binary container for the same glTF 2.0 scene/material model. Most importantly:

- **Often** (but not guaranteed) GLB is self-contained: geometry + images are embedded.
- Materials are still glTF PBR (base color, metallic-roughness, normal, occlusion, emissive, alpha modes).

### Practical consequence

Compared to `.gltf` (JSON + separate files), GLB usually avoids the biggest runtime headache:

- **No relative-path texture resolution** (common for `.gltf`) because images are embedded.

So when a GLB is “untextured/purple”, the top suspects become:

- **Shader / render pipeline mismatch** (URP project using Built-in shaders)
- **Build-time shader stripping**
- **Texture decode support** (PNG/JPEG vs KTX2)
- **Memory pressure** when downloading/instantiating on mobile
- **Your own code replacing materials**

## Top causes of “no texture / purple” for GLB (ranked)

### 1) Render pipeline / shader mismatch (URP vs Built-in)

In URP projects, Built-in shaders (e.g., `Standard`, `Mobile/Diffuse`, `Unlit/Color`) are not the right target. If materials end up with an invalid shader, Unity renders **magenta/purple**.

**Fix**
- Ensure the importer generates **URP-compatible** materials (URP Lit/Unlit or importer-provided shader graphs).
- Avoid forcing Built-in shaders in URP.

### 2) Shader stripping in builds (“works in Editor, broken on device/build”)

Even if the model looks fine in Editor, builds can strip shader variants needed for glTF/GLB materials, causing magenta/purple or missing features.

**Fix (GLTFast-specific, recommended)**
- Use a **ShaderVariantCollection** and add it to **Project Settings → Graphics → Preloaded Shaders**.
- See GLTFast Project Setup: `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`

### 3) You replaced the materials (textures discarded)

If you override every renderer with a “debug material”, you remove the original texture references. The model becomes flat.

**Fix**
- Keep importer-generated materials for “real rendering”.
- If debugging, override only temporarily and restore afterwards.

### 4) Texture decoding support (PNG/JPEG vs KTX2)

GLB may contain embedded images in formats like PNG/JPEG, or it may use KTX2/Basis textures (depending on how it was authored).

If the project/device can’t decode the embedded format, textures won’t show.

**Fix**
- Ensure your project supports the texture formats used by the GLB.
- GLTFast Project Setup mentions enabling/disabling texture-related packages (notably around PNG/JPEG import/export and build size). For KTX2, you generally need the appropriate Unity support/plugin (commonly referred to as “KTX for Unity” / “KtxUnity” in ecosystem docs).

### 5) Mobile memory pressure (Android/iOS) when downloading big GLBs

At runtime, GLB loading often involves:

- Downloading a big byte array (GLB)
- Parsing it (allocations)
- Decoding textures (temporary buffers)
- Uploading textures/meshes to GPU

On mobile, this can lead to textures failing to load, missing textures, or unstable rendering.

**Fix**
- Use smaller test assets first.
- Prefer compressed textures (platform-appropriate) and reasonable resolutions.
- Avoid unnecessary “Read/Write Enabled” settings when not needed (doubles memory for textures).

### 6) Color space / import semantics (PBR data vs color textures)

Even when textures render, they can look “wrong” if:

- Base color is treated as Linear instead of sRGB
- Normal maps aren’t treated as normal maps
- Metallic/roughness packing isn’t interpreted correctly by your shader/material generator

Importers like GLTFast/UnityGLTF typically handle this, but manual material conversion can break it.

## Recommended approach for textured GLB in Unity (2026-era)

### Option A: GLTFast for runtime (GLB)

Use GLTFast’s GLB loading path (binary load) and let it generate materials. Don’t override materials unless debugging.

If you see “purple only in builds”, apply GLTFast’s **Project Setup** guidance around shader preloading/variants:

- `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`

### Option B: UnityGLTF shader graphs for glTF PBR in URP

If you need an URP-friendly shader graph set tailored to glTF PBR, UnityGLTF provides graphs like:

- `UnityGLTF/PBRGraph`
- `UnityGLTF/UnlitGraph`

Repo: [https://github.com/KhronosGroup/UnityGLTF](https://github.com/KhronosGroup/UnityGLTF)

## Debug checklist (GLB)

### A) Verify the GLB is actually textured

- Open the GLB in a known-good viewer (e.g., a glTF viewer) to confirm textures are present.
- If the GLB looks untextured everywhere, the asset might be missing images or references.

### B) In Unity, confirm materials have textures assigned

In Play Mode, inspect a renderer:
- Does the material have a **BaseMap/Albedo** texture assigned?
- Does it have normal/metallic maps?

If you see no textures, either:
- The asset truly has none, or
- Material generation failed, or
- Your code replaced materials.

### C) If it’s magenta/purple: identify the shader

Purple usually means:
- `Hidden/InternalErrorShader`, or
- a shader missing in build / incompatible with the active render pipeline.

### D) Lighting sanity check (AR)

If it’s “gray”, try forcing **Unlit** (just for a single material) to see whether the base color texture is actually present. If it looks correct in Unlit, your issue is lighting/environment, not texture loading.

### E) Build-only issues

If it works in Editor but fails on device/build:
- Treat shader stripping / missing variants as the primary suspect.
- Use the GLTFast Project Setup “Shader Preloading” workflow (ShaderVariantCollection + Preloaded Shaders).

## Performance notes for GLB in AR

- Prefer modest texture sizes; AR apps are often memory-bound.
- Consider compressed textures (including KTX2/Basis workflows where supported) for runtime performance.
- Avoid keeping CPU copies of mesh/texture data unless needed.

## References

- glTF 2.0 specification (Khronos): `https://www.khronos.org/gltf/`
- GLTFast Project Setup (Unity docs): `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`
- glTFast (runtime importer): [https://github.com/atteneder/glTFast](https://github.com/atteneder/glTFast)
- UnityGLTF (Khronos): [https://github.com/KhronosGroup/UnityGLTF](https://github.com/KhronosGroup/UnityGLTF)


