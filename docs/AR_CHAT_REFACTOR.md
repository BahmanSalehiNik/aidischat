## AR Chat Refactor (Unity video chat)

This doc tracks refactor work for the AR chat / Unity video chat experience.

### Scope

- **Client**: `client/unity/` (Unity app that launches for AR/video chat)
- **Mobile app**: `client/mobile-app/` (the “Start video chat” entry point and any deep-link/intent/navigation)
- **Backend (if applicable)**: `backEnd/ar-avatar/`, `backEnd/ar-conversations/`, `backEnd/realtime-gateway/` (only if needed for session/bootstrap)
- **Unity version**: `client/unity/ARAvatarClient/ProjectSettings/ProjectVersion.txt` → `6000.3.2f1`

---

### 1) Remove intermediate page before Unity launches (no “flash” / page transition)

#### Problem
When the user taps **Start video chat**, an intermediate page/screen briefly appears (~1 second), then the Unity app launches. This visual flash feels broken and adds latency.

#### Desired behavior
- Tapping **Start video chat** should **launch Unity immediately**.
- **No intermediate page/screen** should be shown in between (no visible navigation transition).

#### Acceptance criteria
- **No UI flash**: the user does not see any other page before Unity.
- **Perceived launch time improves**: Unity launch begins immediately on tap (only platform-level transition/loader is acceptable).
- **Back navigation is sane**:
  - If user exits Unity, they return to the expected screen (the one they were on before tapping Start video chat).
  - No “ghost” intermediate screen remains on the navigation stack.

#### Likely work areas (to investigate)
- Mobile navigation that currently routes to a “bridge” screen before firing the Unity launch intent.
- Any “loading screen” route that can be replaced with:
  - direct native intent/deep link launch, or
  - a non-navigating overlay/spinner (only if absolutely required, but goal is *none*).

---

### 2) Remove Unity default/debug UI (buttons/tools for adding 3D objects / surface features)

#### Problem
When the Unity video chat starts, some default Unity UI/debug features are visible (buttons for adding objects, surface-related tools, etc.). These are not part of the product experience.

#### Desired behavior
- Unity launches into the AR/video chat experience **without any Unity “default” UI** or debug tooling visible.

#### Acceptance criteria
- The following are **not visible** on start:
  - any “add 3D object” buttons
  - plane/surface tool UI
  - debug menus / developer overlays
- The AR/video chat UI contains only the intended product controls.

#### Likely work areas (to investigate)
- Unity scene/prefab(s) that include debug canvases or sample AR UI.
- Build configuration / scripting define symbols controlling debug UI visibility (e.g., `DEVELOPMENT_BUILD`, custom `DEBUG_UI` flags).
- Any third-party sample components left enabled by default.

---

### 3) Base avatars + custom avatars (create + customize + save)

#### Product goal
Users should be able to:
- **Pick immediately** from a curated set of **base avatars** (ready to talk: visemes + facial expressions + basic body animations).
- **Create their own avatar** via:
  - **Text** prompt → model generation
  - **Photo** → model generation
  - **Options-based** flow (the current approach)
- **Customize** any avatar (including base avatars) and **save** “My Avatars” variants for reuse.

#### Constraints / existing architecture to reuse
- **Unity launch is deep-link based** (`aichatar://ar?...`) per `client/UNITY_INTEGRATION.md`.
- The backend already has an **AR Avatar Service** (`backEnd/ar-avatar/`) intended for **model generation + storage + “TTS with viseme support”** (see `backEnd/ar-avatar/README.md` + `CLIENT_INTEGRATION.md`).

---

### Proposed phases (execution plan)

#### Phase 1 (start now): ship 1 high-quality base avatar (talking + expressive)
**Outcome:** one production-ready “base model” that:
- has **proper facial rig** for mouth/visemes + expressions
- has **idle/talking** (and optionally gesture) animations
- can be loaded in Unity reliably and driven by audio/viseme timing

##### Phase 1A — Decide the facial animation strategy (1 day)
Pick one as the “standard” for all future models:
- **Option A (recommended)**: **blendshapes** for visemes + expressions (most Unity pipelines and lipsync tooling assume blendshapes).
- **Option B**: **jaw bone + a few blendshapes** (jaw open via bone, visemes via blendshapes). This matches your “jaw bones” requirement while keeping lipsync realistic.

**Decision output:**
- A fixed **viseme set** (e.g., 10–20 visemes) + fixed **expression set** (smile, frown, blink, brow up/down, etc.)
- A Unity-side mapping table: `visemeName -> SkinnedMeshRenderer blendShapeIndex` (and/or jaw bone transform)

##### Phase 1B — Create the base model asset (Meshy → Blender) (2–5 days)
**Goal:** Generate a good-looking character quickly, then “enrich” it in Blender to meet real-time animation requirements.

**Step 1: Generate in Meshy**
- Generate a full-body character with textures in Meshy.
- Export **GLB** (or FBX if Meshy provides it cleanly for your pipeline).

**Step 2: Enrich in Blender (local is OK)**
Install:
- **Blender** (desktop, local machine).
- Recommended add-ons (optional but helpful):
  - **Rigify** (built-in) for humanoid rigging helpers
  - Any face rig/shape key helper you like (optional; manual shape keys are fine for v1)

Blender tasks:
- **Clean import** (scale/orientation), apply transforms.
- Ensure a stable **armature** (Unity Humanoid-friendly).
- Add/verify **jaw bone** (and basic facial bones if you want them).
- Create **shape keys** (blendshapes) for:
  - the chosen viseme set
  - the chosen expressions (at least: blink L/R, smile, frown, brow raise)
- Weight-paint jaw + face as needed.
- Create/retarget **animations**:
  - Idle loop
  - Talking loop (subtle head/torso movement)
  - (Optional) gesture set (wave, nod, shrug)

**Step 3: Export to Unity**
- Prefer **FBX** export from Blender for best Unity compatibility (rig + animations).
- Export textures/materials in a Unity-friendly way (avoid exotic shader nodes; keep it simple).

##### Phase 1C — Unity integration (2–4 days)
Unity project: `client/unity/ARAvatarClient/` (Unity `6000.3.2f1`)

Unity tasks:
- Import the base avatar as a **Prefab** (e.g. `Assets/Avatars/Base/`).
- Configure **Humanoid** rig (if applicable) and verify animation playback.
- Add an **Animator Controller** with:
  - Idle state
  - Talking state
  - (Optional) gesture layer
- Implement a simple **FaceController**:
  - Apply viseme weights over time
  - Drive jaw bone (if used)
  - Blend expressions (e.g., blink on timer, emotion from chat state)
- Decide how visemes are driven:
  - **Short-term**: local audio-driven lipsync (fastest to demo)
  - **Long-term**: viseme timeline from backend TTS (clean, deterministic)

##### Phase 1D — Package base avatar for selection (1–2 days)
- Add a base-avatar metadata entry (name, thumbnail, model URL or addressable key).
- Ensure it can be loaded without requiring generation.

##### Phase 1 acceptance criteria
- Base avatar loads reliably in Unity without debug UI (ties into item (2)).
- Mouth moves in sync (visemes/jaw) with speech audio.
- At least a couple facial expressions work (blink + smile) and 1–2 body animations play.

---

#### Phase 2: “Base avatars” library + UX (selection + entry points)
**Outcome:** user can scroll a base avatar gallery and choose one instantly.

##### UX (proposal to investigate)
- **Horizontal scroll gallery** (“Base avatars”)
  - Tap = **Use**
  - Secondary actions per card:
    - **Customize**
    - **Create your own**
- Separate section for **My Avatars** (saved custom variants)

##### Data model (proposal)
Create two concepts:
- **AvatarTemplate**: curated/base avatars shipped by you.
- **UserAvatar**: user-owned saved variants (including customized copies of templates).

Minimum metadata:
- `id`, `name`, `thumbnailUrl`
- `modelUrl` (or a storage key that `ar-avatar` can sign)
- `rigProfile` (which viseme/expression mapping set this model supports)

##### Where this lives
- **Mobile app**: new screen (or modal) for selection before launching Unity.
- **Unity deep link**: add optional parameter, e.g. `avatarId=...` or `modelUrl=...` so Unity loads the chosen model without extra fetch.

---

#### Phase 3: Create + customize + save (full avatar system)
**Outcome:** user can generate a model from text/photo/options and then customize and save it.

##### Create flows
- **Text → model**: call `ar-avatar` provider pipeline (Meshy/other) → store → return model.
- **Photo → model**: either provider that supports image-to-3D or a separate pipeline.
- **Options-based**: keep current flow; route it to the same “generate model” backend contract.

##### Customize flows
Two “levels” (can be staged):
- **Level 1 (fast)**: material/texture swaps, color choices, hair/outfit variations (no geometry edits).
- **Level 2 (advanced)**: face/body sliders + morph targets, accessory attachments.

##### Save & reuse
- Saving creates a **UserAvatar** record pointing to a stored model (or “template + customization params” if you want parametric saves later).

##### Backend work (likely)
Extend `backEnd/ar-avatar/` to support user avatars (not only agent avatars):
- CRUD for templates + user avatars
- Signed download URLs for Unity
- (Later) TTS viseme timeline endpoint for deterministic lip sync

---

### Action plan for Phase 1 (what you personally need to do)

#### Software to install
- **Blender** (desktop, local machine)
- **Unity Hub + Unity 6000.3.2f1** (to match the project)
- Optional (quality-of-life):
  - a face/shape-key helper addon for Blender (not required)
  - an animation source/retarget workflow (Mixamo or your preferred pipeline)

#### Concrete steps (checklist)
- **Choose the viseme/expression standard** (document the list + names).
- **Generate 1 model in Meshy** and export it.
- **Blender enrichment**:
  - add jaw bone
  - add shape keys for visemes + expressions
  - create idle + talking animation clips
  - export FBX
- **Unity integration**:
  - prefab + animator + face controller
  - validate on-device performance and visuals
- **Add base avatar metadata + selection UX stub** (even if UI is minimal at first).

---

### Open questions (to answer before implementation)
- Do we want a **single standard model format** for Unity loading (FBX vs GLB vs VRM)?
- Should lip sync be driven by:
  - backend **TTS viseme timeline**, or
  - local audio analysis (faster demo, less deterministic)?
- Where should “base avatars” be hosted:
  - shipped inside Unity build (fastest load), or
  - hosted in storage/CDN (smaller app, but requires download/cache)?


