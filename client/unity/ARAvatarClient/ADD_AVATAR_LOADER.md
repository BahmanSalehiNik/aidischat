# How to Add AvatarLoader to Unity Scene

## Quick Setup (Recommended)

### Option 1: Add AvatarLoader as Child of ARChatManager (Easiest)

1. **Open Unity Editor**
2. **Open your scene** (e.g., `Assets/Scenes/SampleScene.unity`)
3. **Find ARChatManager GameObject** in Hierarchy
   - If it doesn't exist, create it:
     - Right-click Hierarchy → Create Empty
     - Name it: `ARChatManager`
     - Add Component → Search "ARChatManager" → Add
4. **Create AvatarLoader as child:**
   - Right-click on `ARChatManager` in Hierarchy
   - Select "Create Empty"
   - Name it: `AvatarLoader`
   - Select the `AvatarLoader` GameObject
   - Inspector → Add Component → Search "AvatarLoader"
   - Add the component
5. **Assign AvatarLoader to ARChatManager:**
   - Select `ARChatManager` GameObject
   - In Inspector, find "ARChat Manager" component
   - Find "Avatar Loader" field (under "References" section)
   - Drag `AvatarLoader` GameObject from Hierarchy into this field
   - OR click the circle icon next to the field and select `AvatarLoader`
6. **Configure AvatarLoader:**
   - Select `AvatarLoader` GameObject
   - In Inspector, find "Avatar Loader" component
   - **Important:** Set "Avatar Parent" field:
     - This is where the 3D model will be placed
     - Options:
       - Leave empty (model will be child of AvatarLoader)
       - OR create an empty GameObject as child of AvatarLoader and assign it
       - OR assign AR Session Origin's transform (for AR placement)
7. **Save scene** (Ctrl+S or Cmd+S)

### Option 2: Add AvatarLoader as Separate GameObject

1. **Open Unity Editor**
2. **Open your scene**
3. **Create AvatarLoader GameObject:**
   - Right-click Hierarchy → Create Empty
   - Name it: `AvatarLoader`
   - Select it
   - Inspector → Add Component → Search "AvatarLoader"
   - Add component
4. **Assign to ARChatManager:**
   - Select `ARChatManager` GameObject
   - In Inspector, find "Avatar Loader" field
   - Drag `AvatarLoader` from Hierarchy into the field
5. **Configure AvatarLoader** (same as Option 1, step 6)
6. **Save scene**

## Automatic Discovery (Fallback)

If you don't assign AvatarLoader manually, the code will try to find it automatically:
- First checks children of ARChatManager
- Then searches entire scene using `FindObjectOfType<AvatarLoader>()`

However, **it's better to assign it manually** for performance and clarity.

## Avatar Parent Setup (Important!)

The `avatarParent` Transform determines where the 3D model appears:

### For AR Placement:
1. Find `AR Session Origin` in Hierarchy
2. Create empty GameObject as child of AR Session Origin
3. Name it: `AvatarSpawnPoint`
4. Position it where you want avatars to appear (e.g., 0, 0, 2 meters in front)
5. Assign this Transform to AvatarLoader's "Avatar Parent" field

### For Fixed Position:
1. Create empty GameObject in scene
2. Position it where you want the model
3. Assign to AvatarLoader's "Avatar Parent" field

### Leave Empty:
- Model will be child of AvatarLoader GameObject
- You can position AvatarLoader GameObject to control model position

## Verification Checklist

After setup, verify:
- [ ] AvatarLoader GameObject exists in scene
- [ ] AvatarLoader component is attached
- [ ] ARChatManager's "Avatar Loader" field is assigned (or will be auto-found)
- [ ] AvatarLoader's "Avatar Parent" is set (optional but recommended)
- [ ] Scene is saved
- [ ] Scene is in Build Settings (File → Build Settings → Scenes In Build)

## Testing

After adding AvatarLoader:
1. Build and install Unity app
2. Launch from React Native
3. Check logs:
   ```bash
   adb logcat | grep -E "AvatarLoader|ARChatManager"
   ```
4. You should see:
   - `✅ [ARChatManager] Model URL set`
   - `📥 [ARChatManager] Loading model immediately via AvatarLoader`
   - `📥 [AvatarLoader] Loading model directly from URL`
   - `✅ [AvatarLoader] Avatar loaded successfully!`

## Troubleshooting

### AvatarLoader not found:
- Check GameObject name is exactly "AvatarLoader"
- Check AvatarLoader component is attached
- Check scene is saved
- Rebuild Unity app

### Model loads but not visible:
- Check AvatarLoader's "Avatar Parent" is assigned
- Check model position (might be at 0,0,0 or far away)
- Check AR Session Origin and AR Camera are set up
- Check model scale (might be too small/large)

### Model doesn't load:
- Check GLTFast package is installed
- Check model URL is valid (check logs)
- Check internet connection (model downloads from Azure)
- Check Unity logs for errors

