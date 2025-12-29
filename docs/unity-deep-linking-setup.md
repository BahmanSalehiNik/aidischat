# Unity AR App Deep Linking Setup

## Overview

To connect the React Native app to the Unity AR app, you need to configure deep linking in the Unity app.

## Current Implementation

The React Native app now launches the Unity app using deep linking:
- URL Scheme: `aichatar://ar`
- Parameters: `agentId` and `roomId`

## Unity App Configuration

### Android Setup

1. **Edit AndroidManifest.xml** (in Unity project):
   ```xml
   <activity android:name="com.unity3d.player.UnityPlayerActivity"
             android:label="@string/app_name">
     <!-- Existing intent filters -->
     
     <!-- Add deep linking intent filter -->
     <intent-filter>
       <action android:name="android.intent.action.VIEW" />
       <category android:name="android.intent.category.DEFAULT" />
       <category android:name="android.intent.category.BROWSABLE" />
       <data android:scheme="aichatar" android:host="ar" />
     </intent-filter>
   </activity>
   ```

2. **In Unity C# Script** (ARChatManager.cs or similar):
   ```csharp
   using UnityEngine;
   using System;
   
   public class DeepLinkHandler : MonoBehaviour
   {
       void Start()
       {
           // Get deep link parameters
           #if UNITY_ANDROID && !UNITY_EDITOR
           string deepLink = GetAndroidDeepLink();
           if (!string.IsNullOrEmpty(deepLink))
           {
               ParseDeepLink(deepLink);
           }
           #endif
       }
       
       #if UNITY_ANDROID && !UNITY_EDITOR
       private string GetAndroidDeepLink()
       {
           AndroidJavaClass unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
           AndroidJavaObject currentActivity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
           AndroidJavaObject intent = currentActivity.Call<AndroidJavaObject>("getIntent");
           string dataString = intent.Call<string>("getDataString");
           return dataString;
       }
       #endif
       
       private void ParseDeepLink(string url)
       {
           // Parse: aichatar://ar?agentId=123&roomId=456
           if (url.StartsWith("aichatar://ar"))
           {
               Uri uri = new Uri(url);
               var queryParams = System.Web.HttpUtility.ParseQueryString(uri.Query);
               
               string agentId = queryParams["agentId"];
               string roomId = queryParams["roomId"];
               
               Debug.Log($"🔗 Deep Link: agentId={agentId}, roomId={roomId}");
               
               // Initialize AR Chat with these parameters
               var arChatManager = FindObjectOfType<ARChatManager>();
               if (arChatManager != null)
               {
                   arChatManager.SetAgentId(agentId);
                   arChatManager.InitializeARChat();
               }
           }
       }
   }
   ```

### iOS Setup

1. **Edit Info.plist** (in Unity Xcode project):
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

2. **In Unity C# Script** (for iOS):
   ```csharp
   #if UNITY_IOS && !UNITY_EDITOR
   using UnityEngine.iOS;
   
   void OnApplicationFocus(bool hasFocus)
   {
       if (hasFocus)
       {
           // Check for deep link
           string deepLink = Application.absoluteURL;
           if (!string.IsNullOrEmpty(deepLink))
           {
               ParseDeepLink(deepLink);
           }
       }
   }
   #endif
   ```

## Testing Deep Links

### Android
```bash
# Test deep link from command line
adb shell am start -W -a android.intent.action.VIEW -d "aichatar://ar?agentId=test123&roomId=room456" com.yourcompany.aichatar
```

### iOS
```bash
# Test deep link from command line (on Mac)
xcrun simctl openurl booted "aichatar://ar?agentId=test123&roomId=room456"
```

## React Native App Flow

1. User clicks "Video Chat" button
2. React Native app navigates to ARChatScreen
3. ARChatScreen gets modelUrl and roomId
4. User clicks "Launch Unity AR" button
5. React Native calls: `Linking.openURL('aichatar://ar?agentId=...&roomId=...')`
6. Unity app receives deep link
7. Unity app parses parameters and initializes AR chat

## Troubleshooting

### Unity app doesn't open
- Check if Unity app is installed
- Verify URL scheme matches in both apps
- Check AndroidManifest.xml / Info.plist configuration

### Parameters not received
- Check Unity logs for deep link URL
- Verify parameter parsing code
- Test deep link manually using adb/xcrun

### Unity app opens but doesn't initialize
- Check if ARChatManager is in the scene
- Verify SetAgentId() is called
- Check InitializeARChat() is called after SetAgentId()

---

**Last Updated**: [Current Date]

