# Video Chat → Unity App Integration Guide

## Current Status

**Answer to your question**: **NO**, clicking "Video Chat" does NOT automatically load the model in the Unity app.

### What Happens Now

1. ✅ User clicks "Video Chat" button in React Native app
2. ✅ React Native navigates to `ARChatScreen`
3. ✅ ARChatScreen gets model URL and room ID from backend
4. ⚠️ **Shows placeholder** - "AR rendering will be implemented here"
5. ❌ **Does NOT launch Unity app automatically**

### What I Just Implemented

I've updated `ARChatScreen.tsx` to:
- ✅ Show "Launch Unity AR" button when model is ready
- ✅ Attempt to launch Unity app via deep linking: `aichatar://ar?agentId=...&roomId=...`
- ✅ Show helpful error messages if Unity app is not installed

## Next Steps Required

### Step 1: Configure Unity App for Deep Linking

The Unity app needs to be configured to receive deep links.

#### Android Configuration

1. **Edit AndroidManifest.xml** in Unity project:
   - Location: `Assets/Plugins/Android/AndroidManifest.xml` (create if doesn't exist)
   - Or use Unity's custom manifest feature

2. **Add intent filter**:
   ```xml
   <activity android:name="com.unity3d.player.UnityPlayerActivity">
     <!-- Existing intent filters -->
     
     <!-- Add this for deep linking -->
     <intent-filter>
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="aichatar" android:host="ar" />
     </intent-filter>
   </activity>
   ```

#### iOS Configuration

1. **In Unity Editor**:
   - Edit → Project Settings → Player
   - iOS tab → Other Settings
   - Add to "Supported URL schemes": `aichatar`

2. **Or edit Info.plist** in Xcode project after building

### Step 2: Add Deep Link Handler in Unity

Create a script in Unity to handle deep links:

```csharp
// Assets/Scripts/DeepLinkHandler.cs
using UnityEngine;
using System;

public class DeepLinkHandler : MonoBehaviour
{
    void Start()
    {
        #if UNITY_ANDROID && !UNITY_EDITOR
        CheckDeepLink();
        #endif
        
        #if UNITY_IOS && !UNITY_EDITOR
        // iOS handles deep links via OnApplicationFocus
        #endif
    }
    
    #if UNITY_ANDROID && !UNITY_EDITOR
    private void CheckDeepLink()
    {
        try
        {
            AndroidJavaClass unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
            AndroidJavaObject currentActivity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            AndroidJavaObject intent = currentActivity.Call<AndroidJavaObject>("getIntent");
            string dataString = intent.Call<string>("getDataString");
            
            if (!string.IsNullOrEmpty(dataString))
            {
                Debug.Log($"🔗 Deep Link received: {dataString}");
                ParseDeepLink(dataString);
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"Error getting deep link: {e.Message}");
        }
    }
    #endif
    
    #if UNITY_IOS && !UNITY_EDITOR
    void OnApplicationFocus(bool hasFocus)
    {
        if (hasFocus)
        {
            string url = Application.absoluteURL;
            if (!string.IsNullOrEmpty(url) && url.StartsWith("aichatar://"))
            {
                Debug.Log($"🔗 Deep Link received: {url}");
                ParseDeepLink(url);
            }
        }
    }
    #endif
    
    private void ParseDeepLink(string url)
    {
        // Parse: aichatar://ar?agentId=123&roomId=456
        if (url.StartsWith("aichatar://ar"))
        {
            try
            {
                Uri uri = new Uri(url);
                var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
                
                string agentId = query["agentId"];
                string roomId = query["roomId"];
                
                Debug.Log($"📋 Parsed: agentId={agentId}, roomId={roomId}");
                
                // Initialize AR Chat
                var arChatManager = FindObjectOfType<ARChatManager>();
                if (arChatManager != null)
                {
                    if (!string.IsNullOrEmpty(agentId))
                    {
                        arChatManager.SetAgentId(agentId);
                    }
                    arChatManager.InitializeARChat();
                }
                else
                {
                    Debug.LogError("❌ ARChatManager not found in scene!");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Error parsing deep link: {e.Message}");
            }
        }
    }
}
```

### Step 3: Test Deep Linking

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

### Step 4: Rebuild Unity App

After making changes:
1. Build Unity app in Unity Editor
2. Install on device
3. Test deep linking from React Native app

## Troubleshooting

### Unity app doesn't open when clicking "Launch Unity AR"

**Check:**
1. ✅ Unity app is installed on device
2. ✅ URL scheme matches: `aichatar://ar`
3. ✅ AndroidManifest.xml has intent filter (Android)
4. ✅ Info.plist has URL scheme (iOS)

**Test:**
```bash
# Android
adb shell pm list packages | grep aichatar
adb shell am start -W -a android.intent.action.VIEW -d "aichatar://ar?agentId=test" com.yourcompany.aichatar
```

### Unity app opens but doesn't load model

**Check:**
1. ✅ Deep link handler script is in scene
2. ✅ ARChatManager is in scene
3. ✅ Parameters are being parsed correctly
4. ✅ Check Unity logs: `adb logcat | grep Unity`

### Model URL not accessible

**Check:**
1. ✅ Avatar status is "ready" in backend
2. ✅ Model URL is valid and accessible
3. ✅ CORS is configured on Azure Blob Storage (if using Azure)
4. ✅ Signed URL hasn't expired

## Complete Flow

```
React Native App
    ↓
User clicks "Video Chat"
    ↓
ARChatScreen loads
    ↓
Gets modelUrl and roomId from backend
    ↓
User clicks "Launch Unity AR" button
    ↓
React Native calls: Linking.openURL('aichatar://ar?agentId=...&roomId=...')
    ↓
Android/iOS launches Unity app
    ↓
Unity app receives deep link
    ↓
DeepLinkHandler parses parameters
    ↓
ARChatManager.SetAgentId(agentId)
    ↓
ARChatManager.InitializeARChat()
    ↓
Unity app loads model from modelUrl
    ↓
Avatar appears in AR scene
```

## Alternative: Embed Unity in React Native

If you want a seamless experience without app switching, you would need to:
1. Build Unity as native library (AAR for Android, Framework for iOS)
2. Integrate Unity as native module in React Native
3. Render Unity view inside React Native screen

This is more complex but provides better UX. See `docs/ar/unity-react-native-integration.md` for details.

---

**Last Updated**: [Current Date]

