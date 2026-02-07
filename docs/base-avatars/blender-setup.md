# Blender Setup + Unity Pipeline (Base Avatars)

## Do you need Blender?

If your goal is “**one base avatar shipped inside Unity build with textures + rig + facial blendshapes**”, then **yes — you should plan on using Blender** (or another DCC like Maya).

Reasons:

- **Unity is not a good tool for creating blendshapes** from scratch.
- Meshy can give you body rigs/animations, but **facial viseme blendshapes typically are not included** (see `docs/MESHY_LIGHTWEIGHT_MODELS.md`).
- Meshy outputs can be inconsistent (e.g., rigged/animated GLBs sometimes **lose textures**, see `docs/fbx_docs.md`).

## Install Blender (Linux / Ubuntu)

Pick **one** install method and standardize it on the team.

### Option A — Snap (simple)

```bash
sudo snap install blender --classic
```

### Option B — Flatpak (often stable)

```bash
sudo apt update
sudo apt install -y flatpak
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install -y flathub org.blender.Blender
```

Run:

```bash
flatpak run org.blender.Blender
```

### Option C — Download from Blender.org (most control)

- Download official archive for Linux.
- Extract and run `./blender`.

Standardize the version (e.g., Blender 4.x) so exports are consistent.

## “Can Blender connect to Unity?”

There’s no “live link” required for this workflow. The reliable loop is:

1. Edit in Blender
2. Export `FBX` (or `glb`)
3. Import in Unity
4. Validate materials/rig/animations/blendshapes
5. Repeat

### Unity importing `.blend` files (optional)

Unity can import `.blend` **only if Blender is installed**, because Unity calls Blender in the background to convert the file.

This can work, but for a team pipeline we still recommend exporting **FBX** explicitly so the import is deterministic.

## Recommended folder layout (Unity project)

```
Assets/Avatars/BaseAvatars/base-avatar-v1/
  Source/        (raw FBX/GLB + textures)
  Materials/     (URP materials)
  Animations/    (extracted clips)
  Prefabs/       (final base avatar prefab)
```

## Authoring blendshapes in Blender (Shape Keys)

### Step 1 — Ensure you’re editing the correct mesh

- Select the mesh that should hold facial blendshapes (usually the **head/face** mesh).
- If the character is multiple skinned meshes, pick the one with the face vertices.

### Step 2 — Create Shape Keys

- Go to **Object Data Properties** (green triangle icon)
- Find **Shape Keys**
- Click `+` to create **Basis**
- Click `+` again to create a new shape key (this becomes a blendshape)

### Step 3 — Sculpt the shape key

- Select your new shape key (not Basis)
- Switch to **Sculpt Mode** (or Edit Mode with proportional editing)
- Make your deformation (e.g., mouth open, smile)

### Step 4 — Naming (important)

For compatibility with current Unity scripts:

- Visemes: name keys like `viseme_aa`, `viseme_m_b_p`, etc.
- Emotions: name keys like `blendshape_happy`, `blendshape_sad`, etc.

Full spec + naming list: `docs/base-avatars/base-avatars-blendshapes.md`

### Step 5 — Test quickly inside Blender

Use the **Value** slider of the shape key:

- 0.0 = off
- 1.0 = full deformation

Unity will typically drive weights 0–100; this maps conceptually to Blender’s 0.0–1.0.

## Export from Blender → Unity (FBX recommended)

### FBX export settings (starting point)

In Blender: `File → Export → FBX`

- **Limit to**: Selected Objects (recommended)
- **Transform**:
  - Apply Unit: ON (if you use metric)
  - Forward: `-Z Forward`
  - Up: `Y Up`
- **Armature**:
  - Add Leaf Bones: OFF
- **Geometry**:
  - Smoothing: Face
  - **Shape Keys**: ON (critical)
- **Bake Animation**:
  - ON if you’re exporting animations in this FBX

Then import in Unity and verify:

- Rig imports
- Clips exist
- Blendshapes exist on the target `SkinnedMeshRenderer`

## Validate inside Unity

1. Instantiate the prefab or imported model.
2. Use `BlendshapeDebugUtil` to dump names to logs (already in repo):
   - Validate the viseme/emotion names match what `LipSyncController` and `EmotionController` search for.

If blendshapes aren’t showing up in Unity:

- You exported the wrong mesh (face is separate)
- Shape Keys export was off
- Mesh modifiers broke shapekeys (apply carefully)


