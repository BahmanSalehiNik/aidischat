# Quick Animation Test Guide

## Why You Don't See Movement

**Most likely reason**: Your GLTF model doesn't have animation clips embedded in it.

## Quick Test Steps

### 1. Check Console When Model Loads

When you open AR Chat, look for these logs:

**✅ Model HAS animations:**
```
🎬 [Model3DViewer] Found 3 animations: ['idle', 'talking', 'thinking']
✅ [AnimationController] Mapped idle → idle
✅ [AnimationController] Mapped talking → talking
```

**❌ Model has NO animations:**
```
⚠️ [Model3DViewer] No animations found in GLTF model
```

**If you see the warning**, your model doesn't have animations. You need a model with animation clips.

### 2. Check Console When Message Arrives

When backend sends a message, look for:

```
🎭 [ARChatScreen] Markers found in stream: [{"type":"movement","value":"talking"}]
🎬 [Model3DViewer] Movement change: talking → TALKING
```

**If you DON'T see "Movement change"**, the animation controller might not be initialized (model has no animations).

### 3. Test with a Model That Has Animations

**Option A: Use Ready Player Me**
- Ready Player Me avatars usually include animations
- Download a model from readyplayer.me
- Use that model URL

**Option B: Use Mixamo**
- Go to mixamo.com
- Download a character with animations (idle, talking, etc.)
- Export as GLTF with animations included
- Use that model URL

**Option C: Check Your Current Model**
- Open your GLTF in Blender
- Check if it has animation data
- If not, add animations and re-export

## Quick Manual Test

To manually test if animations work (even without backend):

1. **Open AR Chat**
2. **Check console** - Do you see "Found X animations"?
3. **If YES**: Animations should work when backend sends movement markers
4. **If NO**: You need a model with animations

## What Backend Sends

Backend sends markers like:
- `['talking']` → Should trigger TALKING animation
- `['thinking']` → Should trigger THINKING animation  
- `['idle']` → Should trigger IDLE animation

## Console Logs to Watch For

**When model loads:**
- `🎬 [Model3DViewer] Found X animations` ← **This is what you need to see**

**When message arrives:**
- `🎬 [Model3DViewer] Movement change: talking → TALKING` ← **This confirms animation triggered**

**If you see:**
- `⚠️ No animations found` → Model needs animations
- `⚠️ No animation found for state: talking` → Model has animations but wrong names

## Solution

**If your model has no animations:**
1. Get a model with animations (Ready Player Me, Mixamo, etc.)
2. Or add animations to your current model in Blender
3. Make sure animations are named: `idle`, `talking`, `thinking`, `walking`, `flying`

**If your model has animations but they don't play:**
1. Check animation names match expected values
2. Check console for mapping logs
3. Verify `currentMovement` state is being set

## Quick Fix Test

To test if the system works, temporarily force a movement:

Add this to Model3DViewer after model loads:
```typescript
// Test: Force idle animation after 2 seconds
setTimeout(() => {
  if (animationControllerRef.current) {
    animationControllerRef.current.transitionTo(MovementState.IDLE);
  }
}, 2000);
```

If this works, the system is fine - you just need a model with animations.
