# Animation Testing Guide

## Current Status

✅ **Animation System is Implemented** - The Three.js AnimationController is ready and integrated.

⚠️ **Important Requirements**:
1. Your GLTF model **must have animation clips** for animations to work
2. Animation clips should be named: `idle`, `thinking`, `walking`, `flying`, `talking` (or variations)
3. The system will automatically map backend movements to animations

## How to Test

### Step 1: Check Your Model Has Animations

When you load a model, check the console logs:
- ✅ `🎬 [Model3DViewer] Found X animations: [...]` - Model has animations
- ⚠️ `⚠️ [Model3DViewer] No animations found in GLTF model` - Model has no animations

**If your model has no animations**, you won't see movement. You need to:
- Use a GLTF model that includes animation clips
- Or add animations to your existing model using Blender/other tools

### Step 2: Test Movement Triggers

1. **Open AR Chat Screen** with any agent
2. **Send a message** - The backend will respond with markers like:
   - `['happy']['talking']Hello!`
   - `['thoughtful']['thinking']Let me think...`
   - `['excited']['smiling']Great idea!`

3. **Watch the console** for logs:
   - `🎭 [ARChatScreen] Markers found in stream: [...]`
   - `🎬 [Model3DViewer] Movement change: talking → TALKING`
   - `✅ [AnimationController] Mapped talking → [animation-name]`

4. **Observe the model** - It should:
   - Start with IDLE animation when loaded
   - Transition to TALKING when backend sends `['talking']` or `['smiling']`
   - Transition to THINKING when backend sends `['thinking']` or `['frown']`
   - Return to IDLE when backend sends `['idle']` or `['listening']`

## Movement Mapping

The system maps backend movements to animations:

| Backend Marker | Animation State | Notes |
|----------------|-----------------|-------|
| `idle` | IDLE | Default state |
| `thinking` | THINKING | Thinking animation |
| `walking` / `walk` | WALKING | Walking animation |
| `flying` / `fly` | FLYING | Flying animation |
| `talking` / `talk` / `speak` | TALKING | Talking animation |
| `smiling` | TALKING | Mapped to talking |
| `frown` | THINKING | Mapped to thinking |
| `listening` | IDLE | Mapped to idle |
| `wave` / `nod` / `point` | TALKING | Gestures during talking |

## Troubleshooting

### No Animations Showing

**Problem**: Model loads but doesn't animate

**Solutions**:
1. Check console for: `⚠️ No animations found in GLTF model`
   - Your model doesn't have animation clips
   - Solution: Use a model with animations or add them

2. Check console for: `⚠️ No animation found for state: [state]`
   - Your model has animations but not the expected names
   - Solution: Rename animations in your model to match expected names

3. Check console for: `⚠️ Unknown movement: [movement]`
   - Backend sent a movement not in the mapping
   - Solution: Movement will default to IDLE (this is expected)

### Animations Not Transitioning

**Problem**: Model stays in one animation

**Check**:
1. Are markers being received? Look for: `🎭 [ARChatScreen] Markers found in stream`
2. Is currentMovement being set? Check: `🎬 [Model3DViewer] Movement change: ...`
3. Is AnimationController initialized? Check: `✅ [AnimationController] Mapped ...`

### Model Has No Animations

**If your GLTF model doesn't have animations**, you have two options:

#### Option 1: Use a Model with Animations
- Download a model from sites like:
  - Ready Player Me (has animations)
  - Mixamo (free animated characters)
  - Sketchfab (many have animations)

#### Option 2: Add Animations to Your Model
1. Open model in Blender
2. Import animations (Mixamo, etc.)
3. Export as GLTF with animations
4. Ensure animations are included in export

## Expected Behavior

### When Model Loads
- ✅ AnimationController is created (if animations exist)
- ✅ Model starts with IDLE animation
- ✅ Console shows: `✅ [AnimationController] Mapped idle → [animation-name]`

### When Backend Sends Markers
- ✅ Markers are parsed: `🎭 [ARChatScreen] Markers found in stream`
- ✅ Movement is extracted: `currentMovement` is set
- ✅ Animation transitions: `🎬 [Model3DViewer] Movement change: ...`
- ✅ Model plays new animation with fade in/out

### When No Markers
- ✅ Model stays in current animation (usually IDLE)
- ⚠️ No errors (this is normal)

## Testing Checklist

- [ ] Model loads successfully
- [ ] Console shows animations found (if model has them)
- [ ] Model starts with IDLE animation
- [ ] Send message in AR chat
- [ ] Backend responds with markers
- [ ] Console shows markers parsed
- [ ] Console shows movement change
- [ ] Model transitions to new animation
- [ ] Animation plays smoothly
- [ ] Animation loops correctly

## Quick Test

To quickly test if animations work:

1. **Open AR Chat** with any agent
2. **Send message**: "Hello, can you talk?"
3. **Watch console** for:
   ```
   🎭 [ARChatScreen] Markers found in stream: [...]
   🎬 [Model3DViewer] Movement change: talking → TALKING
   ```
4. **Observe model** - Should transition from IDLE to TALKING

If you see the console logs but no visual change:
- Model might not have the expected animation names
- Check console for animation mapping warnings

## Next Steps

If animations aren't working:
1. Verify your model has animation clips
2. Check animation names match expected values
3. Review console logs for errors
4. Test with a known working model (like Ready Player Me)

If animations are working:
1. Test all movement types (idle, thinking, talking, etc.)
2. Test transitions between movements
3. Test with different models
4. Report any issues or improvements needed
