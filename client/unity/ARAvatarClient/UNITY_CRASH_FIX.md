# Unity App Crash Fix

## 🚨 Issue Found
Unity app crashes on launch with:
```
java.lang.IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.
```

## ✅ Fix Applied
Updated `Assets/Plugins/Android/AndroidManifest.xml` to add:
- `android:theme="@android:style/Theme.NoTitleBar.Fullscreen"` - Required theme for Unity activities
- `android:launchMode="singleTask"` - Ensures only one instance of the app runs

## 📋 Next Steps

1. **Rebuild Unity App:**
   - Open Unity Editor
   - File → Build Settings
   - Select Android
   - Click Build
   - Save new APK

2. **Uninstall old app:**
   ```bash
   adb uninstall com.unity.template.ar_mobile
   ```

3. **Install new build:**
   ```bash
   adb install YourNewBuild.apk
   ```

4. **Test deep link:**
   ```bash
   adb shell am start -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123" com.unity.template.ar_mobile
   ```

5. **Check logs:**
   ```bash
   adb logcat | grep -E "DeepLink|ARChat|Unity"
   ```

## ⚠️ Important: Scene Setup Still Required

Even after fixing the crash, you MUST ensure:

1. **DeepLinkHandler is in the scene:**
   - Open `Assets/Scenes/SampleScene.unity`
   - Add GameObject named "DeepLinkHandler"
   - Add DeepLinkHandler component

2. **ARChatManager is in the scene:**
   - Add GameObject named "ARChatManager"
   - Add ARChatManager component
   - Configure API URLs and auth token

3. **AR Foundation is set up:**
   - AR Session Origin
   - AR Camera
   - AR Session

See `DEEP_LINK_TROUBLESHOOTING.md` for complete scene setup.

