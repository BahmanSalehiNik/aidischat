# Unity Deep Linking Implementation - Complete

## ✅ What Was Implemented

I've implemented the complete deep linking setup for connecting the React Native app to the Unity AR app.

### Files Created:

1. **`client/unity/ARAvatarClient/Assets/Scripts/DeepLinkHandler.cs`**
   - Handles deep links from React Native
   - Parses `aichatar://ar?agentId=123&roomId=456` URLs
   - Automatically initializes ARChatManager with agentId
   - Works on both Android and iOS

2. **`client/unity/ARAvatarClient/Assets/Plugins/Android/AndroidManifest.xml`**
   - Configures Android deep linking intent filter
   - Registers `aichatar://ar` URL scheme
   - Unity will merge this with default manifest during build

3. **`client/unity/ARAvatarClient/Assets/Scripts/Editor/DeepLinkTester.cs`**
   - Unity Editor tool for testing deep links
   - Access via: Menu → AIChatAR → Test Deep Link

4. **Documentation:**
   - `client/unity/ARAvatarClient/UNITY_DEEP_LINKING_SETUP.md` - Complete setup guide
   - `client/unity/ARAvatarClient/QUICK_SETUP_DEEP_LINKING.md` - Quick 5-minute setup
   - `docs/video-chat-unity-integration.md` - Integration overview

### React Native Side (Already Done):

- ✅ `ARChatScreen.tsx` updated with "Launch Unity AR" button
- ✅ Deep linking implemented: `Linking.openURL('aichatar://ar?agentId=...&roomId=...')`
- ✅ Error handling if Unity app not installed

---

## 🚀 Next Steps (You Need to Do)

### Step 1: Enable Custom Android Manifest in Unity

1. Open Unity Editor
2. Edit → Project Settings → Player
3. Android tab → Publishing Settings
4. ✅ Check **Custom Main Manifest**
5. Click Apply

### Step 2: Configure iOS URL Scheme

1. Still in Player Settings
2. Switch to **iOS** tab
3. Other Settings → Supported URL schemes
4. Click **+** and add: `aichatar`
5. Click Apply

### Step 3: Add DeepLinkHandler to Scene

1. Open your scene (e.g., `SampleScene.unity`)
2. Create Empty GameObject
3. Name it: `DeepLinkHandler`
4. Add `DeepLinkHandler` component to it
5. Make sure `ARChatManager` is also in the scene

### Step 4: Build and Test

1. Build Unity app (Android APK or iOS)
2. Install on device
3. Test from React Native app:
   - Click "Video Chat"
   - Click "Launch Unity AR"
   - Unity app should open and load avatar!

---

## 🔄 Complete Flow

```
React Native App
    ↓
User clicks "Video Chat" → ARChatScreen
    ↓
Gets modelUrl and roomId from backend
    ↓
User clicks "Launch Unity AR" button
    ↓
Linking.openURL('aichatar://ar?agentId=123&roomId=456')
    ↓
Android/iOS launches Unity app
    ↓
DeepLinkHandler.Start() receives deep link
    ↓
ParseDeepLink("aichatar://ar?agentId=123&roomId=456")
    ↓
Extract agentId and roomId
    ↓
Find ARChatManager in scene
    ↓
ARChatManager.SetAgentId(agentId)
    ↓
ARChatManager.InitializeARChat()
    ↓
AvatarLoader loads model from backend
    ↓
Avatar appears in AR scene! 🎉
```

---

## 🧪 Testing

### Manual Test (Android):
```bash
adb shell am start -W -a android.intent.action.VIEW \
  -d "aichatar://ar?agentId=test123&roomId=room456" \
  com.yourcompany.aichatar
```

### Manual Test (iOS):
```bash
xcrun simctl openurl booted "aichatar://ar?agentId=test123&roomId=room456"
```

### Check Logs:
```bash
# Android
adb logcat | grep -E "DeepLink|ARChat"

# Should see:
# 🔗 [DeepLink] Android deep link received: aichatar://ar?agentId=...
# 📋 [DeepLink] Parsed - agentId: ..., roomId: ...
# 🚀 [DeepLink] Initializing AR Chat with agentId: ...
```

---

## 📋 Verification Checklist

Before testing:
- [ ] Custom Main Manifest enabled in Unity Player Settings
- [ ] iOS URL scheme "aichatar" added
- [ ] DeepLinkHandler GameObject in scene
- [ ] ARChatManager GameObject in scene
- [ ] AndroidManifest.xml exists at `Assets/Plugins/Android/AndroidManifest.xml`
- [ ] Unity app built and installed on device
- [ ] React Native app has "Launch Unity AR" button working

After testing:
- [ ] Deep link opens Unity app
- [ ] Unity logs show deep link received
- [ ] ARChatManager initializes with correct agentId
- [ ] Avatar loads successfully
- [ ] AR scene displays avatar

---

## 🎯 Summary

**Everything is implemented!** You just need to:

1. ✅ Enable Custom Main Manifest in Unity (1 click)
2. ✅ Add iOS URL scheme in Unity (1 click)
3. ✅ Add DeepLinkHandler to scene (2 minutes)
4. ✅ Build and test (5 minutes)

The code is ready. The React Native app will launch the Unity app, and the Unity app will automatically load the avatar model for the specified agent.

See `client/unity/ARAvatarClient/QUICK_SETUP_DEEP_LINKING.md` for step-by-step instructions.

---

**Status**: ✅ **COMPLETE** - Ready for testing!

