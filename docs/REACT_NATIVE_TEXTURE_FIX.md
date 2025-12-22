# React Native Texture Loading Fix

## Problem

React Native doesn't support creating `Blob` objects from `ArrayBuffer`, which Three.js GLTFLoader uses to load embedded textures from GLB files. This causes the error:

```
Error: Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported
TypeError: Cannot set property 'encoding' of null
```

## Root Cause

GLB files embed textures as `ArrayBuffer` data inside the binary file. When GLTFLoader tries to:
1. Extract the ArrayBuffer from the GLB
2. Convert it to a Blob
3. Create a texture from the Blob

Step 2 fails in React Native because `new Blob([arrayBuffer])` is not supported.

## Solution: Extract Textures Server-Side

The best solution is to extract textures from the GLB file on the server and serve them as separate image URLs. This way:
- The GLB file contains only geometry and skeleton
- Textures are served as separate PNG/JPG URLs
- The client can load textures using standard image loading (works in React Native)

## Implementation Steps

### 1. Install gltf-transform (Server-Side)

```bash
npm install @gltf-transform/core @gltf-transform/extensions
```

### 2. Extract Textures from GLB

Create a utility function to extract textures:

```typescript
import { NodeIO } from '@gltf-transform/core';
import { dedup, textureCompress } from '@gltf-transform/functions';

async function extractTexturesFromGLB(glbPath: string): Promise<{
  glbPath: string; // Updated GLB without embedded textures
  textureUrls: string[]; // URLs of extracted textures
}> {
  const io = new NodeIO();
  
  // Read GLB
  const document = await io.read(glbPath);
  
  // Extract textures
  const textures: string[] = [];
  const textureMap = new Map();
  
  document.getRoot().listTextures().forEach((texture, index) => {
    // Get texture image data
    const image = texture.getImage();
    if (image) {
      // Save texture as separate file
      const textureUrl = `textures/texture_${index}.png`;
      // Upload to storage and get URL
      // textures.push(textureUrl);
    }
  });
  
  // Remove embedded textures from GLB (convert to external references)
  // This makes the GLB smaller and compatible with React Native
  
  // Write updated GLB
  await io.write(glbPath, document);
  
  return { glbPath, textureUrls: textures };
}
```

### 3. Update Meshy Provider

After generating the model, extract textures before uploading:

```typescript
// In meshy-provider.ts, after getting the rigged+textured model
const { glbPath, textureUrls } = await extractTexturesFromGLB(modelUrl);
// Upload GLB and textures separately
// Return textureUrls along with modelUrl
```

### 4. Update Client to Load Textures Separately

In Model3DViewer, load textures before loading the GLB:

```typescript
// Load textures first
const textureLoader = new THREE.TextureLoader();
const textures = await Promise.all(
  textureUrls.map(url => textureLoader.loadAsync(url))
);

// Then load GLB (which references textures by name)
const gltf = await loader.loadAsync(modelUrl);

// Apply textures to materials
// ...
```

## Alternative: Use GLTF Format Instead of GLB

GLTF format uses external texture files by default, which works better with React Native:

1. Generate GLTF instead of GLB (or convert GLB to GLTF)
2. Textures are already separate files
3. Client loads GLTF + texture files separately

## Temporary Workaround (Current)

The current code suppresses texture errors, but the model still fails to load completely. The patches added help, but the fundamental issue remains.

## Recommended Next Steps

1. **Short-term**: Use GLTF format with external textures (if Meshy supports it)
2. **Long-term**: Implement server-side texture extraction from GLB files
3. **Alternative**: Use a React Native-compatible 3D loader library

## References

- [gltf-transform](https://gltf-transform.donmccurdy.com/)
- [Three.js GLTFLoader React Native Issues](https://discourse.threejs.org/t/three-gltfloader-couldnt-load-texture/29788)
- [React Native Blob Limitations](https://github.com/facebook/react-native/issues/21209)

