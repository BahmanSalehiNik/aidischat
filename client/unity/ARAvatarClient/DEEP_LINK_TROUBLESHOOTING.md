# Deep Link Troubleshooting Guide

## 🔍 Current Issue
Unity app opens but:
- No AR screen appears
- No agent is loaded
- No deep link logs in Unity

## ✅ Verification Checklist

### 1. Verify Deep Link Registration
```bash
adb shell dumpsys package com.unity.template.ar_mobile | grep -A 5 "aichatar"
```
**Expected:** Should show `aichatar` scheme registered ✅

### 2. Test Deep Link Manually
```bash
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123" com.unity.template.ar_mobile
```
**Expected:** Unity app should open

### 3. Check Unity Logs
```bash
adb logcat -c  # Clear logs
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123" com.unity.template.ar_mobile
adb logcat | grep -E "DeepLink|ARChat|Unity"
```
**Expected:** Should see:
```
🔗 [DeepLink] Android deep link received: aichatar://ar?agentId=test123
📋 [DeepLink] Parsed - agentId: test123
🚀 [DeepLink] Initializing AR Chat with agentId: test123
```

**If you see NO logs:** DeepLinkHandler is NOT in the scene!

---

## 🚨 Common Issues & Fixes

### Issue 1: No Deep Link Logs
**Symptom:** Unity app opens but no `[DeepLink]` logs appear

**Cause:** DeepLinkHandler GameObject is not in the scene

**Fix:**
1. Open Unity Editor
2. Open your main scene (check `Library/LastSceneManagerSetup.txt` for scene name)
3. In Hierarchy, check if `DeepLinkHandler` GameObject exists
4. If NOT:
   - Right-click Hierarchy → Create Empty
   - Name it: `DeepLinkHandler`
   - Select it
   - Inspector → Add Component → Search "DeepLinkHandler"
   - Add component
5. Save scene (Ctrl+S)
6. Rebuild APK

### Issue 2: "ARChatManager not found in scene"
**Symptom:** Logs show: `❌ [DeepLink] ARChatManager not found in scene!`

**Cause:** ARChatManager GameObject is not in the scene

**Fix:**
1. Open Unity Editor
2. Open your main scene
3. In Hierarchy, check if `ARChatManager` GameObject exists
4. If NOT:
   - Right-click Hierarchy → Create Empty
   - Name it: `ARChatManager`
   - Select it
   - Inspector → Add Component → Search "ARChatManager"
   - Add component
   - Configure ARChatManager:
     - Set `apiBaseUrl` (e.g., `http://192.168.178.179:8080/api`)
     - Set `wsUrl` (e.g., `ws://192.168.178.179:8080/api/realtime`)
     - Set `authToken` (if needed)
5. Save scene
6. Rebuild APK

### Issue 3: Unity App Opens But Shows Default Scene
**Symptom:** Unity app opens but shows Unity default scene, not AR scene

**Cause:** Wrong scene is set as build scene, or AR scene not configured

**Fix:**
1. Open Unity Editor
2. File → Build Settings
3. Check "Scenes In Build" list
4. Make sure your AR scene is:
   - Added to the list
   - Checked/enabled
   - At index 0 (first scene)
5. If AR scene is missing:
   - Click "Add Open Scenes"
   - Or drag scene from Project window to "Scenes In Build"
6. Rebuild APK

### Issue 4: Deep Link Works But No AR Screen
**Symptom:** Logs show deep link received, but no AR camera/view appears

**Cause:** AR Foundation not initialized or AR Camera missing

**Fix:**
1. Open Unity Editor
2. Open your AR scene
3. Check Hierarchy for:
   - `AR Session Origin` (AR Foundation)
   - `AR Camera` (child of AR Session Origin)
   - `AR Session` (AR Foundation)
4. If missing:
   - Window → Package Manager
   - Install "AR Foundation"
   - Install "ARCore XR Plugin" (Android)
   - GameObject → XR → AR Session Origin
   - GameObject → XR → AR Session
5. Save scene
6. Rebuild APK

---

## 📋 Complete Scene Setup Checklist

Your Unity scene MUST have:

- [ ] **DeepLinkHandler** GameObject with DeepLinkHandler component
- [ ] **ARChatManager** GameObject with ARChatManager component
- [ ] **AR Session Origin** (AR Foundation)
- [ ] **AR Camera** (child of AR Session Origin)
- [ ] **AR Session** (AR Foundation)
- [ ] **AvatarLoader** GameObject (if separate)
- [ ] Scene is in "Scenes In Build" (Build Settings)
- [ ] Scene is at index 0 (first scene)

---

## 🧪 Testing Steps

### Step 1: Test Deep Link Reception
```bash
# Clear logs
adb logcat -c

# Launch Unity app via deep link
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123" com.unity.template.ar_mobile

# Check logs (wait 5 seconds)
adb logcat -d | grep -E "DeepLink|ARChat"
```

**Expected Output:**
```
🔗 [DeepLink] Android deep link received: aichatar://ar?agentId=test123
📋 [DeepLink] Parsed - agentId: test123
🚀 [DeepLink] Initializing AR Chat with agentId: test123
```

**If NO output:** DeepLinkHandler is NOT in scene → Add it!

### Step 2: Test AR Initialization
After Step 1 succeeds, check for:
```
🚀 Initializing AR Chat for agent: test123
✅ AR Room created: [room-id]
```

**If you see "ARChatManager not found":** Add ARChatManager to scene!

### Step 3: Test from React Native
1. Open React Native app
2. Navigate to AR Chat screen
3. Click "Launch Unity AR"
4. Check Unity logs:
   ```bash
   adb logcat | grep -E "DeepLink|ARChat"
   ```

---

## 🔧 Quick Fix Script

If you're not sure what's missing, run this to check:

```bash
# Check if Unity app is installed
adb shell pm list packages | grep unity

# Check deep link registration
adb shell dumpsys package com.unity.template.ar_mobile | grep -A 5 "aichatar"

# Test deep link
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123" com.unity.template.ar_mobile

# Check logs (wait 3 seconds)
sleep 3
adb logcat -d | grep -E "DeepLink|ARChat|Unity" | tail -20
```

---

## 📝 Next Steps

1. **If no DeepLink logs:** Add DeepLinkHandler to scene → Rebuild
2. **If "ARChatManager not found":** Add ARChatManager to scene → Rebuild
3. **If AR screen doesn't appear:** Check AR Foundation setup → Rebuild
4. **If still not working:** Check Unity Editor Console for errors

---

## 🎯 Most Likely Issue

Based on symptoms (app opens but nothing happens), the most likely issue is:

**DeepLinkHandler is NOT in the scene!**

**Solution:**
1. Open Unity Editor
2. Open main scene
3. Add DeepLinkHandler GameObject
4. Rebuild APK
5. Reinstall on device
6. Test again

