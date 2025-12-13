# AR Avatar Viewer Implementation Guide

## Overview

This document outlines how to implement 3D model viewing and AR capabilities in React Native for the avatar system.

## Implementation Options

### Option 1: react-native-3d-model-view (Recommended for Simple GLB Viewing)

**Pros:**
- Simple API
- Good performance
- Supports GLB/GLTF formats
- Works on both iOS and Android

**Cons:**
- Limited customization
- No AR support

**Installation:**
```bash
npm install react-native-3d-model-view
# For iOS
cd ios && pod install
```

**Usage:**
```tsx
import ModelView from 'react-native-3d-model-view';

<ModelView
  model={downloadUrl}
  texture={textureUrl}
  scale={1}
  rotate={true}
  autoPlay={true}
  style={{ flex: 1 }}
/>
```

### Option 2: expo-three + react-three-fiber (Recommended for Advanced 3D)

**Pros:**
- Full Three.js capabilities
- Highly customizable
- Can add animations, lighting, etc.
- Works with Expo

**Cons:**
- More complex setup
- Requires WebGL support
- Larger bundle size

**Installation:**
```bash
npx expo install expo-gl expo-three three
npm install react-three-fiber @react-three/drei
```

**Usage:**
```tsx
import { Canvas } from 'react-three-fiber';
import { useGLTF } from '@react-three/drei';
import { GLView } from 'expo-gl';

function AvatarModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

<GLView style={{ flex: 1 }}>
  <Canvas>
    <ambientLight />
    <pointLight position={[10, 10, 10]} />
    <AvatarModel url={downloadUrl} />
  </Canvas>
</GLView>
```

### Option 3: WebView with Three.js (Fallback)

**Pros:**
- Works everywhere
- Full Three.js features
- Easy to prototype

**Cons:**
- Less performant
- Larger bundle size
- WebView limitations

**Usage:**
```tsx
import { WebView } from 'react-native-webview';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    // Three.js code to load and render GLB model
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas') });
    
    const loader = new THREE.GLTFLoader();
    loader.load('${downloadUrl}', (gltf) => {
      scene.add(gltf.scene);
      // ... setup camera, lighting, etc.
    });
  </script>
</body>
</html>
`;

<WebView source={{ html: htmlContent }} style={{ flex: 1 }} />
```

### Option 4: Native AR (ARKit/ARCore) - For AR Viewing

**Pros:**
- True AR experience
- Best performance
- Native platform features

**Cons:**
- Platform-specific code
- More complex
- Requires device support

**Libraries:**
- **iOS**: `react-native-arkit` or `expo-ar`
- **Android**: `react-native-ar` or `expo-ar`

**Installation:**
```bash
npx expo install expo-gl expo-three
npm install expo-ar
```

**Usage:**
```tsx
import { AR } from 'expo-ar';
import { GLView } from 'expo-gl';

<AR.ARView style={{ flex: 1 }}>
  <GLView>
    {/* Render 3D model in AR space */}
  </GLView>
</AR.ARView>
```

## Recommended Implementation Strategy

### Phase 1: Basic 3D Viewer
1. Use **react-native-3d-model-view** for simple GLB viewing
2. Add to `AvatarViewer.tsx` component
3. Test with generated avatars

### Phase 2: Enhanced 3D Viewer
1. Migrate to **expo-three + react-three-fiber** for better control
2. Add animations, lighting, camera controls
3. Support multiple model formats

### Phase 3: AR Support
1. Add **expo-ar** for AR viewing
2. Implement AR button/switch
3. Place avatar in real-world space

## Example Implementation

See `AvatarViewer.tsx` for the component structure. Replace the placeholder `renderModel()` function with one of the options above.

## Model Format Support

- **GLB** (recommended): Binary GLTF, single file, best performance
- **GLTF**: JSON + separate files, more flexible
- **FBX**: Supported by some libraries
- **OBJ**: Basic format, limited features

## Performance Considerations

1. **Model Size**: Keep models under 10MB for mobile
2. **Polygon Count**: Aim for < 10k polygons for smooth performance
3. **Texture Resolution**: Use 1024x1024 or 2048x2048 max
4. **LOD**: Consider Level-of-Detail for complex models
5. **Caching**: Cache downloaded models locally

## Security

- Use signed URLs for private containers
- Set appropriate expiration times
- Validate model URLs on client side
- Consider CORS settings for CDN

## Testing

1. Test with various model sizes
2. Test on different devices (low-end to high-end)
3. Test network conditions (slow 3G to WiFi)
4. Test AR on supported devices only

