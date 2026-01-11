# glTF Texture Rendering in Unity (Runtime + Editor) — Findings & Checklist

This doc summarizes practical, research-backed reasons **glTF/GLB models appear untextured / flat / purple** in Unity, plus a checklist for reliably rendering textures—especially in **URP** projects and when loading `.gltf` at runtime from a URL (external textures).

## Core mental model (why textures “don’t show”)

When you “load a glTF”, there are 3 separate things that must all work:

1. **Resource resolution**: the `.gltf` JSON references external files (`.bin`, `.png/.jpg/.ktx2`) via URIs. A loader must resolve these paths correctly (base URI + relative paths) and successfully download/read them.
2. **Material generation**: glTF defines a PBR material model (baseColor, metallic-roughness, normal, occlusion, emissive, alpha modes, etc.). Unity needs a shader/material setup that can represent this model.
3. **Render pipeline compatibility**: URP/HDRP/Built-in expect different shaders and material properties. If the shader is missing/unsupported in your pipeline or build, Unity will show **magenta/purple** (error shader) or a fallback material.

## Most common root causes (ranked)

### 1) Wrong shader/render pipeline (URP project using Built-in shaders)

If your project uses **URP**, shaders like `Standard`, `Mobile/Diffuse`, `Unlit/Color` are **Built-in RP** shaders. They may be absent/unsupported, or properties won’t match URP’s `_BaseMap/_BaseColor` workflow. This can result in:

- **Magenta/purple** meshes (Unity error shader)
- Textures missing (assigned to the wrong property, or shader doesn’t sample them)

**Fix**:
- Ensure models use **URP-compatible shaders**, e.g. URP Lit / URP Unlit (or the importer’s URP shader graphs).
- Avoid manually overriding materials unless you’re deliberately debugging.

### 2) Material replacement (textures discarded by code)

If you load a glTF and then replace every renderer’s material with a “debug color material”, you have **removed all original texture assignments**. The model will look flat (and may appear purple if the debug shader is invalid).

**Fix**:
- For “real rendering”, keep the importer-generated materials intact.
- If you must override materials, do it selectively and preserve textures (see “PBR texture packing” section).

### 3) External textures for `.gltf` aren’t resolving/downloading

`.gltf` commonly references textures like:

```json
"uri": "DuckCM.png"
```

At runtime, the loader must resolve this relative to the `.gltf` URL and fetch the image. Typical failure modes:

- Wrong base URI (downloading gltf JSON yourself then calling the loader without telling it the base path)
- Hosting/CORS problems (especially on Android, some hosts block or redirect)
- Missing/renamed texture files on the server
- Incorrect content types / redirects that UnityWebRequest can’t follow as expected

**Fix**:
- Prefer letting the importer load directly from the `.gltf` URL (so it can resolve relative resources itself).
- If you must provide glTF JSON manually, use the importer API that also supplies a base URI / download provider / resolver.

### 4) glTF PBR texture packing doesn’t match Unity’s shader expectations

glTF’s metallic-roughness workflow packs data differently than URP Lit expects.

- glTF: **Metallic-Roughness** texture usually packs:
  - **B** = metallic
  - **G** = roughness
- Unity URP Lit: expects metallic/smoothness in a “metallic map”, often using:
  - Metallic in one channel (commonly R), and **smoothness** in **A** (varies by shader/workflow)
  - Smoothness = \(1 - roughness\)

If you assign glTF’s metallicRoughness texture directly to URP’s metallic slot, results can look “wrong” (too glossy/matte).

**Fix**:
- Use an importer that generates compatible materials (GLTFast/UnityGLTF typically handle this).
- If writing a custom material converter, you may need to repack channels (or author a shader that reads glTF packing).

### 5) Texture color space/import settings mismatch (sRGB vs Linear)

Even if textures load, they can look “washed out”, “too dark”, or “wrong” if color space is mishandled.

- BaseColor / Albedo textures should be **sRGB**
- Metallic/Roughness, Occlusion, Normal maps are **data maps** and should be treated as **Linear** (and normal maps need “Normal map” treatment)

**Fix**:
- Prefer importer-generated textures/materials.
- If you’re creating/assigning textures manually, ensure correct sRGB/linear handling and normal map settings.

### 6) Lighting makes it look untextured (especially in AR scenes)

In AR, lighting/environment may be dim or missing, causing Lit materials to look flat/gray.

**Debug trick**:
- Temporarily swap to **Unlit** shader (URP Unlit) and assign the BaseColor texture to verify the texture is actually present.

## Recommended approach (Unity 2026-era) for textured glTF

### Option A: Use **GLTFast** (Unity package) for runtime loading

GLTFast is a high-performance importer commonly used for runtime loading of `.gltf` and `.glb`. It supports a modern glTF workflow and is widely referenced for Unity runtime loading.

- Project/package: [glTFast repository](https://github.com/atteneder/glTFast)
- Unity package name often used in Package Manager: `com.unity.cloud.gltfast` (verify in your Unity version/package registry)

**Key practices**:
- Load from URL for `.gltf` with external textures when possible (so relative URIs resolve correctly).
- Don’t replace materials if you want real textures.
- Ensure URP shaders used by the importer are included in builds (see “Build-time shader stripping”).

### Option B: Use **UnityGLTF** for URP shader graphs that match glTF PBR

UnityGLTF provides glTF import/export and includes shader graphs designed for glTF PBR.

- Project: [KhronosGroup/UnityGLTF](https://github.com/KhronosGroup/UnityGLTF)
- Shader graphs mentioned in docs/readme:
  - `UnityGLTF/PBRGraph` (PBR)
  - `UnityGLTF/UnlitGraph` (unlit)

If you’re in URP and want a straightforward “glTF-like” shader setup, UnityGLTF’s graphs are often a good reference point.

## Debugging checklist (fast, deterministic)

### A) Confirm textures are actually being loaded

- **If `.gltf`**: open the `.gltf` JSON and confirm:
  - `images[].uri` exist and are reachable relative to the `.gltf` location
  - `buffers[].uri` exists (`.bin`), if present
- Host the model on a server that serves static files reliably (avoid weird redirects).

### B) Confirm materials aren’t being overwritten by app code

- Inspect the instantiated model’s renderers in the Hierarchy (Play Mode):
  - Are there multiple materials?
  - Do materials have textures assigned (BaseMap/Albedo slots)?
  - Are you replacing them post-load in a script?

### C) Confirm shader is valid for your pipeline

- If URP:
  - Verify the material’s shader name contains URP (e.g. “Universal Render Pipeline/…”)
  - If you see `Hidden/InternalErrorShader` or magenta rendering, it’s a shader/pipeline/build issue.

### D) Confirm it’s not “just lighting”

- Swap a single material to Unlit and assign base color texture:
  - If it looks correct in Unlit, textures are fine; lighting/URP Lit settings are the issue.

### E) Use Frame Debugger / RenderDoc

- Unity Frame Debugger can show whether the texture is bound for the draw call and which shader pass is used.

## Runtime URL loading: `.gltf` vs `.glb` reliability notes

### `.glb` (binary)
- Self-contained (textures embedded), fewer “missing file” failure modes.
- Good for quick testing and simpler hosting.

### `.gltf` (JSON + external files)
- More moving parts: `.bin` + textures must be accessible.
- Great for iteration and separate texture optimization, but requires correct hosting and URI resolution.

## Performance + mobile notes (AR/Android)

- Consider texture compression pipelines (KTX2 / Basis) for large models.
- Some importers support KTX2 via the appropriate Unity plugin/package.
- If textures “work in Editor but not on device”, suspect:
  - Build-time shader stripping
  - Network/CORS/HTTPS/cert issues on device
  - Memory pressure causing textures to fail to upload

## Build-time shader stripping (why it works in Editor but not in build)

Unity can strip shader variants/shaders in builds. If your glTF importer relies on specific shaders/shader graphs, you may need to:

- Add key shaders to **Always Included Shaders** (Project Settings → Graphics)
- Or include a Shader Variant Collection / ensure materials referencing them are included in scenes/resources

If shaders are stripped, meshes can appear **magenta/purple** in builds even if they looked fine in Editor.

### GLTFast-specific setup note (worth checking in your project)

GLTFast’s own project setup guidance adds a very practical build fix:

- **Shader preloading / variant collection**: run the scene in Editor so GLTFast tracks required variants, then save them as a **ShaderVariantCollection** and add it to **Project Settings → Graphics → Preloaded Shaders**. This reduces “works in Editor, fails in build” shader issues.

It also calls out a few GLTFast scripting defines you may see in projects:

- `GLTFAST_KEEP_MESH_DATA`: keep CPU mesh data (useful if you need colliders/mesh access after upload)
- `GLTFAST_SAFE`: extra validation for broken assets (slower, but more robust)
- `GLTFAST_EDITOR_IMPORT_OFF`: disable GLTFast editor import to avoid conflicts with other importers

## References

- glTF 2.0 specification (Khronos): `https://www.khronos.org/gltf/`
- glTFast (runtime importer): [https://github.com/atteneder/glTFast](https://github.com/atteneder/glTFast)
- GLTFast Project Setup (Unity docs): `https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.1/manual/ProjectSetup.html`
- UnityGLTF (Khronos): [https://github.com/KhronosGroup/UnityGLTF](https://github.com/KhronosGroup/UnityGLTF)
- Unity glossary: Render Texture (useful for AR/advanced rendering contexts): `https://unity.com/en/glossary/render-texture`


