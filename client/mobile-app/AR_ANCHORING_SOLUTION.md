# AR Anchoring Solution - ViroReact

## Problem
Manual AR anchoring implementation using device motion sensors is not working correctly. The model doesn't stay fixed in world space when the device moves.

## Solution: ViroReact

**ViroReact** is a comprehensive AR/VR library for React Native that provides proper AR anchoring out of the box, similar to ARKit/ARCore.

### Why ViroReact?
- ✅ **Built-in AR anchoring** - No manual device motion calculations needed
- ✅ **Works with Expo SDK 54** - Compatible with your current setup
- ✅ **Cross-platform** - iOS (ARKit) and Android (ARCore)
- ✅ **Proper plane detection** - Detects surfaces and anchors objects
- ✅ **Active maintenance** - Regularly updated

### Installation

```bash
cd client/mobile-app
npm install --save @reactvision/react-viro
```

### Configuration

1. **Update `app.json`**:
```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "@reactvision/react-viro",
      [
        "expo-sensors",
        {
          "motionPermission": "..."
        }
      ]
    ]
  }
}
```

2. **Generate native code**:
```bash
npx expo prebuild
```

3. **Rebuild app** (requires development build, not Expo Go):
```bash
npx expo run:ios
# or
npx expo run:android
```

### Usage Example

```tsx
import React from 'react';
import { ViroARScene, ViroARPlaneSelector, Viro3DObject } from '@reactvision/react-viro';

const ARModelViewer = ({ modelUrl }) => {
  return (
    <ViroARScene>
      <ViroARPlaneSelector>
        <Viro3DObject
          source={{ uri: modelUrl }}
          position={[0, 0, -1]} // 1 meter in front
          scale={[0.1, 0.1, 0.1]}
          type="GLB"
          dragType="FixedToWorld"
          onDrag={() => {}}
        />
      </ViroARPlaneSelector>
    </ViroARScene>
  );
};
```

### Key Features

- **ViroARScene**: Main AR scene container
- **ViroARPlaneSelector**: Detects flat surfaces and allows object placement
- **Viro3DObject**: Renders 3D models (GLB/GLTF/OBJ)
- **Built-in anchoring**: Objects stay fixed in world space automatically
- **Drag support**: `dragType="FixedToWorld"` keeps object anchored while dragging

### Migration from Current Implementation

1. Replace `Model3DViewer` AR mode with ViroReact components
2. Remove manual device motion tracking code
3. Use ViroReact's built-in anchoring
4. Keep VR mode (3D viewer) as-is for non-AR viewing

### Alternative: Keep Manual Implementation

If you prefer to continue with manual implementation:
- Fix axis mapping between device motion and Three.js camera
- Use quaternions instead of Euler angles
- Properly handle coordinate system transformations
- Test extensively on real devices

### Resources

- [ViroReact Documentation](https://viro-community.readme.io/)
- [ViroReact Expo Integration](https://viro-community.readme.io/docs/integrating-with-expo)
- [ViroReact AR Examples](https://viro-community.readme.io/docs/ar-examples)
