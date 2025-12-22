# Adding Animations to Meshy Models

## Problem
Meshy generates **static 3D models** without animation clips. Your model loads but has no animations, so movement states (idle, talking, thinking, walking) don't work.

## Solution: Add Animations with Mixamo

### Step 1: Download Your Meshy Model
1. Get the GLB file URL from your backend/avatar service
2. Download the GLB file to your computer

### Step 2: Prepare Model in Blender (Optional but Recommended)
1. **Import Meshy GLB into Blender:**
   - Open Blender
   - File → Import → glTF 2.0 (.glb/.gltf)
   - Select your Meshy model

2. **Check Model Structure:**
   - Ensure the model has an armature (skeleton)
   - If no armature exists, you'll need to rig the model first
   - Meshy models should have basic rigging, but verify

3. **Export as FBX (for Mixamo):**
   - File → Export → FBX (.fbx)
   - Make sure "Selected Objects" is unchecked
   - Export the model

### Step 3: Upload to Mixamo
1. Go to https://www.mixamo.com/
2. Sign in (free account)
3. Click **"Upload Character"**
4. Upload your FBX file
5. **Auto-rig** if needed (Mixamo will try to auto-rig your model)
6. **Adjust skeleton** if auto-rigging fails (manually place joints)

### Step 4: Download Animations from Mixamo
Download these animations (required for your app):
- **Idle**: Search "Idle" → Download "Idle" or "Idle Standing"
- **Talking**: Search "Talking" → Download "Talking" or "Talking Gesture"
- **Thinking**: Search "Thinking" → Download "Thinking" or "Pondering"
- **Walking**: Search "Walking" → Download "Walking" or "Walking Forward"
- **Flying** (optional): Search "Flying" → Download any flying animation

**Important:** When downloading from Mixamo:
- Format: **FBX**
- Skin: **With Skin** (includes mesh)
- Frames per Second: **30**
- Keyframe Reduction: **None** (for best quality)

### Step 5: Combine Model + Animations in Blender
1. **Import base model:**
   - File → Import → glTF 2.0 → Your Meshy GLB

2. **For each animation:**
   - File → Import → FBX → Animation FBX from Mixamo
   - Select the armature
   - In **Action Editor**, rename the action to match:
     - `idle` (for idle animation)
     - `talking` (for talking animation)
     - `thinking` (for thinking animation)
     - `walking` (for walking animation)
     - `flying` (for flying animation)

3. **Export as GLTF with animations:**
   - File → Export → glTF 2.0 (.glb)
   - Format: **glTF Binary (.glb)**
   - Include: ✅ **Selected Objects** (uncheck if you want all)
   - Transform: ✅ **+Y Up**
   - Geometry: ✅ **Apply Modifiers**
   - Animation: ✅ **Bake Animation** (IMPORTANT!)
   - Export

### Step 6: Upload Animated Model
1. Upload the new GLB file (with animations) to your storage
2. Update the avatar's `modelUrl` in your database
3. The app should now detect animations!

---

## Alternative: Use Mixamo Characters Directly

If adding animations to Meshy models is too complex:

1. **Use Mixamo's character library:**
   - Browse Mixamo characters
   - Download a character with animations
   - Export as GLB with animations included
   - Use this instead of Meshy model

2. **Pros:**
   - Animations already included
   - No Blender work needed
   - Professional quality animations

3. **Cons:**
   - Less customization
   - Not generated from your description

---

## Quick Test After Adding Animations

1. Load the model in your app
2. Check console for:
   ```
   🎬 [Model3DViewer] Found 5 animations: ['idle', 'talking', 'thinking', 'walking', 'flying']
   ✅ [AnimationController] Mapped idle → idle
   ✅ [AnimationController] Mapped talking → talking
   ```
3. Use test buttons to verify animations play

---

## Troubleshooting

### "No animations found" after adding animations
- **Check:** Did you export with "Bake Animation" enabled?
- **Check:** Are animation names correct? (idle, talking, thinking, walking, flying)
- **Check:** Does the GLB file size increase? (should be larger with animations)

### Animations play but look wrong
- **Check:** Did you use the same armature/skeleton for all animations?
- **Check:** Are bone names matching between model and animations?

### Model doesn't load
- **Check:** GLB file is valid (try opening in Blender)
- **Check:** File size isn't too large (compress if needed)

---

## Tools Needed

- **Blender** (free): https://www.blender.org/
- **Mixamo** (free): https://www.mixamo.com/
- **GLTF Validator** (optional): https://github.khronos.org/glTF-Validator/

---

## Expected Result

After adding animations, your console should show:
```
🎬 [Model3DViewer] Found 5 animations: ['idle', 'talking', 'thinking', 'walking', 'flying']
✅ [AnimationController] Mapped idle → idle
✅ [AnimationController] Mapped talking → talking
✅ [AnimationController] Mapped thinking → thinking
✅ [AnimationController] Mapped walking → walking
✅ [AnimationController] Mapped flying → flying
```

And test buttons should trigger visible animations!
