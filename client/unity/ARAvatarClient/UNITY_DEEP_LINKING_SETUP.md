# Unity Deep Linking Setup - Complete Guide

## ✅ What Has Been Implemented

1. **DeepLinkHandler.cs** - Created at `Assets/Scripts/DeepLinkHandler.cs`
   - Handles deep links from React Native app
   - Parses `aichatar://ar?agentId=123&roomId=456` URLs
   - Initializes ARChatManager with agentId

2. **AndroidManifest.xml** - Created at `Assets/Plugins/Android/AndroidManifest.xml`
   - Configures Android deep linking intent filter
   - Registers `aichatar://ar` URL scheme

3. **iOS URL Schemes** - Need to configure in Unity Editor (see below)

---

## 📋 Setup Steps

### Step 1: Add DeepLinkHandler to Scene

1. **Open Unity Editor**
2. **Open your main scene** (e.g., `Assets/Scenes/SampleScene.unity`)
3. **Create empty GameObject:**
   - Right-click in Hierarchy → Create Empty
   - Name it: `DeepLinkHandler`
4. **Add DeepLinkHandler component:**
   - Select `DeepLinkHandler` GameObject
   - In Inspector, click "Add Component"
   - Search for "DeepLinkHandler"
   - Add the component
5. **Verify:**
   - DeepLinkHandler script should be attached
   - GameObject should persist across scenes (DontDestroyOnLoad)

### Step 2: Configure iOS URL Schemes

1. **In Unity Editor:**
   - Edit → Project Settings → Player
   - Select **iOS** tab
   - Scroll to **Other Settings**
   - Find **Supported URL schemes**
   - Click **+** to add new scheme
   - Enter: `aichatar`
   - Click **Apply**

2. **Alternative (Manual Info.plist edit):**
   - Build iOS project
   - Open generated Xcode project
   - Edit `Info.plist`
   - Add:
   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>aichatar</string>
       </array>
       <key>CFBundleURLName</key>
       <string>com.yourcompany.aichatar</string>
     </dict>
   </array>
   ```

### Step 3: Verify Android Manifest

The AndroidManifest.xml is already created at:
- `Assets/Plugins/Android/AndroidManifest.xml`

**Unity will automatically merge this with the default manifest during build.**

**To verify it's being used:**
1. Build Android APK
2. Extract APK: `unzip -q YourApp.apk -d extracted/`
3. Check manifest: `aapt dump xmltree YourApp.apk AndroidManifest.xml | grep -A 10 "intent-filter"`

### Step 4: Enable Custom Main Manifest

**Important:** You must enable this for Unity to use your custom manifest!

1. **In Unity Editor:**
   - Edit → Project Settings → Player
   - Select **Android** tab
   - Expand **Publishing Settings**
   - Check **Custom Main Manifest** ✅
   - Click **Apply**

### Step 5: Test Deep Linking

#### Test on Android:
```bash
# Test deep link manually
adb shell am start -W -a android.intent.action.VIEW \
  -d "aichatar://ar?agentId=test123&roomId=room456" \
  com.yourcompany.aichatar
```

#### Test on iOS:
```bash
# Test deep link manually (on Mac)
xcrun simctl openurl booted "aichatar://ar?agentId=test123&roomId=room456"
```

#### Test from React Native:
1. Build and install Unity app
2. Open React Native app
3. Navigate to agent detail screen
4. Click "Video Chat"
5. Click "Launch Unity AR" button
6. Unity app should open and initialize with agentId

---

## 🔍 How It Works

### Flow:
```
React Native App
    ↓
User clicks "Launch Unity AR"
    ↓
Linking.openURL('aichatar://ar?agentId=123&roomId=456')
    ↓
Android/iOS launches Unity app
    ↓
DeepLinkHandler.Start() or OnApplicationFocus()
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
Avatar loads and appears in AR
```

### DeepLinkHandler Logic:

1. **Android:**
   - Checks intent data on `Start()`
   - Also checks when app resumes (OnApplicationPause)
   - Uses AndroidJavaClass to get intent data

2. **iOS:**
   - Checks `Application.absoluteURL` on `Start()`
   - Also checks when app gains focus (OnApplicationFocus)
   - Parses URL directly

3. **Parsing:**
   - Extracts `agentId` and `roomId` from query string
   - Calls `ARChatManager.SetAgentId()` and `InitializeARChat()`

---

## 🐛 Troubleshooting

### Unity app doesn't open when clicking "Launch Unity AR"

**Check:**
1. ✅ Unity app is installed on device
2. ✅ AndroidManifest.xml exists at `Assets/Plugins/Android/AndroidManifest.xml`
3. ✅ **Custom Main Manifest is enabled** in Player Settings
4. ✅ iOS URL scheme is configured in Player Settings
5. ✅ Package name matches: Check `com.yourcompany.aichatar` in both apps

**Test manually:**
```bash
# Android
adb shell pm list packages | grep aichatar
adb shell am start -W -a android.intent.action.VIEW -d "aichatar://ar?agentId=test" com.yourcompany.aichatar
```

### Unity app opens but doesn't initialize

**Check Unity logs:**
```bash
# Android
adb logcat | grep -E "DeepLink|ARChat"

# Look for:
# 🔗 [DeepLink] Android deep link received: aichatar://ar?agentId=...
# 📋 [DeepLink] Parsed - agentId: ..., roomId: ...
# 🚀 [DeepLink] Initializing AR Chat with agentId: ...
```

**Common issues:**
1. **DeepLinkHandler not in scene:**
   - Error: "ARChatManager not found in scene"
   - Solution: Add DeepLinkHandler GameObject to scene

2. **ARChatManager not in scene:**
   - Error: "ARChatManager not found in scene"
   - Solution: Add ARChatManager GameObject to scene

3. **Parameters not parsed:**
   - Check logs for parsing errors
   - Verify URL format: `aichatar://ar?agentId=123&roomId=456`

### Deep link works but model doesn't load

**Check:**
1. ✅ Avatar status is "ready" in backend
2. ✅ Model URL is accessible
3. ✅ AvatarLoader is configured in ARChatManager
4. ✅ Check AvatarLoader logs for download errors

---

## 📝 Code Reference

### DeepLinkHandler.cs Location:
`Assets/Scripts/DeepLinkHandler.cs`

### Key Methods:
- `CheckAndroidDeepLink()` - Gets intent data on Android
- `CheckIOSDeepLink()` - Gets URL on iOS
- `ParseDeepLink(string url)` - Parses URL and extracts parameters
- `InitializeARChatWithAgent(string agentId, string roomId)` - Initializes AR chat

### AndroidManifest.xml Location:
`Assets/Plugins/Android/AndroidManifest.xml`

### Intent Filter:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="aichatar" android:host="ar" />
</intent-filter>
```

---

## ✅ Checklist

Before building:
- [ ] DeepLinkHandler GameObject added to scene
- [ ] DeepLinkHandler component attached
- [ ] ARChatManager GameObject in scene
- [ ] AndroidManifest.xml at `Assets/Plugins/Android/AndroidManifest.xml`
- [ ] **Custom Main Manifest enabled** in Player Settings (IMPORTANT!)
- [ ] iOS URL scheme configured in Player Settings
- [ ] Package name matches between React Native and Unity apps

After building:
- [ ] Test deep link manually with adb/xcrun
- [ ] Test from React Native app
- [ ] Check Unity logs for deep link messages
- [ ] Verify ARChatManager initializes correctly
- [ ] Verify avatar loads

---

**Last Updated**: [Current Date]

