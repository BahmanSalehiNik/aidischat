# Meshy Addons (Blender + Unity) — What They Do & How We Use Them

This is based on the **actual downloaded addon packages** currently in `docs/tmp/`:

- `meshy-blender-plugin-v0.6.0.zip`
- `meshy-for-unity-0.2.2.unitypackage`

## Unity addon: Meshy Bridge (Bridge Edition)

### What it is

The Unity addon is an **Editor-only “bridge server”** that lets the Meshy website send generated models directly into your Unity project.

From the included `README.txt` in the `.unitypackage`:

- Supports **GLB, FBX, and ZIP**
- Imports into `Assets/MeshyImports/`
- Attempts:
  - **automatic materials/textures**
  - **animation clip detection**
  - **AnimatorController generation** (for multiple clips)

### How to install

1. In Unity Editor: `Assets → Import Package → Custom Package…`
2. Select `meshy-for-unity-0.2.2.unitypackage`
3. Import into your project (it installs under `Assets/Packages/ai.meshy/…`)

### How to use (per README)

1. Unity: `Meshy > Bridge`
2. Click **Run Bridge** to start the local server
3. On the Meshy website, generate a model
4. Click **Send to Unity**
5. The model imports automatically into `Assets/MeshyImports/`

### Key technical notes (from `MeshyBridgeWindow.cs` inside the package)

- Listens on **port `5326`**
- Has a toggle: **“Stand on Ground”** (places imported models on \(Y=0\))
- Uses URP/HDRP shader selection when fixing materials
- Creates an AnimatorController when multiple clips exist
- Declares a dependency on Unity’s FBX package:
  - `com.unity.formats.fbx` (Editor)
- Mentions glTFast in Third-Party notices

### How this fits our “base avatars” plan

Use it as a **fast import tool** to get a Meshy output into Unity **for inspection** (textures/rig/animation).

But for base avatars we still need:

- a **stable prefab** (controllers wired, face renderer identified)
- likely an **offline DCC step** for facial blendshapes/visemes (Meshy doesn’t reliably give those)

## Blender addon: Meshy official plugin (v0.6.0)

### What it is (from `blender_manifest.toml`)

- Addon name: **“Meshy official plugin”**
- Version: **0.6.0**
- Requires Blender **4.2.0+**
- GPL-3.0+
- Includes a **Meshy Bridge** panel

### Bridge mode (import from Meshy website)

The addon contains a Bridge server (see `BridgePanel.py`):

- Listens on **port `5324`**
- Accepts `POST /import` with a model URL
- Downloads the file, detects **GLB vs ZIP**
- Imports GLB via Blender’s glTF importer

In Blender UI:

- Viewport side panel: **Meshy → Meshy Bridge**
- Button: **Run Bridge** / **Bridge ON**

### What it does NOT do (important)

This addon is not a “facial rigging / viseme authoring” tool.

It can help you:

- quickly bring Meshy outputs into Blender
- do mesh cleanup/export workflows

But **creating viseme/emotion blendshapes** still requires standard Blender shape key work.

See:

- `docs/base-avatars/blender-setup.md`
- `docs/base-avatars/base-avatars-blendshapes.md`

## Recommendation (practical)

- **Use Meshy Blender Bridge** to quickly pull models into Blender, then do the serious work there:
  - texture fixes (if needed)
  - rig sanity checks
  - facial shape keys (visemes + emotions)
  - export FBX for Unity

- **Use Meshy Unity Bridge** to quickly inspect whether Meshy outputs are viable in Unity (URP materials, clips, etc.).

For shipping base avatars, Unity should still consume **your curated prefab** (Addressables/in-build), not raw, freshly imported Meshy assets.


