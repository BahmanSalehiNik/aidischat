# Quick Setup: Unity Deep Linking

## ✅ Files Created

1. ✅ `Assets/Scripts/DeepLinkHandler.cs` - Handles deep links
2. ✅ `Assets/Plugins/Android/AndroidManifest.xml` - Android deep linking config
3. ✅ `Assets/Scripts/Editor/DeepLinkTester.cs` - Editor testing tool

## 🚀 Quick Setup (5 minutes)

### Step 1: Enable Custom Android Manifest

1. Open Unity Editor
2. Edit → Project Settings → Player
3. Select **Android** tab
4. Expand **Publishing Settings**
5. Check **Custom Main Manifest** ✅
6. Click **Apply**

This tells Unity to use your custom `Assets/Plugins/Android/AndroidManifest.xml`

### Step 2: Configure iOS URL Scheme

1. Still in Player Settings (Android tab)
2. Switch to **iOS** tab
3. Scroll to **Other Settings**
4. Find **Supported URL schemes**
5. Click **+** button
6. Enter: `aichatar`
7. Click **Apply**

### Step 3: Add DeepLinkHandler to Scene

1. Open your main scene (e.g., `Assets/Scenes/SampleScene.unity`)
2. In Hierarchy, right-click → Create Empty
3. Name it: `DeepLinkHandler`
4. Select the GameObject
5. In Inspector, click **Add Component**
6. Search for: `DeepLinkHandler`
7. Add the component

**Important:** Make sure ARChatManager is also in the scene!

### Step 4: Build and Test

1. **Build Android APK:**
   - File → Build Settings
   - Select Android
   - Click Build
   - Save APK

2. **Install on device:**
   ```bash
   adb install YourApp.apk
   ```

3. **Test deep link:**
   ```bash
   adb shell am start -W -a android.intent.action.VIEW \
     -d "aichatar://ar?agentId=test123&roomId=room456" \
     com.yourcompany.aichatar
   ```

4. **Check Unity logs:**
   ```bash
   adb logcat | grep -E "DeepLink|ARChat"
   ```

   You should see:
   ```
   🔗 [DeepLink] Android deep link received: aichatar://ar?agentId=test123&roomId=room456
   📋 [DeepLink] Parsed - agentId: test123, roomId: room456
   🚀 [DeepLink] Initializing AR Chat with agentId: test123
   ```

### Step 5: Test from React Native

1. Build and install React Native app
2. Navigate to agent detail screen
3. Click "Video Chat"
4. Click "Launch Unity AR" button
5. Unity app should open and initialize!

---

## 🐛 Troubleshooting

### "Custom Main Manifest" option not found

**Solution:** Make sure you're in:
- Edit → Project Settings → Player → Android tab → Publishing Settings

### Deep link doesn't work

**Check:**
1. ✅ Custom Main Manifest is enabled
2. ✅ AndroidManifest.xml exists at `Assets/Plugins/Android/AndroidManifest.xml`
3. ✅ DeepLinkHandler is in scene
4. ✅ ARChatManager is in scene
5. ✅ Package name matches: `com.yourcompany.aichatar`

**Test manually:**
```bash
# Check if app is installed
adb shell pm list packages | grep aichatar

# Test deep link
adb shell am start -W -a android.intent.action.VIEW \
  -d "aichatar://ar?agentId=test" com.yourcompany.aichatar
```

### Unity app opens but doesn't initialize

**Check logs:**
```bash
adb logcat | grep DeepLink
```

**Common issues:**
- DeepLinkHandler not in scene → Add it
- ARChatManager not in scene → Add it
- Parameters not parsed → Check URL format

---

## 📋 Checklist

Before building:
- [ ] Custom Main Manifest enabled in Player Settings
- [ ] iOS URL scheme "aichatar" added
- [ ] DeepLinkHandler GameObject in scene
- [ ] DeepLinkHandler component attached
- [ ] ARChatManager GameObject in scene
- [ ] AndroidManifest.xml at `Assets/Plugins/Android/AndroidManifest.xml`

After building:
- [ ] Test deep link manually (adb command)
- [ ] Check Unity logs for deep link messages
- [ ] Test from React Native app
- [ ] Verify ARChatManager initializes
- [ ] Verify avatar loads

---

**That's it!** The deep linking is now configured. When you click "Launch Unity AR" in the React Native app, it will open the Unity app and automatically load the avatar.

