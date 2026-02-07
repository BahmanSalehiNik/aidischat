# Base Avatars (Prebuilt, In-Build) — Execution Plan

## Context (Pivot)

We’re putting **runtime rendering / runtime avatar generation** into the backlog (lower priority).

The new near-term goal: ship the Unity app with **one (then a few) base avatars** that are:

- Generated via **Meshy** (provider remains Meshy)
- **Fixed up offline** if needed (textures/rig/blendshapes)
- **Imported into Unity** and shipped **inside the build**
- Ready for:
  - **Idle animation** (minimum)
  - **TTS + visemes** (lip sync)
  - **Emotion blendshapes**

This splits work into two tracks:

- **In-build base avatar track (now / MVP)**
- **Runtime-downloaded avatars track (later)**

## Ground truth in repo (current Unity implementation)

- Runtime model loading exists (`AvatarLoader.cs` via **glTFast** URL loading).
- Facial controllers exist:
  - `LipSyncController.cs` expects viseme blendshapes (22 IDs).
  - `EmotionController.cs` expects emotion blendshapes.
  - `BlendshapeDebugUtil.cs` can dump blendshapes to Unity logs.
- TTS exists (`TTSController.cs`), but **does not produce visemes** (audio-only).
- `ARChatManager.cs` currently plays **placeholder visemes** (cycles IDs) after TTS completes; this must be upgraded for realistic lip sync.

## What “done” means (Base Avatar v1)

- Unity app can load `base-avatar:v1` **without network**.
- Avatar renders with correct URP materials in device builds.
- Avatar has:
  - **Idle** animation loop
  - **Viseme blendshapes** compatible with `LipSyncController` (MVP can start with a subset)
  - **Emotion blendshapes** compatible with `EmotionController`

## Key decisions (make early)

### Packaging (recommended: Addressables local group)

- **Recommended**: Addressables local content (bundled into APK/IPA).
- MVP fallback: `Resources/` if Addressables slows you down initially.

### Asset format inside Unity (GLB vs FBX)

From `docs/fbx_docs.md`: Meshy’s rigged/animated outputs can sometimes be **untextured**, even when the original textured model is fine.

Practical approach:

- Treat **Unity prefab** as the canonical runtime artifact.
- Allow either GLB or FBX as “input artifacts”, but if you need stability for rig/animation, **FBX is often easier in Unity**.

### Blender requirement

If you want **reliable textures + rig + custom facial blendshapes**, you almost certainly need a DCC step.

- Recommended: **Blender**
- Details: see `docs/base-avatars/blender-setup.md`

## Step-by-step phases

### Phase 0 — Define Base Avatar v1 spec (½ day)

- Pick an avatar style/prompt + budgets (tris, texture res).
- Decide which blendshape set is required in MVP:
  - Emotions: happy/sad/angry/excited/neutral
  - Visemes: start with minimal subset or go full 22
- Decide packaging mechanism (Addressables recommended).

### Phase 1 — Generate + download Meshy outputs (½–1 day)

- Generate lightweight textured humanoid (T/A pose).
- Rig it (standard humanoid).
- Generate minimal animations (idle).
- Validate whether the **rigged output is textured**.

### Phase 2 — Offline fixup + author blendshapes (1–3 days)

- Merge/fix textured mesh + rig + animations as needed.
- Add facial blendshapes matching Unity expectations.
- Export Unity-friendly artifact (usually FBX).

Details: see `docs/base-avatars/base-avatars-blendshapes.md` and `docs/base-avatars/blender-setup.md`.

### Phase 3 — Unity import + prefab assembly (½–1.5 days)

- Create folder structure under `Assets/Avatars/BaseAvatars/base-avatar-v1/...`
- Import asset(s), configure:
  - rig/animation import
  - URP materials
  - extract animation clips
- Assemble a prefab:
  - set face `SkinnedMeshRenderer` references on `LipSyncController` / `EmotionController`
- Add prefab to Addressables (address `base-avatar:v1`).

### Phase 4 — Runtime selection path (½–1 day)

- Add a `BaseAvatarCatalog` ScriptableObject:
  - maps `baseAvatarId` → Addressable prefab reference
  - stores “face renderer path” or “renderer name hint”
- Update `AvatarLoader` / `ARChatManager` to support:
  - **Base avatar mode** (default)
  - runtime URL mode (backlog / feature-flagged)

### Phase 5 — TTS + visemes integration (½–2 days for MVP)

Upgrade visemes from “placeholder cycling” to a real timeline:

- Plan doc: `docs/base-avatars/base-avatars-tts.md`

### Phase 6 — Animation integration (½–2 days for MVP)

Make idle + “talking” + gestures deterministic and authored in-build:

- Plan doc: `docs/base-avatars/base-avatars-animation.md`

## Base Avatar v1 checklist (fill during implementation)

- **Avatar ID**: `base-avatar:v1`
- **Triangles**: target ___ / actual ___
- **Textures**: resolution + count ___
- **Rig**: Humanoid yes/no (notes)
- **Animations**: idle yes/no, talking yes/no, gestures ___
- **Blendshapes**:
  - Emotions: happy/sad/angry/excited/neutral yes/no
  - Visemes: full 22 yes/no (if partial, list)
- **Prefab path**: `Assets/Avatars/BaseAvatars/...`
- **Addressables**: group `AvatarModels`, address `base-avatar:v1`
- **Device build**: Android yes/no, iOS yes/no


