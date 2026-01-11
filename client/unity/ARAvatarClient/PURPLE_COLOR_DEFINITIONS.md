# Purple Color Definitions - Location Reference

## 🎨 Where Purple Colors Are Defined

### 1. Debug Sphere - Initial Purple Color

**File:** `AvatarLoader.cs`  
**Lines:** 426, 440, 446

#### Line 426 - Sphere Material Color
```csharp
// Set initial color to purple for initialization state
sphereMaterial.color = new Color(0.5f, 0f, 0.5f);
```
**Location:** Inside `LoadGLBModel()` method, when creating the debug sphere material  
**Purpose:** Sets the debug sphere to purple during initialization phase  
**RGB:** (0.5, 0, 0.5) = Purple/Magenta

#### Line 440 - Fallback Color (if shader not found)
```csharp
renderer.material.color = new Color(0.5f, 0f, 0.5f);
```
**Location:** Fallback when `safeShader` is null  
**Purpose:** Sets purple color on default material if URP shader lookup fails

#### Line 446 - UpdateDebugState Call
```csharp
UpdateDebugState(new Color(0.5f, 0f, 0.5f), 0.5f, "Initializing (Purple)...");
```
**Location:** After creating debug sphere  
**Purpose:** Updates debug sphere color and scale to indicate initialization state

### 2. UpdateDebugState Method

**File:** `AvatarLoader.cs`  
**Line:** 1002-1016

```csharp
private void UpdateDebugState(Color color, float scale, string msg = null)
{
    if (msg != null) debugMessage = $"Status: {msg}\nColor: {color}\nScale: {scale}";
    
    if (debugSphere != null)
    {
        var renderer = debugSphere.GetComponent<Renderer>();
        if (renderer != null)
        {
            renderer.material.color = color;  // ← Sets the color here
        }
        debugSphere.transform.localScale = new Vector3(scale, scale, scale);
        Debug.Log($"⚠️ [AvatarLoader] Debug State: Color={color}, Scale={scale}");
    }
}
```

**Purpose:** This method is called throughout the loading process to change the debug sphere color:
- **Purple (0.5f, 0f, 0.5f)**: Initialization
- **Blue**: Downloading
- **Cyan**: Parsing
- **Yellow**: Instantiating
- **Green**: Success
- **Red**: Error
- **Magenta**: Empty (no renderers)

### 3. Avatar Purple Color (Error Material)

**File:** `AvatarLoader.cs`  
**Lines:** 570-591

The avatar appears purple when:
1. **Shader is null or invalid** (line 571):
   ```csharp
   if (currentShader == null || shaderName.Contains("Hidden/InternalErrorShader"))
   ```
   Unity automatically uses a purple error material when shader is invalid.

2. **Unity's Built-in Error Material**:
   - Unity displays purple/magenta when a material cannot be rendered
   - This is Unity's default error material color
   - Not explicitly defined in code - it's Unity's internal error indicator

### 4. Other Color Definitions in AvatarLoader

**File:** `AvatarLoader.cs`

#### Debug GUI Text Color (Line 53)
```csharp
debugStyle.normal.textColor = Color.red;
```
**Purpose:** Red text for debug messages on screen

#### State Colors (Various lines):
- **Line 459**: `Color.blue` - Downloading
- **Line 471**: `Color.red` - Network Error
- **Line 482**: `Color.red` - Data Empty
- **Line 487**: `Color.cyan` - Parsing
- **Line 515**: `Color.red` - Parse Failed
- **Line 520**: `Color.yellow` - Instantiating
- **Line 772**: `Color.green` - Success
- **Line 777**: `Color.magenta` - Empty (no renderers)
- **Line 785**: `Color.red` - Instantiate Failed
- **Line 826**: `Color.cyan` - Diagnostic material

## 📍 Summary

### Debug Sphere Purple
- **Defined at:** Lines 426, 440, 446 in `AvatarLoader.cs`
- **Color Value:** `new Color(0.5f, 0f, 0.5f)` = RGB(0.5, 0, 0.5) = Purple/Magenta
- **Purpose:** Visual indicator for initialization state
- **Updated by:** `UpdateDebugState()` method (line 1002)

### Avatar Purple
- **Not explicitly defined** - it's Unity's error material
- **Caused by:** Invalid/null shader (line 571)
- **Unity's Error Material:** Automatically purple when material cannot render
- **Fixed by:** Material shader conversion code (lines 570-700)

## 🔧 How to Change Purple Colors

### To Change Debug Sphere Initial Color:

**File:** `AvatarLoader.cs`, Line 426
```csharp
// Change from:
sphereMaterial.color = new Color(0.5f, 0f, 0.5f);  // Purple

// To any color, e.g.:
sphereMaterial.color = new Color(1f, 0f, 0f);  // Red
sphereMaterial.color = Color.blue;  // Blue
sphereMaterial.color = new Color(0f, 1f, 0f);  // Green
```

**Also update line 446:**
```csharp
UpdateDebugState(new Color(1f, 0f, 0f), 0.5f, "Initializing (Red)...");
```

### To Fix Avatar Purple:

The avatar purple is fixed automatically by the material shader conversion code. If you want to change the default material color when fixing invalid shaders:

**File:** `AvatarLoader.cs`, Line 600-606
```csharp
// Change default color from white:
newMat.SetColor("_BaseColor", Color.white);

// To any color:
newMat.SetColor("_BaseColor", new Color(1f, 1f, 1f, 1f));  // White
newMat.SetColor("_BaseColor", new Color(0.8f, 0.8f, 0.8f, 1f));  // Light gray
```

## 🎯 Key Points

1. **Debug Sphere Purple** is intentionally set to `(0.5f, 0f, 0.5f)` for initialization
2. **Avatar Purple** is Unity's error material (not explicitly set in code)
3. **UpdateDebugState()** method controls all debug sphere color changes
4. **Color definitions** are scattered throughout `LoadGLBModel()` method
5. **No centralized color constants** - colors are hardcoded at each usage point

## 💡 Recommendation

Consider creating color constants at the top of the class:

```csharp
// At top of AvatarLoader class
private static readonly Color INIT_COLOR = new Color(0.5f, 0f, 0.5f);  // Purple
private static readonly Color DOWNLOAD_COLOR = Color.blue;
private static readonly Color PARSE_COLOR = Color.cyan;
private static readonly Color INSTANTIATE_COLOR = Color.yellow;
private static readonly Color SUCCESS_COLOR = Color.green;
private static readonly Color ERROR_COLOR = Color.red;
```

Then use these constants instead of hardcoded values for easier maintenance.

