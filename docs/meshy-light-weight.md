If you want “not the preview model” (i.e., textured) and very lightweight (fast to generate + fast to render), Meshy’s docs basically give you these “make it light” knobs:

target_polycount (main “how light” dial)

topology (triangle is usually best for mobile runtime)

should_remesh (must be true if you want target_polycount/topology to actually take effect)

texture choices: should_texture + keep it to base color (avoid extra maps) via enable_pbr: false

optional: symmetry_mode and pose_mode (helps consistency / humanoid rigging)

There is no “angles” parameter in the Meshy API docs. If you saw “angles”/“views” elsewhere, that’s usually a multi-image workflow thing (you provide multiple images from different angles), not a numeric parameter.

Below is a clean workflow for your goal: GLB/glTF now, rig + basic animations, lightweight, “semi-live” (fast turnaround).

A. Generate a lightweight textured model (GLB) with API
Option 1: Image → 3D (single image)

Use POST /openapi/v1/image-to-3d with:

target_polycount: set low (example: 3,000–12,000 for mobile characters; 1,000–6,000 for props)

topology: "triangle"

should_remesh: true (otherwise you get “highest precision triangular mesh” and it ignores your poly target)

should_texture: true (because you want colors)

enable_pbr: false (base color only = lighter & often faster downstream)

pose_mode: "t-pose" or "a-pose" if it’s a character you plan to rig

These parameter names are documented here. 
Meshy Docs

Option 2: Text → 3D (preview + refine)

Text-to-3D is explicitly two-stage: preview (geometry) then refine (texture). 
Meshy Docs

In preview, you can already set target_polycount, topology, should_remesh, pose_mode, symmetry_mode, etc. 
Meshy Docs

Then refine for textures with enable_pbr (keep it false if you want light) and texture_prompt / texture_image_url. 
Meshy Docs

B. “Not preview model” = download the textured GLB

When tasks succeed, Meshy returns downloadable URLs in a model_urls object (e.g., "glb": "https://assets.meshy.ai/.../model.glb?Expires=..."). You then download that URL directly. Example response structure is shown in their docs. 
Meshy Docs

C. Make it even lighter (Remesh pass)

Even if you set a low polycount during generation, it’s common to do a final “shipping” pass with Remesh API:

POST /openapi/v1/remesh supports:

target_formats: e.g. ["glb"]

topology: "triangle" or "quad"

target_polycount: your final target

optional: resize_height, origin_at (nice for AR placement)

All documented here. 
Meshy Docs

Recommended mobile targets (rough starting points):

AR character: 6k–15k triangles (plus textures)

AR product/prop: 1k–8k triangles

Keep one texture set if possible; avoid unnecessary extra maps.

(You’ll still want to benchmark on device—polycount is only one part of performance.)

D. Rig + basic animations (idle/walk/run)

Meshy has an Auto-Rigging API:

POST /openapi/v1/rigging

input_task_id or model_url (GLB)

optional height_meters

optional texture_image_url (base color texture)

Docs are here. 
Meshy Docs

When it succeeds, you get:

rigged_character_glb_url

and basic animations (walking/running) as GLB/FBX URLs in the result. 
Meshy Docs
+1

Add more animations (idle, gestures, etc.)

POST /openapi/v1/animations

rig_task_id

action_id (from the Animation Library Reference)

optional post_process like change_fps (24/25/30/60)

Docs + parameters here. 
Meshy Docs

Animation library (IDs like 0 = Idle, etc.) is here. 
Meshy Docs

E. About “rigid” + “facial details / visemes”
“Rigid”

If you mean a rigid product (no bending): you don’t need skeletal rigging at all—just animate transforms (position/rotation) in your engine.

If you mean a character: it won’t be rigid; it’s a skinned mesh by definition.

Visemes / talking

Meshy’s rigging + animation flow gives you body animations, but viseme-ready facial blendshapes are a separate requirement. Meshy’s API docs (as shown) focus on rigging a humanoid + applying animation clips; they don’t describe generating a standardized viseme blendshape set. 
Meshy Docs
+1

Practical reality: you often still need to add/clean up facial blendshapes in Blender/Maya or use a character pipeline that guarantees ARKit/OVR-style visemes.

The exact “make it lightweight” parameter names (Meshy API)

From Meshy’s docs, the main ones you’ll use are:

Generation (Text-to-3D Preview / Image-to-3D):

ai_model

topology

target_polycount

should_remesh

symmetry_mode

pose_mode

(textures) should_texture, enable_pbr, texture_prompt, texture_image_url (image-to-3d) 
Meshy Docs
+1

Refine (Text-to-3D Refine):

enable_pbr

texture_prompt

texture_image_url 
Meshy Docs

Remesh:

target_formats

topology

target_polycount

resize_height

origin_at

convert_format_only 
Meshy Docs

Rigging / Animation:

Rigging: input_task_id / model_url, optional height_meters, texture_image_url 
Meshy Docs

Animation: rig_task_id, action_id, optional post_process.operation_type (+ fps when changing fps) 
Meshy Docs
+1

“Provide the models”

I can’t directly “provide” and ship you specific Meshy-generated models myself from here (and I don’t have your Meshy account/credits), but you can grab lightweight examples immediately from Meshy’s rigged tag pages and download GLB/FBX there, then mirror the same poly targets in your own pipeline.

-------------------------------------

Rigging + Animation (idle + a couple actions)

Below is a clean, minimal, production-ready Meshy pipeline for exactly what you asked:

Rigging + Animation (idle + a couple actions)
Lightweight, fast generation, GLB/glTF, suitable for mobile AR characters.

I’ll give you:

What Meshy actually supports (important reality check)

Exact API calls + parameter names

Recommended animation set

How to keep it lightweight

What to expect / limitations

This is based on Meshy’s current OpenAPI docs and real-world usage patterns.

0️⃣ Reality check (important)

Meshy does not generate facial viseme animation today.

What it does do well:

Auto-rig humanoid characters

Generate body animations (idle, walk, run, gestures)

Export GLB suitable for mobile engines (Viro, Unity, Babylon)

What you’ll still do later:

Facial visemes → blendshapes driven at runtime (your “semi-live” approach)

OR prebaked talking clips made elsewhere

This is normal and expected.

1️⃣ Input requirements (your model)

You already said:

✅ GLB / glTF

✅ Textured

✅ Lightweight

Best results if:

One humanoid mesh

Neutral pose (T-pose or A-pose)

Reasonable proportions (human-like skeleton)

2️⃣ Step 1 — Auto-Rigging (Meshy Rigging API)
Endpoint
POST https://api.meshy.ai/openapi/v1/rigging

Minimal, recommended request body
{
  "model_url": "https://your-domain.com/character.glb",
  "height_meters": 1.7
}

Notes

model_url → your final textured GLB, not preview

height_meters is optional but strongly recommended (better skeleton scaling)

Meshy will:

generate a humanoid skeleton

skin the mesh

return a rigged GLB

Response (important fields)
{
  "id": "rig_task_id_123",
  "status": "SUCCEEDED",
  "rigged_character_glb_url": "https://assets.meshy.ai/.../rigged.glb"
}


📌 Save:

rig_task_id

rigged_character_glb_url

3️⃣ Step 2 — Generate animations (Idle + Actions)

Meshy provides an Animation Library with predefined actions.

Recommended minimal animation set

For AR characters (light, expressive, non-gamey):

Purpose	Action
Default	Idle
Interaction	Thinking / Gesture
Movement	Walk OR Fly

You do not want many animations on mobile.

Endpoint
POST https://api.meshy.ai/openapi/v1/animations

Example A — Idle animation
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 0,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}


action_id: 0 → Idle

24 fps is perfect for mobile AR (lighter than 30/60)

Example B — Thinking / Gesture
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 5,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}


(IDs vary slightly by library version; common ones include idle, walk, run, gesture, wave, etc.)

Example C — Fly / Walk
{
  "rig_task_id": "rig_task_id_123",
  "action_id": 2,
  "post_process": {
    "operation_type": "change_fps",
    "fps": 24
  }
}

Animation response

Each animation request returns:

{
  "status": "SUCCEEDED",
  "animation_glb_url": "https://assets.meshy.ai/.../idle.glb"
}


You’ll get separate GLBs per animation.

4️⃣ How to use these animations (important)

Meshy does not merge animations automatically.

You typically:

Load rigged base character GLB

Load animation GLBs as animation clips

Apply them in your engine:

ViroReact

Unity

Babylon

This is the correct and normal workflow.

5️⃣ Keep everything lightweight (best practices)
Geometry

Target 6k–12k triangles total for characters

One skinned mesh if possible

Avoid extra accessories early

Textures

BaseColor only (no PBR)

512×512 or 1K max

No normal maps unless necessary

Animations

24 fps

No root motion unless needed

Idle loops short (2–4 seconds)

Runtime (AR)

Anchor character

Animate locally, never move the anchor

Drive visemes separately via blendshapes (jaw open + noise)

6️⃣ What this gives you

After this pipeline you’ll have:

✅ A rigged GLB

✅ Idle

✅ Gesture / Thinking

✅ Walk or Fly

✅ Lightweight enough for real-time mobile AR

✅ Compatible with your semi-live facial animation plan