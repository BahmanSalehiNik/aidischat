# Unity + React Native Integration Guide

## Current Architecture

Your project currently has **two separate applications**:

1. **React Native Mobile App** (`client/mobile-app/`)
   - Built with Expo
   - Uses Three.js/expo-three for 3D model viewing
   - Runs via `npm run android` or `npm run ios`
   - Creates a standalone APK/IPA

2. **Unity AR App** (`client/unity/ARAvatarClient/`)
   - Built with Unity
   - Uses AR Foundation for AR features
   - Built via Unity Editor → Build Settings
   - Creates a **separate** standalone APK/IPA

**Current Status**: These are **two separate apps** that users would need to install independently.

---

## Integration Options

### Option 1: Keep Separate Apps (Current Setup) ✅ Simplest

**How it works:**
- React Native app and Unity app are separate installations
- Users install both apps on their device
- React Native app can launch Unity app via deep linking

**Pros:**
- ✅ Simplest to implement
- ✅ No complex integration needed
- ✅ Each app can be updated independently
- ✅ Smaller individual app sizes

**Cons:**
- ❌ Users need to install two apps
- ❌ Not a seamless experience
- ❌ Context switching between apps

**Build Process:**
```bash
# Build React Native app
cd client/mobile-app
npm run android  # or npm run ios

# Build Unity app separately
# Open Unity Editor → Build Settings → Build APK/IPA
```

---

### Option 2: Embed Unity as Native Module (Recommended for Single Package) 🎯

**How it works:**
- Unity builds as a **library/aar** (Android) or **framework** (iOS)
- React Native app embeds Unity as a native module
- Unity view renders inside React Native screens
- **Single APK/IPA** - one installation

**Pros:**
- ✅ Single app package
- ✅ Seamless user experience
- ✅ Unity view embedded in React Native screens
- ✅ Can communicate between React Native and Unity

**Cons:**
- ❌ More complex setup
- ❌ Requires ejecting from Expo managed workflow (or using bare workflow)
- ❌ Larger app size
- ❌ More complex build process

**Required Libraries:**
- `react-native-unity-view` or `@react-native-unity-view/react-native-unity-view`
- Unity must export as Android Library (AAR) or iOS Framework

**Build Process:**
```bash
# 1. Build Unity as library (not standalone app)
# Unity Editor → Build Settings → Export as Android Library/iOS Framework

# 2. Copy Unity library to React Native project
# Android: android/unityLibrary/
# iOS: ios/UnityFramework.framework

# 3. Build React Native app (includes Unity)
cd client/mobile-app
npm run android  # or npm run ios
```

---

### Option 3: Unity as Standalone, Launch from React Native 🔗

**How it works:**
- React Native app and Unity app remain separate
- React Native app launches Unity app via deep linking/intent
- Unity app receives parameters (agentId, roomId, etc.)
- After Unity session, returns to React Native app

**Pros:**
- ✅ Simpler than full integration
- ✅ Can keep Expo managed workflow
- ✅ Apps can be updated independently
- ✅ Better separation of concerns

**Cons:**
- ❌ Still requires two installations
- ❌ App switching (not seamless)
- ❌ Need to handle deep linking

**Implementation:**
```typescript
// In React Native app
import { Linking } from 'react-native';

const launchUnityAR = (agentId: string) => {
  // Launch Unity app via deep link
  Linking.openURL(`aichatar://ar?agentId=${agentId}`);
};
```

---

## Recommended Approach

### For Development/Testing: **Option 1** (Keep Separate)
- Build Unity app separately in Unity Editor
- Build React Native app separately with `npm run`
- Test each independently
- **Answer to your question**: No, they won't be a single package with this approach

### For Production: **Option 2** (Embed Unity)
- Integrate Unity as native module
- Single APK/IPA installation
- Better user experience

---

## Building for Testing (Current Setup)

### Step 1: Build Unity App

1. Open Unity Editor
2. Open project: `client/unity/ARAvatarClient/`
3. **File > Build Settings**
4. Select **Android** platform
5. Click **Build**
6. Save APK (e.g., `~/Downloads/UnityAR.apk`)
7. Install on device: `adb install ~/Downloads/UnityAR.apk`

### Step 2: Build React Native App

```bash
cd client/mobile-app
npm install
npm run android  # Builds and installs on connected device
```

**Result**: Two separate apps installed on device
- `AI Chat AR` (Unity app)
- `mobile-app` (React Native app)

---

## Building as Single Package (Future Integration)

### Prerequisites

1. **Eject from Expo** (if using managed workflow):
   ```bash
   cd client/mobile-app
   npx expo eject
   ```

2. **Install Unity Native Module**:
   ```bash
   npm install react-native-unity-view
   # or
   npm install @react-native-unity-view/react-native-unity-view
   ```

3. **Build Unity as Library**:
   - Unity Editor → Build Settings
   - **Android**: Export as **Android Library (AAR)**
   - **iOS**: Export as **iOS Framework**
   - Copy to React Native project

4. **Build React Native** (includes Unity):
   ```bash
   npm run android  # Single APK with Unity embedded
   ```

**Result**: Single app package with Unity embedded

---

## Quick Answer to Your Questions

### Q: Is the entire app supposed to be a single package?

**A**: Currently **NO** - you have two separate apps. To make it a single package, you need to integrate Unity as a native module (Option 2).

### Q: Do users need to install Unity app and the entire app separately?

**A**: **YES, currently** - with the current setup, users install:
1. React Native app (via `npm run android`)
2. Unity app (via Unity Editor build)

### Q: Can I build Unity app, save it on PC for testing, and when I do `npm run`, the Android device will see the entire app as a single package?

**A**: **NO, not with current setup**. Here's what happens:

1. **Build Unity separately** → Saves APK on PC → Install manually: `adb install UnityAR.apk`
2. **Run `npm run android`** → Builds React Native app → Installs separately

**Result**: Two separate apps on device.

To get a single package, you need to:
- Integrate Unity as native module (Option 2)
- Build Unity as library (not standalone APK)
- Include Unity library in React Native build
- Then `npm run android` will create a single APK with both

---

## App Store Requirements (Google Play & App Store)

### ⚠️ Critical: Single Package Only

**Both Google Play and Apple App Store require:**
- ✅ **ONE app listing = ONE package**
- ❌ **Cannot have two apps install one after the other**
- ❌ **Cannot have async/parallel installs from one listing**
- ❌ **Cannot require users to install two separate apps**

### For App Store Release

**You MUST use Option 2** (Embed Unity as Native Module):
- Unity builds as AAR (Android) or Framework (iOS)
- React Native app includes Unity library
- **Single APK/IPA** → One-click install from stores
- Users see **one app** in their app drawer/home screen

### What App Stores DON'T Allow

❌ **Two separate apps from one listing** - Not possible
❌ **"Install App A, then install App B"** - Not supported
❌ **Bundled apps that install separately** - Not allowed

**Result**: If you want to publish to app stores, **Unity MUST be integrated as a native module** (Option 2).

---

## Testing Installation (Current Setup)

### Installing Both Apps for Testing

**Location on Android device does NOT matter:**
- ✅ You can save APK in **Downloads** folder
- ✅ You can save APK in **any folder** on device
- ✅ You can transfer APK via USB, email, or cloud storage
- ✅ Installation location doesn't affect app functionality

**Installation Process:**

1. **Build Unity APK:**
   ```bash
   # In Unity Editor → Build Settings → Build
   # Save to: ~/Downloads/UnityAR.apk (or anywhere on PC)
   ```

2. **Transfer to Android device:**
   - **Option A**: USB transfer
     ```bash
     adb push ~/Downloads/UnityAR.apk /sdcard/Download/
     ```
   - **Option B**: Email/Cloud → Download on device
   - **Option C**: Direct install via ADB
     ```bash
     adb install ~/Downloads/UnityAR.apk
     ```

3. **Install on device:**
   - **Via ADB** (from PC): `adb install UnityAR.apk`
   - **Via File Manager** (on device): Tap APK in Downloads → Install
   - **Location doesn't matter** - can be in Downloads, Documents, or any folder

4. **Build React Native app:**
   ```bash
   cd client/mobile-app
   npm run android  # Installs automatically via ADB
   ```

**Result**: Two apps installed on device:
- `AI Chat AR` (Unity app) - from Downloads or wherever you installed it
- `mobile-app` (React Native app) - installed via `npm run`

**Important**: 
- ✅ Both apps will work independently
- ✅ Location of APK file doesn't affect functionality
- ✅ Apps install to system app directories (not user-visible)
- ❌ This setup **won't work for app stores** (requires single package)

---

## Summary: One-Click Install

### For App Stores (Production) ✅

**Requirement**: Single package with Unity embedded
- Unity → Build as AAR/Framework
- React Native → Include Unity library
- Build → Single APK/IPA
- **Result**: ✅ One-click install from Google Play/App Store

### For Testing (Current) ⚠️

**Current Setup**: Two separate apps
- Unity → Build APK → Install manually
- React Native → Build APK → Install via `npm run`
- **Result**: ⚠️ Two separate installs (not suitable for app stores)

**Location on device**: Doesn't matter - you can install from Downloads or any folder

---

## Next Steps

1. **For testing now**: 
   - Build both apps separately
   - Install Unity APK from Downloads (or any location)
   - Install React Native via `npm run android`
   - Location doesn't matter

2. **For app store release**:
   - Integrate Unity as native module (Option 2)
   - Build Unity as AAR/Framework (not standalone APK)
   - Include in React Native build
   - Single APK/IPA for one-click install

---

**Last Updated**: [Current Date]

