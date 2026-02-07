# Base Avatars — TTS + Visemes Plan

## Current state (ground truth)

### TTS

- Unity has `TTSController.cs` which can generate audio using:
  - Azure Speech REST (Bearer token)
  - ElevenLabs REST (API key)
- It returns **audio only** (no viseme timeline).

### Visemes (lip sync)

- Unity has `LipSyncController.cs`, which drives **viseme blendshapes** by viseme IDs (0–21).
- `ARChatManager.cs` currently generates a **placeholder viseme sequence** (cycles IDs) using text length:
  - This is not real lip sync.

Goal: replace placeholder visemes with a real timeline, while keeping base avatars shipped in-build.

## MVP principle

For Base Avatar v1:

- We can tolerate “good-enough” visemes as long as:
  - timing roughly matches audio duration
  - mouth shapes look plausible
  - the system is structured so we can upgrade later

## Options for viseme timelines (ranked)

### Option 1 (Best): Provider viseme events (Azure Speech SDK)

Azure Speech can emit viseme events during synthesis. Doing this “right” generally requires the **Azure Speech SDK** (not just REST).

Pros:
- Best timing (visemes aligned to audio)
- Production-quality

Cons:
- Unity SDK integration work (platform deps)
- Token + SDK wiring complexity

### Option 2 (Strong): Backend generates viseme timeline + audio

Backend calls TTS provider and returns:

- audio bytes/url
- viseme frames: `{ id, offsetSeconds, durationSeconds }[]`

Unity just plays audio and drives `LipSyncController`.

Pros:
- Unity stays simple
- Easy to iterate on mapping server-side

Cons:
- Adds backend latency and infra

### Option 3 (MVP fallback): Text → phoneme → viseme mapping (estimated timing)

Generate phonemes from text and map to viseme IDs, then distribute timing across audio duration.

Pros:
- No SDK dependency
- Works with any TTS provider

Cons:
- Timing is approximate
- Needs a phoneme library (harder in Unity than in Node)

## Recommendation (Base Avatar v1 → v2)

### Base Avatar v1 (fast)

Keep `TTSController` for audio, but replace the placeholder viseme logic with a deterministic fallback that is **easy to upgrade**:

- Use a small vowel/consonant heuristic mapping (not perfect, but better than cycling IDs).
- Make sure viseme IDs match `LipSyncController.VisemeId`.

This gets you “moving mouth that tracks speech duration” quickly.

### Base Avatar v2 (quality)

Upgrade to either:

- Azure Speech SDK viseme events (preferred), or
- backend-provided viseme timeline

## Concrete execution plan

### Phase 0 — Define viseme API shape (½ day)

Create a small internal model for Unity (even if it stays local for now):

- `VisemeFrame { int id; float offset; float duration; }`

And a single entry point:

- `IVisemeTimelineProvider.Generate(text, audioDuration) -> List<VisemeFrame>`

### Phase 1 — Implement MVP provider (½–1 day)

Implement `HeuristicVisemeTimelineProvider`:

- Tokenize text
- Map characters / digraphs to a small set of visemes:
  - vowels → open mouth visemes
  - m/b/p → closed mouth
  - f/v → teeth/lip
  - etc.
- Space timing evenly across `audioDuration`

Replace the placeholder block in `ARChatManager.ProcessStreamComplete()` with:

- provider.Generate(cleanText, audioDuration)
- `LipSyncController.PlayLipSync(visemes, audioDuration)` (or `PlayLipSyncFromIds`)

### Phase 2 — Add “real viseme” provider (1–3 days)

Pick one:

#### 2A) Backend-generated visemes

- Add backend endpoint: `POST /tts` returns audio + visemes.
- Unity downloads audio, parses visemes, drives lip sync.

#### 2B) Azure Speech SDK

- Integrate SDK into Unity project (Android/iOS)
- Subscribe to viseme events
- Emit `VisemeFrame` list during synthesis

### Phase 3 — QA (½ day)

- Validate on-device:
  - audio plays fully
  - viseme timeline stops cleanly
  - `LipSyncController` mappings are non-empty (blendshapes exist on base avatar)

## Acceptance criteria

- No more “cycling viseme IDs” placeholder logic.
- A clear interface exists so we can upgrade to provider viseme events without changing avatar code.
- Base avatar mouth motion looks stable and roughly aligned with speaking duration.


