# Unity Build Guide - Building Your AR App

## Unity Hub vs Unity Editor

**Unity Hub** is used for:
- Installing Unity Editor versions
- Managing Unity projects
- Opening projects in Unity Editor
- **NOT for building apps** ❌

**Unity Editor** is used for:
- Developing your app
- Configuring build settings
- **Building the actual app (APK/IPA)** ✅
- Testing in Play Mode

---

## Building Your AR App

### Step 1: Open Project in Unity Editor

1. **Open Unity Hub**
2. Click **Open** (or **Add** if project not listed)
3. Navigate to: `/home/bahman/projects/aiChatDistributed/client/unity/ARAvatarClient/`
4. Select the folder and click **Open**
5. Unity Editor will launch and load your project

### Step 2: Configure Build Settings

1. In Unity Editor, go to **File > Build Settings** (or `Ctrl+Shift+B` / `Cmd+Shift+B`)
2. Select your target platform:
   - **Android** (for Android devices)
   - **iOS** (for iPhone/iPad - requires Mac)

3. **For Android:**
   - Click **Switch Platform** (if not already on Android)
   - Wait for Unity to reimport assets
   - Click **Player Settings** button
   - Configure:
     - **Company Name**: Your company name
     - **Product Name**: AI Chat AR
     - **Package Name**: `com.yourcompany.aichatar` (must be unique)
     - **Minimum API Level**: Android 7.0 (API 24) or higher
     - **Target API Level**: Latest
     - **Scripting Backend**: IL2CPP (recommended)
     - **Target Architectures**: ARM64 (required for ARCore)

4. **For iOS:**
   - Click **Switch Platform** (if not already on iOS)
   - Wait for Unity to reimport assets
   - Click **Player Settings** button
   - Configure:
     - **Bundle Identifier**: `com.yourcompany.aichatar` (must be unique)
     - **Target minimum iOS Version**: 11.0 or higher
     - **Scripting Backend**: IL2CPP
     - **Target Device**: iPhone + iPad

### Step 3: Build the App

#### Option A: Build APK/IPA Directly (Recommended for Testing)

**For Android:**
1. In **Build Settings**, ensure **Android** is selected
2. Click **Build** (or **Build and Run** to install on connected device)
3. Choose save location (e.g., `~/Downloads/AIChatAR.apk`)
4. Wait for build to complete (5-15 minutes first time)
5. Install APK on Android device:
   ```bash
   adb install ~/Downloads/AIChatAR.apk
   ```

**For iOS:**
1. In **Build Settings**, ensure **iOS** is selected
2. Click **Build**
3. Choose save location (creates Xcode project)
4. Open the generated `.xcodeproj` in Xcode
5. In Xcode:
   - Select your development team
   - Connect iOS device
   - Click **Run** (▶️) to build and install

#### Option B: Build and Run (Faster Testing)

1. Connect your device via USB
2. Enable **USB Debugging** (Android) or trust computer (iOS)
3. In Unity, click **Build and Run**
4. Unity will build and automatically install on connected device

---

## Build Requirements

### Android Build Requirements

- **Android SDK** (installed via Unity Hub or Android Studio)
- **Android NDK** (for IL2CPP builds)
- **JDK** (Java Development Kit)
- **USB Debugging enabled** on device

**Check if installed:**
- Unity Editor > **Edit > Preferences > External Tools**
- Verify paths are set correctly

### iOS Build Requirements

- **Mac computer** (required - iOS builds only work on macOS)
- **Xcode** (latest version from App Store)
- **Apple Developer Account** (for device testing)
- **iOS device** connected via USB

---

## Build Process Overview

```
Unity Editor
    ↓
File > Build Settings
    ↓
Select Platform (Android/iOS)
    ↓
Configure Player Settings
    ↓
Click "Build"
    ↓
Unity compiles scripts
    ↓
Unity packages assets
    ↓
Unity creates APK/IPA or Xcode project
    ↓
Install on device
```

---

## Troubleshooting Build Issues

### Android Build Fails

**Issue**: "SDK not found"
- **Solution**: Install Android SDK via Unity Hub or Android Studio
- Set path in: **Edit > Preferences > External Tools > Android**

**Issue**: "NDK not found" (for IL2CPP)
- **Solution**: Install Android NDK via Unity Hub
- Set path in: **Edit > Preferences > External Tools > Android**

**Issue**: "Gradle build failed"
- **Solution**: 
  - Check **Player Settings > Publishing Settings > Build**
  - Try **Mono** instead of **IL2CPP** for testing
  - Check Unity Console for specific errors

**Issue**: "Package name already exists"
- **Solution**: Change **Package Name** in Player Settings to something unique

**Issue**: `ERROR_NOT_SUPPORTED` or `Win32 IO returned ERROR_NOT_SUPPORTED` with MTP path
- **Cause**: Unity is trying to write build files to Android device storage via MTP (Media Transfer Protocol)
- **Solution**: 
  1. **Disconnect Android device** from PC (or unmount it from file manager)
  2. **Build to local directory** on your PC:
     - In Unity Build Settings, click **Build** (not Build and Run)
     - Choose a **local folder** like:
       - `~/Downloads/` (Linux/Mac)
       - `C:\Users\YourName\Downloads\` (Windows)
       - `~/projects/aiChatDistributed/builds/` (project folder)
     - **DO NOT** select the device's storage or any MTP-mounted path
  3. After build completes, install APK separately:
     ```bash
     adb install ~/Downloads/AIChatAR.apk
     ```
  4. **Alternative**: Use "Build and Run" but ensure device is connected via **USB Debugging** (not MTP file transfer mode)

### iOS Build Fails

**Issue**: "Xcode not found"
- **Solution**: Install Xcode from Mac App Store

**Issue**: "Signing failed"
- **Solution**: 
  - In Xcode, select your **Development Team**
  - Go to **Signing & Capabilities** tab
  - Enable **Automatically manage signing**

**Issue**: "ARKit not available"
- **Solution**: Ensure **ARKit** is enabled in **XR Plug-in Management**

---

## Development vs Production Builds

### Development Build (Faster, for Testing)

**Settings:**
- **Development Build**: ✅ Enabled
- **Script Debugging**: ✅ Enabled
- **Compression**: None or Low
- **Build Size**: Larger (includes debug symbols)

**Use for:**
- Testing features
- Debugging
- Rapid iteration

### Production Build (Optimized, for Release)

**Settings:**
- **Development Build**: ❌ Disabled
- **Script Debugging**: ❌ Disabled
- **Compression**: High
- **Build Size**: Smaller
- **Minify**: Enable (Android)

**Use for:**
- App Store/Play Store release
- Beta testing
- Performance testing

---

## Command Line Building (Advanced)

You can also build from command line (useful for CI/CD):

### Android Build

```bash
cd /path/to/unity/editor
./Unity -quit -batchmode -projectPath /home/bahman/projects/aiChatDistributed/client/unity/ARAvatarClient \
  -buildTarget Android -buildPath ~/Downloads/AIChatAR.apk
```

### iOS Build

```bash
cd /path/to/unity/editor
./Unity -quit -batchmode -projectPath /home/bahman/projects/aiChatDistributed/client/unity/ARAvatarClient \
  -buildTarget iOS -buildPath ~/Downloads/AIChatAR.xcodeproj
```

---

## Quick Start Checklist

- [ ] Open project in Unity Editor (via Unity Hub)
- [ ] Configure Player Settings (Package Name, API Level, etc.)
- [ ] Switch to target platform (Android/iOS)
- [ ] Connect device via USB
- [ ] Enable USB Debugging (Android) or trust computer (iOS)
- [ ] Click **Build and Run** in Unity
- [ ] Wait for build to complete
- [ ] App installs and launches on device

---

## Summary

**To build your Unity app:**
1. ✅ Use **Unity Editor** (not Unity Hub)
2. ✅ Open project via Unity Hub
3. ✅ Configure build settings in Unity Editor
4. ✅ Click **Build** or **Build and Run**
5. ✅ Install APK/IPA on device

**Unity Hub** = Project management  
**Unity Editor** = Development and building

---

**Last Updated**: [Current Date]  
**Unity Version**: 2022.3 LTS

