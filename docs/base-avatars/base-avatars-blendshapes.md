# Base Avatars — Blendshapes (Visemes + Emotions)

## Why this doc exists

Your Unity app already has runtime controllers:

- `LipSyncController.cs` (drives **viseme blendshapes**)
- `EmotionController.cs` (drives **emotion blendshapes**)
- `BlendshapeDebugUtil.cs` (logs what blendshapes are actually present)

For base avatars, we must ensure the shipped prefab contains blendshapes with **names that match what the code expects**.

## Blendshape naming spec (MVP)

### Emotions (required for MVP)

`EmotionController.cs` looks for these (substring match, case-insensitive):

- `blendshape_happy`
- `blendshape_sad`
- `blendshape_angry`
- `blendshape_excited`
- `blendshape_neutral`

### Visemes (MVP-minimal vs target)

`LipSyncController.cs` expects a 22-entry set (IDs 0–21):

- 0 `viseme_silence`
- 1 `viseme_aa_ao_aw`
- 2 `viseme_aa`
- 3 `viseme_aa_ao`
- 4 `viseme_eh_er`
- 5 `viseme_ih_iy`
- 6 `viseme_ow_oy`
- 7 `viseme_uw`
- 8 `viseme_m_b_p`
- 9 `viseme_f_v`
- 10 `viseme_th_dh`
- 11 `viseme_t_d_n_l`
- 12 `viseme_s_z`
- 13 `viseme_sh_ch_jh_zh`
- 14 `viseme_k_g_ng`
- 15 `viseme_y`
- 16 `viseme_w`
- 17 `viseme_r`
- 18 `viseme_l`
- 19 `viseme_th`
- 20 `viseme_th_alt`
- 21 `viseme_silence_end`

#### MVP-minimal suggestion

If “full viseme set” is too much for the first avatar, ship:

- Jaw open (map to `viseme_aa` + `viseme_aa_ao_aw` as a start)
- Closed mouth (`viseme_m_b_p`)
- One rounded mouth (`viseme_ow_oy`)
- Silence (`viseme_silence`)

Then expand to full 22.

## Where blendshapes live (important for Unity wiring)

Blendshapes are per-mesh. In Unity, they appear on a specific `SkinnedMeshRenderer.sharedMesh`.

You must ensure:

- the face blendshapes exist on the renderer you assign to `LipSyncController.faceMeshRenderer` and `EmotionController.faceMeshRenderer`
- or you implement “auto-discovery” to find the correct renderer (later)

## Authoring workflow (recommended)

### Step 1 — Start from a stable “base mesh + rig”

Meshy can produce:

- a textured model
- a rigged model
- animated models

But those outputs can be inconsistent (textures may drop; see `docs/fbx_docs.md`).

So the expected workflow is:

1. Pick the best textured mesh
2. Pick the best rigged skeleton/weights
3. Merge/fix in Blender if needed

### Step 2 — Create Shape Keys in Blender

Follow `docs/base-avatars/blender-setup.md` to:

- create shape keys
- sculpt each viseme/emotion
- name each key per the spec above

### Step 3 — Export and verify in Unity

In Unity:

1. Import the FBX
2. Instantiate it
3. Run blendshape dump:
   - Use `BlendshapeDebugUtil.DumpAllBlendshapes(root, "...")`
4. Confirm the key names appear in logs

## Unity-side validation checklist (fast)

- [ ] `SkinnedMeshRenderer` exists for face
- [ ] `mesh.blendShapeCount > 0`
- [ ] names include required prefixes:
  - `viseme_`
  - `blendshape_`
- [ ] `LipSyncController` initializes with >0 mappings
- [ ] `EmotionController` initializes with at least neutral + 1 emotion mapping

## Implementation plan (Base Avatar v1)

### Milestone A — Add blendshape-ready base avatar prefab

- Import base avatar asset
- Build prefab `BaseAvatar_v1.prefab`
- Assign face mesh renderer fields on both controllers

### Milestone B — Replace placeholder visemes with real viseme timeline

`ARChatManager.cs` currently generates placeholder visemes (cycling IDs).

We should replace it with:

- provider viseme events (best), or
- backend-provided viseme timeline, or
- phoneme-to-viseme mapping fallback

Plan: see `docs/base-avatars/base-avatars-tts.md`


