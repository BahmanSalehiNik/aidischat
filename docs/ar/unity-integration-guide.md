# Unity AR Integration Guide - Step-by-Step Walkthrough

## Overview

This guide provides a complete step-by-step walkthrough for integrating Unity AR Foundation with the AI Chat Distributed backend to display and animate AR avatars in real-time.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Unity Installation](#unity-installation)
3. [Project Setup](#project-setup)
4. [AR Foundation Installation](#ar-foundation-installation)
5. [Required Packages](#required-packages)
6. [Project Configuration](#project-configuration)
7. [Cursor IDE Integration](#cursor-ide-integration)
8. [Backend Integration](#backend-integration)
9. [Core Scripts Implementation](#core-scripts-implementation)
10. [Testing](#testing)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Unity Hub** installed (latest version)
- **Unity 2022.3 LTS** or later (recommended: 2022.3.20f1 or 2023.2.0f1)
- **Visual Studio 2022** or **Visual Studio Code** (for C# development)
- **Android SDK** (for Android builds) - installed via Unity Hub
- **Xcode** (for iOS builds) - macOS only
- **Git** installed
- **Backend API access** - ensure the backend services are running

---

## Unity Installation

### Step 1: Install Unity Hub

1. Download Unity Hub from: https://unity.com/download
2. Install Unity Hub
3. Sign in with your Unity account (create one if needed)

### Step 2: Install Unity Editor

1. Open Unity Hub
2. Go to **Installs** tab
3. Click **Install Editor**
4. Select **Unity 2022.3 LTS** (or latest LTS version)
5. In **Add modules**, select:
   - ✅ **Android Build Support** (Android SDK & NDK, OpenJDK)
   - ✅ **iOS Build Support** (if on macOS)
   - ✅ **Visual Studio Community** (or Visual Studio Code)
6. Click **Install**
7. Wait for installation to complete (~10-15 minutes)

### Step 3: Verify Installation

1. Open Unity Hub
2. Go to **Installs** tab
3. Verify Unity 2022.3 LTS is listed and installed
4. Click **Open** to launch Unity Editor (test launch)

---

## Project Setup

### Step 1: Choose Project Location

**Recommended: Inside `client/` folder**

Create the Unity project at:
```
/home/bahman/projects/aiChatDistributed/client/unity-ar-client/
```

**Why this location?**
- ✅ Keeps all client applications together (`mobile-app/` and `unity-ar-client/`)
- ✅ Maintains project organization
- ✅ Easy to reference backend APIs from the same repo
- ✅ Can share documentation and configs

**Alternative Options:**

1. **Outside the project** (if you prefer complete separation):
   ```
   /home/bahman/projects/unity-ar-client/
   ```
   - ✅ Clean separation, no Unity files in main repo
   - ❌ Loses organizational benefit
   - ❌ Harder to reference backend code

2. **Inside root** (not recommended):
   ```
   /home/bahman/projects/aiChatDistributed/unity-ar-client/
   ```
   - ❌ Clutters root directory
   - ❌ Mixes with backend services

### Step 2: Create New Unity Project OR Move Existing Project

#### Option A: Create New Project

1. Open **Unity Hub**
2. Click **New Project**
3. Select **3D (URP)** template (Universal Render Pipeline recommended)
4. Set **Project name**: `AIChatARClient`
5. Set **Location**: 
   - **Recommended**: `/home/bahman/projects/aiChatDistributed/client/unity-ar-client/`
   - Create the `unity-ar-client` folder first if it doesn't exist
6. Click **Create project**
7. Wait for Unity to initialize the project

#### Option B: Move Existing Unity Project

**Yes, you can safely move/cut-paste a Unity project!** Unity projects are designed to be portable. Here's how to do it safely:

**Step 1: Close Unity Editor**
- Make sure Unity Editor is completely closed (not just the project)
- Check Task Manager/Activity Monitor to ensure no Unity processes are running

**Step 2: Move the Project Folder**
1. **Cut** (or copy) your entire Unity project folder
2. **Paste** it to: `/home/bahman/projects/aiChatDistributed/client/unity-ar-client/`
3. The folder structure should be:
   ```
   client/unity-ar-client/
   ├── Assets/
   ├── Library/
   ├── Packages/
   ├── ProjectSettings/
   ├── Temp/
   └── (other Unity files)
   ```

**Step 3: Update Unity Hub**
1. Open **Unity Hub**
2. The project might still show in the list with the old path (grayed out)
3. Click the **three dots** (⋮) next to the project
4. Select **Remove from list**
5. Click **Open** (or **Add**)
6. Navigate to: `/home/bahman/projects/aiChatDistributed/client/unity-ar-client/`
7. Select the folder and click **Open**
8. Unity Hub will add it to your projects list

**Step 4: Verify Everything Works**
1. Open the project in Unity Editor
2. Check the **Console** for any errors
3. Verify your scenes load correctly
4. Test that scripts compile without errors

**What Will Work Automatically:**
- ✅ All scripts and assets (paths are relative)
- ✅ Project settings (stored in `ProjectSettings/`)
- ✅ Package dependencies (stored in `Packages/`)
- ✅ Scene references (relative paths)
- ✅ Prefab references (relative paths)

**What Might Need Updating:**
- ⚠️ **Build paths** (if you had custom build output locations)
  - Go to **File > Build Settings** and verify build paths
- ⚠️ **External tool references** (if you had absolute paths to external tools)
  - Check **Edit > Preferences > External Tools**
- ⚠️ **Version control** (if using Git)
  - Git will detect the move as deletions + additions
  - You may need to re-add files or use `git mv` if you want to preserve history

**Optional: Regenerate Library Folder (if issues occur)**
If you encounter any issues after moving:

1. **Close Unity Editor**
2. **Delete** the `Library/` folder (it will be regenerated)
3. **Delete** the `Temp/` folder
4. **Open the project** in Unity Editor
5. Unity will regenerate `Library/` (this takes a few minutes)

**Note**: The `Library/` folder can be several GB, so you can delete it to save space. Unity will regenerate it when you open the project, but this takes time.

**Quick Move Checklist:**
- [ ] Unity Editor is closed
- [ ] Project folder moved to new location
- [ ] Unity Hub updated to point to new location
- [ ] Project opens without errors
- [ ] Scenes load correctly
- [ ] Scripts compile successfully
- [ ] Build settings verified (if applicable)

### Step 3: Configure .gitignore for Unity

**Important**: Unity generates large files that should NOT be committed to git.

Add to your root `.gitignore` file (`/home/bahman/projects/aiChatDistributed/.gitignore`):

```gitignore
# Unity generated files (if Unity project is in repo)
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]ser[Ss]ettings/

# Unity meta files (optional - some teams commit these)
# [Aa]ssets/**/*.meta
# [Pp]rojectSettings/

# Unity crash reports
sysinfo.txt
*.crash

# Unity generated project files
*.csproj
*.unityproj
*.sln
*.suo
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Visual Studio / Rider cache
.vs/
.idea/
*.swp
*.swo
*~
```

**Note**: If you want to commit Unity scripts but not generated files, you can commit:
- `Assets/` folder (your scripts)
- `ProjectSettings/` folder (project configuration)
- But exclude `Library/`, `Temp/`, `Build/`, etc.

### Step 2: Configure Project Settings

1. In Unity Editor, go to **Edit > Project Settings**
2. **Player Settings**:
   - **Company Name**: Your company name
   - **Product Name**: AI Chat AR
   - **Version**: 1.0.0
   - **Bundle Identifier**: `com.yourcompany.aichatar` (iOS/Android)

3. **Android Settings** (if building for Android):
   - **Minimum API Level**: Android 7.0 (API level 24) or higher
   - **Target API Level**: Latest
   - **Scripting Backend**: IL2CPP (recommended for production)
   - **Target Architectures**: ARM64 (required for ARCore)

4. **iOS Settings** (if building for iOS):
   - **Target minimum iOS Version**: 11.0 or higher
   - **Scripting Backend**: IL2CPP
   - **Target Device**: iPhone + iPad

5. **XR Plug-in Management**:
   - Note: ARCore and ARKit plugins will be installed in the next section
   - After installation, they will appear in the XR Plug-in Management list
   - No checkboxes needed - they're enabled by default when installed

---

## AR Foundation Installation

### Step 1: Install AR Foundation via Package Manager

1. In Unity Editor, go to **Window > Package Manager**
2. Click **+** button (top-left)
3. Select **Add package by name...**
4. Enter: `com.unity.xr.arfoundation`
5. Click **Add**
6. Wait for installation

### Step 2: Install AR Subsystems

Install the following packages via Package Manager (Add package by name):

1. **ARCore XR Plugin** (for Android):
   ```
   com.unity.xr.arcore
   ```

2. **ARKit XR Plugin** (for iOS):
   ```
   com.unity.xr.arkit
   ```

### Step 3: Verify AR Foundation Installation

1. Go to **Edit > Project Settings > XR Plug-in Management**
2. Verify **ARCore** and **ARKit** are listed in the **Installed Providers** section
3. **Note**: ARCore and ARKit don't have checkboxes - they're automatically enabled when installed
4. For **Android**, ensure **ARCore** appears in the list
5. For **iOS**, ensure **ARKit** appears in the list
6. If you see **Apple ARKit Face Tracking** with a checkbox, that's a separate feature (optional)

---

## Required Packages

Install the following packages via Package Manager:

### How to Add Packages via Git URL

If a package isn't available by name, you can add it via Git URL:

1. Open **Window > Package Manager**
2. Click the **+** button (top-left corner)
3. Select **Add package from git URL...** (NOT "Add package by name...")
4. Enter the Git URL (e.g., `https://github.com/user/repo.git?path=/Package`)
5. Click **Add**
6. Wait for Unity to download and install

**Important Notes:**
- The repository must be publicly accessible
- Unity needs Git installed (usually comes with Unity)
- Internet connection required during installation
- Some packages may require specific Unity versions

---

Now install the following packages:

### 1. Addressables (for model loading)

1. **Window > Package Manager**
2. **Add package by name**: `com.unity.addressables`
3. Click **Add**

### 2. GLTFast (for GLB/GLTF model loading)

**Option A: Install via Package Manager (Recommended)**

1. **Window > Package Manager**
2. Click **+** button (top-left)
3. Select **Add package by name...**
4. Enter: `com.unity.cloud.gltfast`
5. Click **Add**

**Option B: Install via Git URL**

1. **Window > Package Manager**
2. Click **+** button (top-left)
3. Select **Add package from git URL...**
4. Enter the Git URL:
   ```
   https://github.com/atteneder/glTFast.git?path=/Unity/Package
   ```
5. Click **Add**
6. Wait for Unity to download and install the package

**Note**: If the package name method doesn't work, use the Git URL method instead.

### 3. WebSocket Client (for real-time messaging)

**Option A: Use Unity's Built-in WebSocket (Recommended for Unity 2021.2+)**

Unity 2021.2+ includes `System.Net.WebSockets` which is sufficient for most use cases. No additional package needed.

**Option B: Install WebSocketSharp via Git URL (If you need WebSocketSharp specifically)**

1. In Unity Editor, go to **Window > Package Manager**
2. Click **+** button (top-left)
3. Select **Add package from git URL...**
4. Enter the Git URL:
   ```
   https://github.com/sta/websocket-sharp.git?path=websocket-sharp
   ```
5. Click **Add**
6. Wait for Unity to download and install the package

**Note**: The Git URL method requires:
- The repository to be publicly accessible
- Unity to have Git installed (usually comes with Unity)
- Internet connection during installation

**Option C: Install Newtonsoft JSON (for JSON parsing)**

If you need better JSON handling than Unity's built-in JsonUtility:
1. **Window > Package Manager**
2. **Add package by name**: `com.unity.nuget.newtonsoft-json`
3. Click **Add**

### 4. JSON Serialization

Unity's built-in `JsonUtility` or install:
```
com.unity.nuget.newtonsoft-json
```

### 5. Audio System (for TTS playback)

Unity's built-in **AudioSource** component (no additional package needed)

---

## Project Configuration

### Step 1: Create Folder Structure

Create the following folder structure in your Unity project:

```
Assets/
├── Scripts/
│   ├── AR/
│   │   ├── AvatarLoader.cs
│   │   ├── AvatarAnimator.cs
│   │   ├── LipSyncController.cs
│   │   ├── EmotionController.cs
│   │   ├── GestureController.cs
│   │   ├── ARPlacementController.cs
│   │   ├── MessageSubscriber.cs
│   │   └── AnimationBlender.cs
│   ├── API/
│   │   ├── AvatarAPI.cs
│   │   ├── TTSAPI.cs
│   │   └── WebSocketClient.cs
│   ├── Models/
│   │   ├── AvatarStatus.cs
│   │   ├── TTSResponse.cs
│   │   └── WebSocketMessage.cs
│   └── Utils/
│       ├── AddressableLoader.cs
│       └── GLTFLoader.cs
├── Scenes/
│   └── ARChatScene.unity
├── Prefabs/
│   └── ARSessionOrigin.prefab
└── Resources/
    └── Config.json
```

### Step 2: Configure AR Session

1. In your scene, create an empty GameObject named **ARSessionOrigin**
2. Add **AR Session Origin** component (Add Component > XR > AR Session Origin)
3. Add **AR Plane Manager** component
4. Add **AR Raycast Manager** component
5. Add **AR Anchor Manager** component (optional)

6. Create another empty GameObject named **ARSession**
7. Add **AR Session** component (Add Component > XR > AR Session)

### Step 3: Create AR Camera Setup

1. Select **Main Camera** in the scene
2. Set **Clear Flags** to **Solid Color**
3. Set **Background** to **Black**
4. Add **ARCameraManager** component (Add Component > XR > AR Camera Manager)
5. Add **ARCameraBackground** component (Add Component > XR > AR Camera Background)

### Step 4: Configure Addressables

1. Go to **Window > Asset Management > Addressables > Groups**
2. Click **Create Addressables Settings** (if first time)
3. Create a new group: **AvatarModels**
4. Set **Build & Load Paths**:
   - **Build**: Remote
   - **Load**: Remote

---

## Cursor IDE Integration

This section explains how to integrate Cursor (AI-powered code editor) with your Unity project for efficient C# script development.

### Step 1: Open Unity Project in Cursor

**If Unity project is in `client/unity-ar-client/`:**

1. **Open Cursor**
2. **File > Open Folder** (or `Ctrl+K Ctrl+O` / `Cmd+K Cmd+O`)
3. **Navigate to**: `/home/bahman/projects/aiChatDistributed/client/unity-ar-client/`
4. Click **Select Folder**

**Alternative: Open entire project for cross-referencing**

If you want Cursor to understand both Unity code AND backend APIs:

1. **File > Open Folder**
2. **Navigate to**: `/home/bahman/projects/aiChatDistributed/` (root folder)
3. This allows Cursor to:
   - Read backend API code for accurate integration
   - Reference shared types/interfaces
   - Understand the full system architecture
4. Navigate to Unity scripts: `client/unity-ar-client/Assets/Scripts/`

**Important**: 
- If opening root folder, make sure `.cursorignore` excludes Unity's `Library/`, `Temp/`, etc.
- If opening Unity folder only, you'll need to manually reference backend API contracts

### Step 2: Configure .cursorignore File

Create a `.cursorignore` file to exclude Unity-specific files from Cursor's AI context. This improves performance and prevents irrelevant files from being indexed.

**If Unity project is in `client/unity-ar-client/`:**

Create `.cursorignore` in the Unity project root (`client/unity-ar-client/.cursorignore`):

```
# Unity generated files
Library/
Temp/
Obj/
Build/
Builds/
*.csproj
*.sln
*.suo
*.user
*.userosscache
*.sln.docstates

# Unity logs
*.log
*.tmp

# OS files
.DS_Store
Thumbs.db

# Visual Studio / Rider
.vs/
.idea/
*.swp
*.swo
*~

# Unity packages (optional - include if you want to exclude package code)
# Packages/
```

**If opening entire project root in Cursor:**

Create `.cursorignore` in the project root (`/home/bahman/projects/aiChatDistributed/.cursorignore`):

```
# Unity generated files
client/unity-ar-client/Library/
client/unity-ar-client/Temp/
client/unity-ar-client/Obj/
client/unity-ar-client/Build/
client/unity-ar-client/Builds/
client/unity-ar-client/*.csproj
client/unity-ar-client/*.sln

# Node modules (already in .gitignore but good to exclude from AI context)
**/node_modules/

# Build outputs
**/build/
**/dist/

# Unity logs
*.log
*.tmp

# OS files
.DS_Store
Thumbs.db
```

**Note**: 
- You may want to keep `Packages/` in context if you need Cursor to understand Unity package APIs
- Excluding `Library/` and `Temp/` is essential - these can be several GB

### Step 3: Configure C# Language Support

Cursor should automatically detect C# files, but you can enhance the experience:

1. **Install C# Extension** (if not already installed):
   - Cursor uses VS Code extensions
   - Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
   - Search for "C#" and install **C#** by Microsoft
   - Also install **C# Dev Kit** for better IntelliSense

2. **Configure OmniSharp** (C# language server):
   - Cursor should auto-detect Unity projects
   - If IntelliSense doesn't work, check `.vscode/settings.json`:
   ```json
   {
     "omnisharp.useModernNet": true,
     "omnisharp.enableRoslynAnalyzers": true,
     "files.exclude": {
       "**/.git": true,
       "**/Library": true,
       "**/Temp": true
     }
   }
   ```

### Step 4: Using Cursor AI with Unity C# Scripts

#### Creating New C# Scripts

**Method 1: Using Cursor Chat**

1. In Cursor, press `Ctrl+L` (or `Cmd+L`) to open Chat
2. Type a prompt like:
   ```
   Create a Unity C# script called AvatarLoader.cs in Assets/Scripts/AR/ that:
   - Loads GLB models from a URL
   - Uses GLTFast package
   - Has a coroutine for async loading
   - Includes error handling
   ```
3. Cursor will generate the script with proper Unity syntax

**Method 2: Using Composer (Multi-file editing)**

1. Press `Ctrl+I` (or `Cmd+I`) to open Composer
2. Describe what you want to create:
   ```
   Create a complete Unity AR avatar system with:
   - AvatarLoader.cs for loading models
   - ARPlacementController.cs for placing avatars in AR space
   - LipSyncController.cs for viseme-based lip sync
   ```
3. Cursor will create multiple files with proper Unity patterns

**Method 3: Inline Code Generation**

1. Open an existing `.cs` file or create a new one
2. Type a comment describing what you need:
   ```csharp
   // TODO: Add method to load avatar from CDN using UnityWebRequest
   ```
3. Place cursor after the comment and press `Ctrl+K` (or `Cmd+K`)
4. Cursor will generate the code inline

#### Best Practices for Unity + Cursor

1. **Use Unity-specific context in prompts**:
   ```
   Create a MonoBehaviour script that uses AR Foundation's ARRaycastManager 
   to place objects when user taps the screen
   ```

2. **Reference Unity APIs explicitly**:
   ```
   Use UnityEngine.XR.ARFoundation.ARRaycastManager and 
   UnityEngine.XR.ARSubsystems.TrackableType for AR raycasting
   ```

3. **Include namespace requirements**:
   ```
   Create a script with these namespaces:
   - using UnityEngine;
   - using UnityEngine.XR.ARFoundation;
   - using System.Collections;
   ```

4. **Ask for Unity patterns**:
   ```
   Create a singleton MonoBehaviour manager class following Unity best practices
   ```

### Step 5: Unity-Specific Cursor Tips

#### Generating Unity Components

**Example Prompt:**
```
Create a Unity MonoBehaviour script called AvatarAnimator.cs that:
- Inherits from MonoBehaviour
- Has public fields for Animator component
- Includes methods for playing idle, talking, and gesture animations
- Uses Unity's Animator.SetTrigger() for state transitions
- Includes proper null checks
```

#### Working with Coroutines

**Example Prompt:**
```
Create a coroutine method that:
- Downloads a file using UnityWebRequest
- Shows progress (0-1 float)
- Calls a callback when complete
- Handles errors properly
```

#### AR Foundation Integration

**Example Prompt:**
```
Create an AR placement script using AR Foundation that:
- Uses ARRaycastManager to detect planes
- Places a GameObject at tap position
- Only places on horizontal planes
- Includes visual feedback
```

### Step 6: Sync with Unity Editor

**Important**: When you create or modify C# files in Cursor:

1. **Save the file** (`Ctrl+S` / `Cmd+S`)
2. **Switch back to Unity Editor**
3. Unity will automatically:
   - Detect the new/modified script
   - Recompile scripts
   - Show any errors in the Console

**If Unity doesn't detect changes:**
- Go to **Assets > Refresh** (or `Ctrl+R` / `Cmd+R`)
- Or click the refresh button in the Project window

### Step 7: Using Cursor for Debugging

1. **Set breakpoints** in Cursor (click left margin or `F9`)
2. **Attach debugger**:
   - In Unity: **Edit > Preferences > External Tools**
   - Set **External Script Editor** to Cursor's executable path
   - Or use Visual Studio / Rider for debugging (Cursor is better for AI-assisted coding)

3. **Use Cursor Chat for debugging help**:
   ```
   This Unity script is getting a NullReferenceException on line 45. 
   Help me debug it. The error happens when trying to access the 
   ARSessionOrigin component.
   ```

### Step 8: Project-Specific Context

To help Cursor understand your project better:

1. **Create a `.cursorrules` file** in the Unity project root:
   ```
   # Unity C# Development Rules
   
   - Always use MonoBehaviour for Unity scripts
   - Use [SerializeField] for private fields that need to be visible in Inspector
   - Use [Header("Section Name")] for organizing Inspector fields
   - Always include proper namespaces (UnityEngine, System.Collections, etc.)
   - Use coroutines (IEnumerator) for async operations
   - Follow Unity naming conventions (PascalCase for public, camelCase for private)
   - Include null checks before accessing Unity components
   - Use GetComponent<>() with null checks
   - Prefer UnityWebRequest over WWW (deprecated)
   - Use ScriptableObject for data containers
   ```

2. **Reference your backend API**:
   - Cursor can read your backend code to understand API contracts
   - Mention API endpoints in prompts:
     ```
     Create a Unity script that calls GET /api/avatars/{agentId}/status 
     matching the backend API in the aiChatDistributed project
     ```

### Step 9: Quick Reference - Cursor Shortcuts for Unity

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open Chat | `Ctrl+L` | `Cmd+L` |
| Open Composer | `Ctrl+I` | `Cmd+I` |
| Inline Generate | `Ctrl+K` | `Cmd+K` |
| Accept Suggestion | `Tab` | `Tab` |
| Open Folder | `Ctrl+K Ctrl+O` | `Cmd+K Cmd+O` |

### Troubleshooting Cursor + Unity

**Issue**: Cursor doesn't recognize Unity APIs
- **Solution**: Install C# extension and ensure OmniSharp is running (check bottom-right status bar)

**Issue**: IntelliSense not working
- **Solution**: 
  1. Check that `.csproj` files exist (Unity generates them)
  2. Restart OmniSharp: `Ctrl+Shift+P` → "OmniSharp: Restart OmniSharp"
  3. Check Unity Console for compilation errors

**Issue**: Cursor suggests non-Unity code
- **Solution**: 
  1. Add Unity context to your prompts
  2. Reference `MonoBehaviour`, `GameObject`, etc. explicitly
  3. Use `.cursorrules` file for project-specific guidance

**Issue**: Files created in Cursor don't appear in Unity
- **Solution**: 
  1. Ensure files are saved
  2. Refresh Unity: `Assets > Refresh` or `Ctrl+R`
  3. Check that files are in `Assets/` folder (not outside)

---

## Backend Integration

### Step 1: Create Configuration File

Create `Assets/Resources/Config.json`:

```json
{
  "apiBaseUrl": "http://localhost:3000/api",
  "wsUrl": "ws://localhost:3000/api/realtime",
  "avatarServiceUrl": "http://localhost:3000/api/avatars",
  "ttsServiceUrl": "http://localhost:3000/api/tts",
  "pollInterval": 2.0,
  "modelCacheEnabled": true
}
```

### Step 2: Create API Models

**Assets/Scripts/Models/AvatarStatus.cs**:

```csharp
using System;

[Serializable]
public class AvatarStatus
{
    public string status; // "generating" | "ready" | "failed" | "pending"
    public int progress; // 0-100
    public int estimatedTimeRemaining; // seconds
    public string modelUrl; // only when ready
    public string format; // "glb" | "gltf" | "vrm"
    public string modelType; // "3d" | "2d"
}

[Serializable]
public class AvatarDownloadUrl
{
    public string url;
    public int expiresIn; // seconds
    public string format;
    public string modelType;
}
```

**Assets/Scripts/Models/TTSResponse.cs**:

```csharp
using System;
using System.Collections.Generic;

[Serializable]
public class VisemeFrame
{
    public float time;
    public string shape; // "A" | "E" | "I" | "O" | "U" | "M" | etc.
}

[Serializable]
public class TTSResponse
{
    public string audioUrl;
    public List<VisemeFrame> visemes;
    public string emotion; // "happy" | "sad" | "angry" | "excited" | "neutral"
    public string gesture; // "wave" | "point" | "idle" | "nod"
    public float duration;
}
```

**Assets/Scripts/Models/WebSocketMessage.cs**:

```csharp
using System;

[Serializable]
public class WebSocketMessage
{
    public string type; // "ai.message.created" | "avatar.ready" | etc.
    public string text;
    public string agentId;
    public long timestamp;
}
```

### Step 3: Create API Client

**Assets/Scripts/API/AvatarAPI.cs**:

```csharp
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;

public class AvatarAPI : MonoBehaviour
{
    private string apiBaseUrl;
    
    void Start()
    {
        // Load config from Resources/Config.json
        TextAsset configFile = Resources.Load<TextAsset>("Config");
        var config = JsonUtility.FromJson<Config>(configFile.text);
        apiBaseUrl = config.avatarServiceUrl;
    }
    
    public IEnumerator GetAvatarStatus(string agentId, Action<AvatarStatus> onSuccess, Action<string> onError)
    {
        string url = $"{apiBaseUrl}/{agentId}/status";
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                AvatarStatus status = JsonUtility.FromJson<AvatarStatus>(request.downloadHandler.text);
                onSuccess?.Invoke(status);
            }
            else
            {
                onError?.Invoke(request.error);
            }
        }
    }
    
    public IEnumerator GetDownloadUrl(string agentId, Action<AvatarDownloadUrl> onSuccess, Action<string> onError)
    {
        string url = $"{apiBaseUrl}/{agentId}/download-url?expiresSeconds=900";
        
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                AvatarDownloadUrl downloadUrl = JsonUtility.FromJson<AvatarDownloadUrl>(request.downloadHandler.text);
                onSuccess?.Invoke(downloadUrl);
            }
            else
            {
                onError?.Invoke(request.error);
            }
        }
    }
}

[Serializable]
public class Config
{
    public string apiBaseUrl;
    public string wsUrl;
    public string avatarServiceUrl;
    public string ttsServiceUrl;
    public float pollInterval;
    public bool modelCacheEnabled;
}
```

---

## Core Scripts Implementation

### Step 1: Avatar Loader

**Assets/Scripts/AR/AvatarLoader.cs**:

```csharp
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using GLTFast;

public class AvatarLoader : MonoBehaviour
{
    [Header("References")]
    public ARSessionOrigin arSessionOrigin;
    public Transform avatarParent;
    
    [Header("Configuration")]
    public string agentId;
    
    private AvatarAPI avatarAPI;
    private GameObject loadedAvatar;
    private GLTFast.GltfAsset gltfAsset;
    
    void Start()
    {
        avatarAPI = FindObjectOfType<AvatarAPI>();
        StartCoroutine(LoadAvatarRoutine());
    }
    
    private IEnumerator LoadAvatarRoutine()
    {
        // Poll for avatar status
        bool avatarReady = false;
        string modelUrl = null;
        
        while (!avatarReady)
        {
            yield return StartCoroutine(avatarAPI.GetAvatarStatus(agentId, 
                (status) => {
                    if (status.status == "ready")
                    {
                        avatarReady = true;
                        modelUrl = status.modelUrl;
                    }
                    else if (status.status == "failed")
                    {
                        Debug.LogError($"Avatar generation failed for agent {agentId}");
                    }
                },
                (error) => {
                    Debug.LogError($"Error getting avatar status: {error}");
                }
            ));
            
            if (!avatarReady)
            {
                yield return new WaitForSeconds(2f); // Poll every 2 seconds
            }
        }
        
        // Get download URL
        yield return StartCoroutine(avatarAPI.GetDownloadUrl(agentId,
            (downloadUrl) => {
                StartCoroutine(LoadModelFromUrl(downloadUrl.url));
            },
            (error) => {
                Debug.LogError($"Error getting download URL: {error}");
            }
        ));
    }
    
    private IEnumerator LoadModelFromUrl(string url)
    {
        var gltf = new GLTFast.GltfImport();
        bool success = yield return gltf.Load(url);
        
        if (success)
        {
            loadedAvatar = new GameObject("Avatar");
            loadedAvatar.transform.SetParent(avatarParent);
            
            yield return gltf.InstantiateScene(loadedAvatar.transform);
            
            Debug.Log("Avatar loaded successfully!");
            
            // Initialize animation components
            var animator = loadedAvatar.GetComponentInChildren<AvatarAnimator>();
            if (animator == null)
            {
                animator = loadedAvatar.AddComponent<AvatarAnimator>();
            }
        }
        else
        {
            Debug.LogError("Failed to load GLB model");
        }
    }
}
```

### Step 2: AR Placement Controller

**Assets/Scripts/AR/ARPlacementController.cs**:

```csharp
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

public class ARPlacementController : MonoBehaviour
{
    [Header("References")]
    public ARRaycastManager raycastManager;
    public Camera arCamera;
    public GameObject avatarPrefab; // The loaded avatar
    
    private GameObject placedAvatar;
    
    void Update()
    {
        if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)
        {
            PlaceAvatar(Input.GetTouch(0).position);
        }
        
        // Mouse support for testing in editor
        if (Input.GetMouseButtonDown(0))
        {
            PlaceAvatar(Input.mousePosition);
        }
    }
    
    private void PlaceAvatar(Vector2 screenPosition)
    {
        List<ARRaycastHit> hits = new List<ARRaycastHit>();
        
        if (raycastManager.Raycast(screenPosition, hits, TrackableType.PlaneWithinPolygon))
        {
            Pose hitPose = hits[0].pose;
            
            if (placedAvatar == null)
            {
                placedAvatar = Instantiate(avatarPrefab, hitPose.position, hitPose.rotation);
            }
            else
            {
                placedAvatar.transform.position = hitPose.position;
                placedAvatar.transform.rotation = hitPose.rotation;
            }
        }
    }
}
```

### Step 3: WebSocket Message Subscriber

**Assets/Scripts/AR/MessageSubscriber.cs**:

```csharp
using System;
using System.Collections;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

public class MessageSubscriber : MonoBehaviour
{
    [Header("Configuration")]
    public string wsUrl = "ws://localhost:3000/api/realtime";
    public string roomId;
    public string agentId;
    
    private ClientWebSocket webSocket;
    private CancellationTokenSource cancellationTokenSource;
    private bool isConnected = false;
    
    public event Action<WebSocketMessage> OnMessageReceived;
    
    async void Start()
    {
        await ConnectWebSocket();
    }
    
    private async Task ConnectWebSocket()
    {
        try
        {
            webSocket = new ClientWebSocket();
            cancellationTokenSource = new CancellationTokenSource();
            
            string fullUrl = $"{wsUrl}?roomId={roomId}";
            await webSocket.ConnectAsync(new Uri(fullUrl), cancellationTokenSource.Token);
            
            isConnected = true;
            Debug.Log("WebSocket connected");
            
            // Start receiving messages
            _ = ReceiveMessages();
        }
        catch (Exception e)
        {
            Debug.LogError($"WebSocket connection error: {e.Message}");
        }
    }
    
    private async Task ReceiveMessages()
    {
        var buffer = new byte[1024 * 4];
        
        while (isConnected && webSocket.State == WebSocketState.Open)
        {
            try
            {
                var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationTokenSource.Token);
                
                if (result.MessageType == WebSocketMessageType.Text)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    ProcessMessage(message);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"WebSocket receive error: {e.Message}");
                break;
            }
        }
    }
    
    private void ProcessMessage(string jsonMessage)
    {
        try
        {
            WebSocketMessage message = JsonUtility.FromJson<WebSocketMessage>(jsonMessage);
            
            // Filter for agent-specific messages
            if (message.type == "ai.message.created" && message.agentId == agentId)
            {
                OnMessageReceived?.Invoke(message);
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"Error parsing message: {e.Message}");
        }
    }
    
    async void OnDestroy()
    {
        isConnected = false;
        cancellationTokenSource?.Cancel();
        
        if (webSocket != null && webSocket.State == WebSocketState.Open)
        {
            await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
        }
        
        webSocket?.Dispose();
        cancellationTokenSource?.Dispose();
    }
}
```

### Step 4: Lip Sync Controller

**Assets/Scripts/AR/LipSyncController.cs**:

```csharp
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class LipSyncController : MonoBehaviour
{
    [Header("Blendshape Mapping")]
    public SkinnedMeshRenderer faceMeshRenderer;
    
    private Dictionary<string, int> visemeToBlendshape = new Dictionary<string, int>();
    private Coroutine lipSyncCoroutine;
    
    void Start()
    {
        // Map viseme shapes to blendshape indices
        // Adjust these based on your model's blendshape names
        visemeToBlendshape["A"] = GetBlendshapeIndex("viseme_aa");
        visemeToBlendshape["E"] = GetBlendshapeIndex("viseme_ee");
        visemeToBlendshape["I"] = GetBlendshapeIndex("viseme_ih");
        visemeToBlendshape["O"] = GetBlendshapeIndex("viseme_oh");
        visemeToBlendshape["U"] = GetBlendshapeIndex("viseme_ou");
        visemeToBlendshape["M"] = GetBlendshapeIndex("viseme_mm");
    }
    
    private int GetBlendshapeIndex(string name)
    {
        if (faceMeshRenderer == null) return -1;
        
        Mesh mesh = faceMeshRenderer.sharedMesh;
        for (int i = 0; i < mesh.blendShapeCount; i++)
        {
            if (mesh.GetBlendShapeName(i).ToLower().Contains(name.ToLower()))
            {
                return i;
            }
        }
        return -1;
    }
    
    public void PlayLipSync(List<VisemeFrame> visemes, float audioDuration)
    {
        if (lipSyncCoroutine != null)
        {
            StopCoroutine(lipSyncCoroutine);
        }
        
        lipSyncCoroutine = StartCoroutine(LipSyncRoutine(visemes, audioDuration));
    }
    
    private IEnumerator LipSyncRoutine(List<VisemeFrame> visemes, float duration)
    {
        float elapsed = 0f;
        int currentIndex = 0;
        
        while (elapsed < duration && currentIndex < visemes.Count)
        {
            // Find next viseme
            while (currentIndex < visemes.Count - 1 && visemes[currentIndex + 1].time <= elapsed)
            {
                currentIndex++;
            }
            
            // Apply current viseme
            if (currentIndex < visemes.Count)
            {
                string shape = visemes[currentIndex].shape;
                if (visemeToBlendshape.ContainsKey(shape))
                {
                    int blendshapeIndex = visemeToBlendshape[shape];
                    if (blendshapeIndex >= 0)
                    {
                        faceMeshRenderer.SetBlendShapeWeight(blendshapeIndex, 100f);
                    }
                }
            }
            
            // Reset other blendshapes (simplified - you may want smoother blending)
            yield return new WaitForSeconds(0.05f);
            elapsed += 0.05f;
        }
        
        // Reset all blendshapes
        ResetBlendshapes();
    }
    
    private void ResetBlendshapes()
    {
        if (faceMeshRenderer == null) return;
        
        Mesh mesh = faceMeshRenderer.sharedMesh;
        for (int i = 0; i < mesh.blendShapeCount; i++)
        {
            faceMeshRenderer.SetBlendShapeWeight(i, 0f);
        }
    }
}
```

---

## Testing

### Step 1: Test AR Session

1. Build and run on a physical device (AR doesn't work in simulators)
2. Verify AR camera view appears
3. Test plane detection (move device around)
4. Test tap-to-place functionality

### Step 2: Test Avatar Loading

1. Ensure backend is running
2. Create an agent via API
3. Wait for avatar generation
4. Verify avatar loads in Unity
5. Check console for any errors

### Step 3: Test WebSocket Connection

1. Join a room via API
2. Send a message to the agent
3. Verify WebSocket receives message in Unity
4. Check console logs

### Step 4: Test TTS and Lip Sync

1. Trigger a message that should generate TTS
2. Verify audio plays
3. Verify lip sync animations trigger
4. Check viseme timing matches audio

---

## Troubleshooting

### AR Not Working

**Problem**: AR camera shows black screen or doesn't initialize

**Solutions**:
- Verify ARCore/ARKit is enabled in Project Settings > XR Plug-in Management
- Check device compatibility (ARCore/ARKit supported devices)
- Ensure camera permissions are granted
- Test on physical device (not simulator)

### Model Not Loading

**Problem**: GLB/GLTF model fails to load

**Solutions**:
- Verify model URL is accessible (check CORS)
- Check model format is GLB or GLTF
- Verify GLTFast package is installed correctly
- Check console for specific error messages
- Test with a known-good model first

### WebSocket Connection Fails

**Problem**: WebSocket can't connect to backend

**Solutions**:
- Verify backend is running and accessible
- Check WebSocket URL in Config.json
- Verify roomId and agentId are correct
- Check firewall/network settings
- Test WebSocket connection with a WebSocket client tool

### Performance Issues

**Problem**: Low FPS or stuttering

**Solutions**:
- Reduce model polygon count
- Enable texture compression
- Use LOD (Level of Detail) system
- Optimize blendshape updates (reduce frequency)
- Profile with Unity Profiler

### Build Issues

**Problem**: Build fails or app crashes

**Solutions**:
- Verify all required packages are installed
- Check Android/iOS build settings
- Verify minimum SDK versions
- Check for missing dependencies
- Review Unity console for build errors

---

## Next Steps

After completing this integration:

1. **Add Animation System**: Implement idle animations, gestures, and emotion-based animations
2. **Optimize Performance**: Implement LOD system, texture compression, and caching
3. **Add Error Handling**: Robust error handling and retry logic
4. **Add UI**: Loading indicators, progress bars, and error messages
5. **Testing**: Comprehensive testing on multiple devices
6. **Production Build**: Configure for production deployment

---

## Additional Resources

- **Unity AR Foundation Documentation**: https://docs.unity3d.com/Packages/com.unity.xr.arfoundation@latest
- **GLTFast Documentation**: https://github.com/atteneder/glTFast
- **Unity Addressables**: https://docs.unity3d.com/Manual/com.unity.addressables.html
- **ARCore Supported Devices**: https://developers.google.com/ar/discover/supported-devices
- **ARKit Requirements**: https://developer.apple.com/documentation/arkit

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Unity console logs
- Check backend API logs
- Consult the main AR design documents in `docs/ar/`

---

**Last Updated**: [Current Date]  
**Unity Version**: 2022.3 LTS  
**AR Foundation Version**: Latest

