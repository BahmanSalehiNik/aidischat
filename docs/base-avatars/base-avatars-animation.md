# Base Avatars — Animation Plan (Idle / Talking / Gestures)

## Current state in Unity

There are two “animation worlds” in the repo:

1. **Animator-driven** (traditional Unity)
   - `GestureController.cs` triggers Animator parameters like `Wave`, `Point`, `Idle`, etc.
   - This requires an **Animator Controller** and animations imported as clips.

2. **Runtime clip player** (for runtime-loaded glTF clips)
   - `RuntimeAnimationPlayer.cs` plays imported `AnimationClip`s via `Animation` (legacy) or Playables.
   - `ARChatManager.cs` will call `animationPlayer.Play("talking")`, `Play("idle")`, and `Play(movementMarker)`.

For **base avatars shipped inside the build**, we should standardize around one approach.

## Recommendation (MVP)

### Use Animator for base avatars

Why:

- Most predictable for in-build assets
- Easy to author “Idle vs Talking” loops + gestures
- Plays well with Humanoid rigs and state machines

We keep `RuntimeAnimationPlayer` for runtime-loaded avatars (backlog).

## Base avatar animation set (v1)

### Minimum (MVP)

- `idle` (loop)
- `talking` (loop) — even if it’s subtle (breathing + head nod), it makes speech feel alive

### Optional (v1+)

- Gestures: `wave`, `nod`, `shake`, `point` (short clips)
- “Thinking” (loop)

## Asset pipeline

### Phase 1 — Ensure clips exist on the imported asset

In Blender/FBX pipeline:

- Ensure the export includes the idle/talking clips, or import them as separate FBX and retarget.

In Unity:

- In the model importer:
  - Extract clips
  - Mark idle/talking as Loop Time

### Phase 2 — Create a shared Animator Controller

Create something like:

- `Assets/Avatars/BaseAvatars/Shared/Controllers/BaseAvatar.controller`

States:

- `Idle` (default)
- `Talking` (loop)

Transitions:

- `Idle → Talking` when bool `IsTalking == true`
- `Talking → Idle` when `IsTalking == false`

Gestures:

- Use triggers (matching `GestureController.cs` fields):
  - `Wave`, `Point`, `Nod`, `Shake`, `Idle`
- Each gesture plays a short clip and returns to `Idle`

### Phase 3 — Wire runtime code

In `ARChatManager.cs`:

- When TTS starts:
  - set `IsTalking = true`
- When TTS completes:
  - set `IsTalking = false`
- When gesture markers arrive:
  - call `GestureController.PlayGesture(...)`

Keep the old `RuntimeAnimationPlayer` path only as fallback for runtime-loaded avatars.

## Execution steps (Base Avatar v1)

1. Import base avatar with clips (idle/talking).
2. Build `BaseAvatar.controller`.
3. Attach `Animator` to the avatar prefab and assign `BaseAvatar.controller`.
4. Confirm `GestureController` triggers are consistent with controller parameters.
5. Update `ARChatManager` to prefer Animator if present; fallback to `RuntimeAnimationPlayer` if not.

## Acceptance criteria

- In device build:
  - avatar idles by default
  - avatar switches to talking loop during TTS playback
  - at least one gesture plays via a marker


