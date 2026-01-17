# 3D Model Viewer Crash Troubleshooting Guide

## Overview

When opening the 3D model viewer, the app crashes. This guide helps identify and fix the issue.

## Connection Flow

```
React Native App (AgentDetailScreen)
    ↓
Opens Modal → AvatarViewer Component
    ↓
1. Calls avatarApi.getAvatarStatus(agentId)
    ↓
2. If ready, calls avatarApi.getDownloadUrl(agentId)
    ↓
3. Passes downloadUrl to Model3DViewer
    ↓
4. Model3DViewer loads GLB/GLTF using Three.js
    ↓
5. Renders 3D model using expo-gl + expo-three
```

---

## Common Crash Causes & Solutions

### 1. ❌ Backend API Not Connected

**Symptoms:**
- App crashes immediately when opening viewer
- Error: "Network request failed" or "Failed to check avatar status"
- Console shows API connection errors

**Check:**
```bash
# In React Native app, check console logs
# Look for: "🌐 API Request: GET /api/avatars/{agentId}/status"
```

**Solution:**
1. **Verify backend is running:**
   ```bash
   # Check if backend services are up
   kubectl get pods | grep avatar
   # Or if running locally
   curl http://localhost:3000/api/health
   ```

2. **Check API_BASE_URL in `.env`:**
   ```bash
   cd client/mobile-app
   cat .env
   # Should be: API_BASE_URL=http://your-backend-url/api
   # For local: API_BASE_URL=http://localhost:3000/api
   # For cluster: API_BASE_URL=http://your-ingress-url/api
   ```

3. **Verify network connectivity:**
   - If using physical device, ensure it can reach backend
   - If using emulator, `localhost` should work
   - If using physical device with local backend, use your PC's IP: `http://192.168.x.x:3000/api`

---

### 2. ❌ Avatar Not Ready or Missing

**Symptoms:**
- Viewer opens but shows "Avatar generation failed"
- Status shows "generating" indefinitely
- No model URL available

**Check:**
```bash
# Check avatar status via API
curl http://your-backend/api/avatars/{agentId}/status
```

**Solution:**
1. **Ensure avatar is generated:**
   ```bash
   # Check if avatar exists
   curl http://your-backend/api/avatars/{agentId}
   
   # If not, trigger generation
   curl -X POST http://your-backend/api/avatars/generate \
     -H "Content-Type: application/json" \
     -d '{"agentId": "...", "agentProfile": {...}}'
   ```

2. **Wait for generation to complete:**
   - Avatar generation can take 1-5 minutes
   - Check status endpoint periodically
   - Viewer will poll every 2 seconds automatically

---

### 3. ❌ CORS Issues with Model URL

**Symptoms:**
- App crashes when trying to load model
- Error: "CORS policy" or "Network error"
- Model URL is from Azure Blob Storage

**Check:**
```javascript
// In Model3DViewer.tsx, check the modelUrl
console.log('Model URL:', modelUrl);
// Should be a valid HTTPS URL
```

**Solution:**
1. **Verify Azure CORS settings:**
   - Azure Blob Storage must allow CORS from your app domain
   - Settings → CORS → Add rule:
     - Allowed origins: `*` (or your app domain)
     - Allowed methods: `GET, HEAD`
     - Allowed headers: `*`
     - Max age: `3600`

2. **Use signed URL (recommended):**
   - The app should use `/avatars/{agentId}/download-url` endpoint
   - This returns a signed URL with SAS token
   - Signed URLs typically work without CORS issues

3. **Check if URL is accessible:**
   ```bash
   # Test the model URL
   curl -I "https://your-storage.blob.core.windows.net/avatars/123/model.glb"
   # Should return 200 OK
   ```

---

### 4. ❌ Three.js/GLTFLoader Errors

**Symptoms:**
- App crashes when loading model
- Error: "Failed to load 3D model" or GLTFLoader errors
- Console shows Three.js errors

**Check:**
```javascript
// In Model3DViewer.tsx, line 113
const gltf = await loader.loadAsync(modelUrl);
// This is where it might crash
```

**Solution:**
1. **Verify model format:**
   - Model must be GLB or GLTF format
   - Check file extension: `.glb` or `.gltf`
   - Try opening model in Blender or online GLB viewer

2. **Check model size:**
   - Large models (>50MB) may cause memory issues
   - Optimize model: reduce polygons, compress textures
   - Use GLB format (binary, smaller than GLTF)

3. **Add better error handling:**
   ```typescript
   // In Model3DViewer.tsx, improve error handling
   try {
     const gltf = await loader.loadAsync(modelUrl);
     // ... rest of code
   } catch (err: any) {
     console.error('GLTF Load Error:', err);
     console.error('Model URL:', modelUrl);
     setError(`Failed to load model: ${err.message}`);
     setIsLoading(false);
   }
   ```

---

### 5. ❌ Missing Dependencies

**Symptoms:**
- App crashes on import
- Error: "Cannot find module 'expo-gl'" or similar
- Build fails

**Check:**
```bash
cd client/mobile-app
npm list expo-gl expo-three three
```

**Solution:**
1. **Install missing packages:**
   ```bash
   cd client/mobile-app
   npm install expo-gl expo-three three
   npx expo install expo-gl expo-three
   ```

2. **For iOS (if needed):**
   ```bash
   cd ios
   pod install
   ```

3. **Rebuild app:**
   ```bash
   npm run android  # or npm run ios
   ```

---

### 6. ❌ WebGL/OpenGL ES Not Available

**Symptoms:**
- App crashes when creating GL context
- Error: "WebGL not supported" or "GL context creation failed"
- Only on certain devices/emulators

**Check:**
```javascript
// GLView requires WebGL support
// Some emulators don't support it
```

**Solution:**
1. **Test on physical device:**
   - Emulators may not support WebGL
   - Use real Android/iOS device

2. **Check device capabilities:**
   - Older devices may not support WebGL
   - Check device specs

3. **Add fallback:**
   ```typescript
   // In Model3DViewer, add WebGL check
   const checkWebGLSupport = () => {
     // Check if WebGL is available
     // Show error if not supported
   };
   ```

---

### 7. ❌ Memory Issues

**Symptoms:**
- App crashes after model loads
- Out of memory errors
- App becomes slow/unresponsive

**Solution:**
1. **Optimize model:**
   - Reduce polygon count
   - Compress textures
   - Use lower resolution models

2. **Add memory management:**
   ```typescript
   // Clean up on unmount
   useEffect(() => {
     return () => {
       // Dispose Three.js objects
       if (modelRef.current) {
         modelRef.current.traverse((child) => {
           if (child instanceof THREE.Mesh) {
             child.geometry.dispose();
             child.material.dispose();
           }
         });
       }
     };
   }, []);
   ```

---

## Step-by-Step Debugging

### Step 1: Check API Connection

```bash
# In React Native console, look for:
🌐 API Request: GET /api/avatars/{agentId}/status
📡 API Response: 200 OK

# If you see errors, check:
1. Backend is running
2. API_BASE_URL is correct in .env
3. Network connectivity
```

### Step 2: Check Avatar Status

```bash
# Test API directly
curl http://your-backend/api/avatars/{agentId}/status

# Should return:
{
  "status": "ready",
  "modelUrl": "https://...",
  "format": "glb"
}
```

### Step 3: Check Download URL

```bash
# Test download URL endpoint
curl http://your-backend/api/avatars/{agentId}/download-url

# Should return signed URL:
{
  "url": "https://storage.../model.glb?sv=...",
  "expiresIn": 900
}
```

### Step 4: Test Model URL

```bash
# Test if model URL is accessible
curl -I "https://storage.../model.glb?sv=..."

# Should return:
HTTP/1.1 200 OK
Content-Type: model/gltf-binary
```

### Step 5: Check Console Logs

```javascript
// In Model3DViewer.tsx, add logging:
console.log('Loading model from:', modelUrl);
console.log('GL context created:', !!gl);
console.log('Renderer created:', !!renderer);
```

---

## Quick Fixes

### Fix 1: Add Error Boundary

```typescript
// Wrap AvatarViewer in error boundary
<ErrorBoundary
  fallback={<Text>Error loading viewer</Text>}
>
  <AvatarViewer agentId={agentId} onClose={onClose} />
</ErrorBoundary>
```

### Fix 2: Add Loading State

```typescript
// In Model3DViewer, ensure loading state is shown
if (isLoading) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
      <Text>Loading 3D model...</Text>
    </View>
  );
}
```

### Fix 3: Validate Model URL

```typescript
// In AvatarViewer, validate URL before passing to Model3DViewer
if (!downloadUrl || !downloadUrl.startsWith('http')) {
  setError('Invalid model URL');
  return;
}
```

---

## Testing Checklist

- [ ] Backend API is running and accessible
- [ ] API_BASE_URL is set correctly in `.env`
- [ ] Avatar exists and status is "ready"
- [ ] Download URL endpoint returns valid signed URL
- [ ] Model URL is accessible (test with curl)
- [ ] Model file is valid GLB/GLTF format
- [ ] All dependencies installed (expo-gl, expo-three, three)
- [ ] Testing on physical device (not emulator)
- [ ] WebGL/OpenGL ES is supported on device
- [ ] CORS is configured on Azure Blob Storage (if using Azure)
- [ ] Model size is reasonable (<50MB recommended)

---

## Additional Steps for AR App Connection

**Note**: The React Native app and Unity AR app are **separate applications**. They don't automatically connect.

### To Connect AR App to Client App:

1. **Deep Linking** (Recommended):
   ```typescript
   // In React Native app, launch Unity app
   import { Linking } from 'react-native';
   
   const launchUnityAR = (agentId: string) => {
     Linking.openURL(`aichatar://ar?agentId=${agentId}`);
   };
   ```

2. **Shared Backend**:
   - Both apps connect to same backend API
   - Both use same agentId
   - Avatar data is shared via backend

3. **No Direct Connection**:
   - React Native app cannot directly call Unity app
   - Must use deep linking or backend as intermediary

---

## Getting Help

If the app still crashes:

1. **Check React Native logs:**
   ```bash
   npx react-native log-android  # Android
   npx react-native log-ios      # iOS
   ```

2. **Check Metro bundler logs:**
   - Look for errors in terminal where `npm start` is running

3. **Enable debug logging:**
   ```typescript
   // Add console.logs throughout AvatarViewer and Model3DViewer
   console.log('AvatarViewer: Status:', status);
   console.log('AvatarViewer: Download URL:', downloadUrl);
   console.log('Model3DViewer: Loading model:', modelUrl);
   ```

4. **Test with simple model:**
   - Use a known-good GLB file
   - Test if issue is with specific model or general

---

**Last Updated**: [Current Date]

