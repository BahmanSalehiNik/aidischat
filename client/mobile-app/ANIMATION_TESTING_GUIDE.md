# Animation Testing Guide

## Quick Test Steps

### Step 1: Check if Model Has Animations

When you load a model, check the console logs:

**✅ Model HAS animations:**
```
🎬 [Model3DViewer] Found 5 animations: ['idle', 'talking', 'thinking', 'walking', 'flying']
✅ [AnimationController] Mapped idle → idle
✅ [AnimationController] Mapped talking → talking
✅ [AnimationController] Mapped thinking → thinking
```

**❌ Model has NO animations:**
```
⚠️ [Model3DViewer] No animations found in GLTF model
⚠️ [AnimationController] No animation found for state: idle
```

**If you see the ❌ messages**, your model doesn't have animation clips. You need a GLTF model with animations.

---

### Step 2: Check if Movements Are Being Detected

When you send a message, watch the console for:

```
🎭 [ARChatScreen] Markers found in stream: [{"type": "movement", "value": "talking"}]
🎬 [Model3DViewer] Movement change: talking → TALKING
```

**If you DON'T see these logs:**
- Backend might not be sending movement markers
- Check if markers are in the response: `['happy']['talking']Hello!`

---

### Step 3: Manual Animation Test

Add this temporary test button to manually trigger animations:

**In ARChatScreen.tsx, add a test button:**

```typescript
{/* Animation Test Buttons - Temporary for testing */}
<View style={{ position: 'absolute', top: 100, right: 10, gap: 8 }}>
  <TouchableOpacity
    onPress={() => setCurrentMovement('idle')}
    style={{ backgroundColor: '#007AFF', padding: 8, borderRadius: 8 }}
  >
    <Text style={{ color: '#FFF', fontSize: 10 }}>Idle</Text>
  </TouchableOpacity>
  <TouchableOpacity
    onPress={() => setCurrentMovement('talking')}
    style={{ backgroundColor: '#34C759', padding: 8, borderRadius: 8 }}
  >
    <Text style={{ color: '#FFF', fontSize: 10 }}>Talking</Text>
  </TouchableOpacity>
  <TouchableOpacity
    onPress={() => setCurrentMovement('thinking')}
    style={{ backgroundColor: '#FF9500', padding: 8, borderRadius: 8 }}
  >
    <Text style={{ color: '#FFF', fontSize: 10 }}>Thinking</Text>
  </TouchableOpacity>
</View>
```

This will let you manually test animations without waiting for backend markers.

---

## Common Issues

### Issue 1: Model Has No Animations

**Symptom:** Console shows `⚠️ No animations found in GLTF model`

**Solution:**
1. Use a model with animations (Ready Player Me, Mixamo)
2. Or add animations to your model in Blender
3. Export as GLTF with animations included

### Issue 2: Animation Names Don't Match

**Symptom:** Console shows `⚠️ No animation found for state: idle`

**Solution:**
1. Check what animations your model has (console will show)
2. Rename animations in your model to match: `idle`, `talking`, `thinking`, `walking`, `flying`
3. Or update `movementStateMachine.ts` to match your animation names

### Issue 3: Movements Not Being Sent

**Symptom:** No `🎬 [Model3DViewer] Movement change` logs

**Solution:**
1. Check backend is sending markers: `['happy']['talking']Hello!`
2. Check console for: `🎭 [ARChatScreen] Markers found in stream`
3. Verify `currentMovement` state is being set

---

## Expected Console Output (Working)

When animations work, you should see:

```
🎬 [Model3DViewer] Found 5 animations: ['idle', 'talking', 'thinking', 'walking', 'flying']
✅ [AnimationController] Mapped idle → idle
✅ [AnimationController] Mapped talking → talking
✅ [AnimationController] Mapped thinking → thinking
✅ [AnimationController] Mapped walking → walking
✅ [AnimationController] Mapped flying → flying
🎬 [AnimationController] Transition: IDLE → IDLE (idle)

[When message arrives:]
🎭 [ARChatScreen] Markers found in stream: [{"type": "movement", "value": "talking"}]
🎬 [Model3DViewer] Movement change: talking → TALKING
🎬 [AnimationController] Transition: IDLE → TALKING (talking)
```

---

## Quick Diagnostic

Run this in your console to check animation state:

```javascript
// Check if animations are loaded
console.log('Animation Controller:', animationControllerRef.current);
console.log('Current State:', animationControllerRef.current?.getCurrentState());
console.log('Has Idle:', animationControllerRef.current?.hasAnimation('idle'));
```

---

## Next Steps

1. **Check console logs** when model loads - does it find animations?
2. **Check console logs** when message arrives - are movements detected?
3. **Add test buttons** (code above) to manually trigger animations
4. **Verify model** has animation clips with correct names

If your model has animations and you see the mapping logs, but still no movement, the issue might be in the animation playback itself. Check the AnimationController logs for transition messages.
