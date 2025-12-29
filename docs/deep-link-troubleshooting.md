# Deep Link Troubleshooting - Unity App Not Found

## Issue

React Native app shows "Unity AR App Not Found" error when clicking "Launch Unity AR" button, even though:
- ✅ Unity app is installed (`com.unity.template.ar_mobile`)
- ✅ Deep link is registered in system (`aichatar://ar`)
- ✅ AndroidManifest.xml exists with intent filter

## Root Cause

The Unity app was likely built **BEFORE** the AndroidManifest.xml was added or **BEFORE** "Custom Main Manifest" was enabled in Unity Player Settings.

## Solution

### Step 1: Verify Current Build Has Manifest

1. **Check if Custom Main Manifest is enabled:**
   - Open Unity Editor
   - Edit → Project Settings → Player → Android tab
   - Publishing Settings → Check "Custom Main Manifest" ✅
   - If not checked, check it and rebuild

2. **Verify AndroidManifest.xml exists:**
   - Location: `Assets/Plugins/Android/AndroidManifest.xml`
   - Should contain the deep link intent filter

### Step 2: Rebuild Unity App

**IMPORTANT:** You must rebuild the Unity app after:
- Adding AndroidManifest.xml
- Enabling Custom Main Manifest
- Making any manifest changes

1. **In Unity Editor:**
   - File → Build Settings
   - Select Android
   - Click **Build** (or Build and Run)
   - Save APK to a new location

2. **Uninstall old app:**
   ```bash
   adb uninstall com.unity.template.ar_mobile
   ```

3. **Install new build:**
   ```bash
   adb install YourNewBuild.apk
   ```

### Step 3: Verify Deep Link After Rebuild

```bash
# Check if deep link is registered
adb shell dumpsys package com.unity.template.ar_mobile | grep -A 5 "aichatar"

# Test deep link
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123"
```

### Step 4: Test from React Native

1. Rebuild React Native app (if you made code changes)
2. Click "Video Chat" → "Launch Unity AR"
3. Unity app should open

---

## Common Issues

### Issue 1: "Activity class does not exist"

**Cause:** Unity app uses different activity name than expected

**Check actual activity:**
```bash
adb shell dumpsys package com.unity.template.ar_mobile | grep -A 2 "Activity"
```

**Solution:** Update AndroidManifest.xml to match actual activity name, or rebuild with correct settings

### Issue 2: Deep link registered but doesn't work

**Cause:** Query parameters in URL format

**Test:**
```bash
# Simple URL (no params)
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar"

# With params
adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=123"
```

**Solution:** The React Native code now tries simpler URLs as fallback

### Issue 3: canOpenURL returns false

**Cause:** Android's canOpenURL can be unreliable

**Solution:** The React Native code now tries to open URL anyway, even if canOpenURL returns false

---

## Verification Checklist

After rebuilding Unity app:

- [ ] Custom Main Manifest enabled in Unity Player Settings
- [ ] AndroidManifest.xml exists at `Assets/Plugins/Android/AndroidManifest.xml`
- [ ] Unity app rebuilt after manifest changes
- [ ] Old app uninstalled
- [ ] New app installed
- [ ] Deep link registered: `adb shell dumpsys package com.unity.template.ar_mobile | grep aichatar`
- [ ] Manual test works: `adb shell am start -a android.intent.action.VIEW -d "aichatar://ar"`
- [ ] React Native app can launch Unity app

---

## Quick Fix

If you just want to test quickly:

1. **Rebuild Unity app** with Custom Main Manifest enabled
2. **Uninstall old app:** `adb uninstall com.unity.template.ar_mobile`
3. **Install new build:** `adb install YourNewBuild.apk`
4. **Test:** Click "Launch Unity AR" in React Native app

The React Native code has been updated to:
- Try opening URL even if canOpenURL returns false
- Show better error messages
- Provide troubleshooting steps

---

**Last Updated**: [Current Date]

