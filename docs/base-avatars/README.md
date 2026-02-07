# Base Avatars — Index

This folder contains **all docs related to the “Base Avatars” pivot** (prebuilt avatars shipped inside the Unity app build; runtime rendering/downloading is lower priority).

## Files

- `base-avatars.md`
  - The high-level plan for shipping **in-build base avatars** (starting with 1).
- `meshy-addons.md`
  - What the downloaded **Meshy Blender + Unity addons** do, how to install/use them, and how they fit our base-avatar pipeline.
- `blender-setup.md`
  - Whether you need Blender, how to install it, and how it fits into a Unity pipeline.
- `base-avatars-blendshapes.md`
  - The **blendshape spec** (visemes + emotions) and a step-by-step authoring + validation workflow.
- `base-avatars-animation.md`
  - How we package **idle + movement/gesture animations** in the Unity build and how runtime selects/plays them.
- `base-avatars-tts.md`
  - How we generate **TTS audio + visemes** and drive `LipSyncController` with real timing (replacing current placeholder viseme logic).

## Related (existing) docs elsewhere

We reuse/anchor on these existing docs, but we keep “base avatars” docs in this folder:

- Meshy generation + rigging research:
  - `docs/MESHY_LIGHTWEIGHT_MODELS.md`
  - `docs/MESHY_RIGGING_ANIMATION.md`
  - `docs/fbx_docs.md` (important: Meshy rigged/animated outputs can be **untextured**)
- Viseme strategy research:
  - `docs/ar-viseme-options.md`
  - `docs/ANIMATION_VISEME_DESIGN.md`


