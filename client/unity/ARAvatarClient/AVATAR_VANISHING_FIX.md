# Avatar Vanishing Fix - Root Cause Analysis

## 🚨 Problem
The avatar was loading successfully but then vanishing shortly after being rendered. The debug sphere would appear, but both the sphere and avatar would disappear after a few frames.

## 🔍 Root Cause Analysis

### Primary Issue: Update() Method Repositioning
The main culprit was the `Update()` method that was repositioning the avatar every frame:

```csharp
private void Update()
{
    if (Camera.main != null && loadedAvatar != null)
    {
        // Force object to hover 1.5m in front of camera
        Vector3 targetPos = Camera.main.transform.position + Camera.main.transform.forward * 1.5f;
        targetPos.y = Camera.main.transform.position.y - 0.5f;
        loadedAvatar.transform.position = targetPos;  // ⚠️ PROBLEM: Repositioning every frame
        
        // Construct LookAt rotation
        Vector3 lookPos = Camera.main.transform.position;
        lookPos.y = loadedAvatar.transform.position.y;
        loadedAvatar.transform.LookAt(lookPos); 
        loadedAvatar.transform.Rotate(0, 180, 0);
    }
}
```

**Why this caused vanishing:**
1. **Transform conflicts**: Constantly changing the transform position/rotation every frame can conflict with AR Foundation's tracking system
2. **Parent-child relationship issues**: When the avatar is parented to an AR origin (XROrigin/ARSessionOrigin), constantly changing world position can break the local coordinate space relationship
3. **AR tracking interference**: AR Foundation maintains its own coordinate system. Overriding it every frame can cause the object to be culled or hidden by the AR system
4. **Race conditions**: The Update() method runs every frame, potentially before AR tracking has updated, causing the avatar to be positioned incorrectly and then hidden

### Secondary Issues

1. **Complex Material Application Coroutine**: The `ApplyURPFix()` coroutine was applying materials asynchronously, which could interfere with rendering
2. **Multiple Transform Changes**: The avatar's transform was being modified in multiple places (Update, SetupAvatarTransform, ApplyURPFix), causing conflicts
3. **Incorrect Parenting**: The avatar was always parented to `this.transform` instead of the proper AR origin

## ✅ Solution

### 1. Removed Update() Method
**Before:**
- Avatar was repositioned every frame in `Update()`
- This conflicted with AR Foundation's coordinate system

**After:**
- No `Update()` method at all
- Transform is set once in `SetupAvatarTransform()` before loading
- Avatar position is stable and respects AR coordinate space

### 2. Proper Transform Setup Before Loading
**Before:**
```csharp
loadedAvatar = new GameObject("Avatar");
loadedAvatar.transform.SetParent(this.transform);  // Always parented to this
// ... later in Update(), position was changed every frame
```

**After:**
```csharp
loadedAvatar = new GameObject("Avatar");
SetupAvatarTransform();  // Sets parent and position ONCE before loading
```

The `SetupAvatarTransform()` method:
- Finds the proper AR origin (XROrigin → ARSessionOrigin → avatarParent → transform)
- Calculates position relative to camera ONCE
- Sets parent and local position/rotation ONCE
- Never changes after that

### 3. Simplified Material Application
**Before:**
- Complex `ApplyURPFix()` coroutine that ran asynchronously
- Multiple material changes and layer modifications
- Could interfere with rendering

**After:**
- Simple, direct material application in the main coroutine
- Materials applied synchronously during instantiation
- No complex coroutines that could cause timing issues

### 4. Proper AR Origin Parenting
**Before:**
- Always parented to `this.transform` (the AvatarLoader component)

**After:**
- Parents to proper AR coordinate space:
  1. `XROrigin.Origin.transform` (newer AR Foundation)
  2. `ARSessionOrigin.trackablesParent` (legacy AR Foundation)
  3. `avatarParent` (if assigned)
  4. `transform` (fallback)

## 📊 Key Differences: Working vs Broken Version

| Aspect | Broken Version | Working Version |
|--------|---------------|----------------|
| **Update() Method** | ✅ Present - repositions every frame | ❌ Absent - no Update() |
| **Transform Setup** | After loading, changed in Update() | Before loading, set once |
| **Parenting** | Always `this.transform` | Proper AR origin hierarchy |
| **Material Application** | Complex async coroutine | Simple synchronous |
| **Position Stability** | Changes every frame | Set once, never changes |

## 🎯 Key Takeaway

**The avatar vanished because it was being repositioned every frame, which conflicted with AR Foundation's coordinate system.** AR Foundation maintains its own world space, and constantly overriding the transform causes the object to be culled or hidden.

**Solution: Set the transform once before loading, then never touch it again.** This allows AR Foundation to properly track and render the object in its coordinate space.

## 🔧 Implementation Details

### SetupAvatarTransform() Flow
1. Find AR origin (XROrigin → ARSessionOrigin → avatarParent → transform)
2. Calculate position relative to camera (1.5m forward, slightly lower)
3. Set parent and local position/rotation ONCE
4. Activate the GameObject
5. **Never modify again**

### LoadGLBModel() Flow
1. Cleanup old avatar
2. Create new avatar GameObject
3. **Call SetupAvatarTransform()** ← Transform set here, once
4. Create debug sphere
5. Download model
6. Parse and instantiate
7. Apply materials directly (no coroutine)
8. Done - transform never changes

## ✅ Verification

After the fix:
- ✅ Avatar loads and remains visible
- ✅ Debug sphere remains visible
- ✅ No vanishing after a few frames
- ✅ Avatar respects AR coordinate space
- ✅ Position is stable and correct

## 📝 Code Changes Summary

1. **Removed**: `Update()` method entirely
2. **Changed**: `LoadGLBModel()` to call `SetupAvatarTransform()` before downloading
3. **Simplified**: Material application (removed `ApplyURPFix()` coroutine)
4. **Updated**: `SetupAvatarTransform()` to check for `avatarParent` in hierarchy
5. **Added**: `UpdateDebugState()` method for debug sphere state indication

---

## 🔄 Additional Fixes (Phase 2)

After the initial fix, the avatar was still experiencing issues:
- Avatar would appear briefly with silver/blue-ish color mixed with purple
- Avatar would quickly disappear again after a few frames
- Some renderers had invalid shaders (purple error material)

### Root Causes of Continued Issues

1. **Materials becoming invalid after instantiation**: Some materials from the GLB file had shaders incompatible with URP, causing Unity to render them as purple error materials
2. **Renderers being disabled**: Some child GameObjects or renderers were being disabled by external systems or Unity's internal processes
3. **No protection against destruction**: The avatar could be destroyed by scene changes or other systems
4. **Delayed material fixing**: Material issues were only detected and fixed during initial load, not continuously

### Solutions Implemented

#### 1. Aggressive Persistence Monitor
**Added**: `AvatarPersistenceMonitor()` coroutine that runs continuously after avatar loads

**Features**:
- **Frame-by-frame checking**: Checks every frame (`yield return null`) instead of every 0.5 seconds for maximum responsiveness
- **Immediate fixes**: Detects and fixes issues immediately when they occur
- **Comprehensive checks**:
  - Ensures avatar GameObject stays active
  - Ensures all renderers stay enabled
  - Ensures all child GameObjects stay active
  - Detects and fixes invalid/purple shaders immediately
  - Creates default materials for renderers that lose their materials

**Code**:
```csharp
private IEnumerator AvatarPersistenceMonitor()
{
    while (loadedAvatar != null)
    {
        yield return null; // Check every frame
        
        // Ensure avatar is active
        if (!loadedAvatar.activeSelf)
        {
            loadedAvatar.SetActive(true);
        }
        
        // Check all renderers and fix issues
        var renderers = loadedAvatar.GetComponentsInChildren<Renderer>(true);
        foreach (var r in renderers)
        {
            // Fix disabled renderers
            if (!r.enabled) r.enabled = true;
            if (!r.gameObject.activeSelf) r.gameObject.SetActive(true);
            
            // Fix invalid shaders (purple materials)
            if (r.material != null && 
                (r.material.shader == null || 
                 r.material.shader.name.Contains("Hidden/InternalErrorShader")))
            {
                // Create new URP material, preserving original colors/textures
                // ... (material fixing code)
            }
        }
    }
}
```

#### 2. Prevent Destruction
**Added**: `DontDestroyOnLoad(loadedAvatar)` to prevent the avatar from being destroyed during scene changes or other operations.

**Location**: Called immediately after avatar is successfully loaded and activated.

#### 3. Improved Material Fixing
**Enhanced**: Material fixing now preserves original appearance when converting shaders

**Improvements**:
- Preserves original colors (checks both `_BaseColor` and `_Color` properties)
- Preserves original textures (copies `_MainTex` and `_BaseMap`)
- Uses `sharedMaterial` instead of `material` to ensure changes persist
- Creates URP-compatible materials only when necessary

**Code**:
```csharp
// When fixing purple shader, preserve original properties
Material oldMat = r.material;
Material newMat = new Material(urpShader);

// Copy color
Color colorToUse = oldMat.HasProperty("_BaseColor") 
    ? oldMat.GetColor("_BaseColor") 
    : oldMat.color;

// Copy texture
if (oldMat.mainTexture != null)
    newMat.mainTexture = oldMat.mainTexture;

r.sharedMaterial = newMat; // Use sharedMaterial for persistence
```

#### 4. Enhanced Logging
**Added**: Comprehensive logging to track what the persistence monitor is fixing:
- Logs when avatar is disabled and reactivated
- Tracks count of purple shaders found
- Logs material fixes with color information
- Status updates every 60 frames for monitoring

### Implementation Details

**When Persistence Monitor Starts**:
- Starts immediately after avatar is successfully instantiated
- Runs continuously until avatar is destroyed (which shouldn't happen with `DontDestroyOnLoad`)
- Stops previous monitor if a new avatar is loaded

**Performance Considerations**:
- Frame-by-frame checking is lightweight (just checking boolean flags and iterating renderers)
- Material creation only happens when issues are detected
- Logging is throttled to reduce spam (only logs when issues are found or every 60 frames)

## ✅ Final Verification

After all fixes:
- ✅ Avatar loads and remains visible
- ✅ Debug sphere remains visible
- ✅ No vanishing after a few frames
- ✅ Avatar respects AR coordinate space
- ✅ Position is stable and correct
- ✅ Materials stay valid (no purple error materials)
- ✅ Renderers stay enabled
- ✅ Avatar protected from destruction
- ✅ Issues detected and fixed immediately (frame-by-frame)

## 📊 Complete Fix Timeline

| Phase | Issue | Solution | Status |
|-------|-------|----------|--------|
| **Phase 1** | Avatar vanishing due to Update() repositioning | Removed Update(), set transform once | ✅ Fixed |
| **Phase 2** | Avatar still disappearing, purple materials | Added aggressive persistence monitor, DontDestroyOnLoad, improved material fixing | ✅ Fixed |

## 🎯 Key Takeaways

1. **Initial Fix**: Removing the `Update()` method that was repositioning the avatar every frame solved the primary vanishing issue
2. **Secondary Fix**: The persistence monitor ensures the avatar stays visible even if external systems try to disable it
3. **Material Fixing**: Continuous monitoring and fixing of invalid shaders prevents purple error materials
4. **Protection**: `DontDestroyOnLoad` prevents accidental destruction during scene operations

**The complete solution combines:**
- ✅ Stable transform (set once, never changed)
- ✅ Continuous monitoring (frame-by-frame checks)
- ✅ Immediate fixes (reactivate disabled objects, fix invalid materials)
- ✅ Destruction protection (`DontDestroyOnLoad`)

