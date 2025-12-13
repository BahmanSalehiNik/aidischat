# Client Integration Guide - Avatar System

## Overview

This document explains how users interact with the avatar system in the React Native mobile app, from viewing progress to rendering 3D models.

## Complete User Flow

### 1. Agent Creation → Avatar Generation
```
User creates agent
    ↓
AgentIngestedEvent published to Kafka
    ↓
AR Avatar Service receives event
    ↓
Avatar generation starts automatically
```

### 2. Progress Tracking (Client-Side)

**API Endpoint:** `GET /api/avatars/:agentId/status`

**Response:**
```json
{
  "status": "generating" | "ready" | "failed" | "pending",
  "progress": 45,  // 0-100
  "estimatedTimeRemaining": 15,  // seconds
  "modelUrl": "https://...",  // only when ready
  "format": "glb",
  "modelType": "3d"
}
```

**Client Implementation:**
- `AvatarViewer` component polls this endpoint every 2 seconds when status is "generating"
- Shows progress bar and estimated time remaining
- Automatically transitions to model viewer when ready

### 3. Model Access

**API Endpoint:** `GET /api/avatars/:agentId/download-url?expiresSeconds=900`

**Response:**
```json
{
  "url": "https://storage.../model.glb?signature=...",
  "expiresIn": 900,  // seconds (null for external URLs)
  "format": "glb",
  "modelType": "3d"
}
```

**Features:**
- Returns signed URL for private Azure containers
- Returns public URL for external providers (Meshy, etc.)
- Configurable expiration time (default: 15 minutes)
- Supports CDN URLs if configured

### 4. UI Integration

**Agent Detail Screen:**
- Shows AR/3D Avatar button
- Button color indicates status:
  - 🟢 Green: Ready to view
  - 🟠 Orange: Generating (shows progress)
  - ⚪ Gray: Pending/Failed
- Opens `AvatarViewer` modal when clicked

**Avatar Viewer Component:**
- Full-screen modal
- Shows generation progress if not ready
- Renders 3D model when ready
- Handles errors gracefully

## API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/avatars/:agentId` | GET | Get avatar metadata |
| `/api/avatars/:agentId/status` | GET | Get generation status + progress |
| `/api/avatars/:agentId/download-url` | GET | Get signed/public download URL |
| `/api/avatars/generate` | POST | Manually trigger generation |

## Client Files Created

1. **`utils/avatarApi.ts`**
   - API client functions
   - TypeScript interfaces
   - Error handling

2. **`components/avatar/AvatarViewer.tsx`**
   - Main viewer component
   - Progress tracking
   - Model rendering placeholder

3. **`components/avatar/AR_VIEWER_IMPLEMENTATION.md`**
   - Implementation guide for 3D rendering
   - Library recommendations
   - Code examples

4. **`app/(main)/AgentDetailScreen.tsx`** (updated)
   - Added AR button
   - Avatar status checking
   - Modal integration

## 3D Model Rendering Options

### Recommended: react-native-3d-model-view
```bash
npm install react-native-3d-model-view
```

**Pros:**
- Simple API
- Good performance
- Supports GLB/GLTF
- Works on iOS & Android

### Advanced: expo-three + react-three-fiber
```bash
npx expo install expo-gl expo-three three
npm install react-three-fiber @react-three/drei
```

**Pros:**
- Full Three.js capabilities
- Highly customizable
- Can add animations, lighting

### AR Support: expo-ar
```bash
npx expo install expo-ar
```

**Pros:**
- True AR experience
- Place avatar in real world
- Best for immersive viewing

## Implementation Steps

### Step 1: Install 3D Library
Choose one of the options above and install dependencies.

### Step 2: Update AvatarViewer Component
Replace the placeholder `renderModel()` function with actual 3D rendering code.

### Step 3: Test
1. Create an agent
2. Wait for avatar generation
3. Click AR button on agent detail screen
4. Verify model loads and renders correctly

### Step 4: Add AR Features (Optional)
- Add AR toggle button
- Implement AR placement
- Add gesture controls

## Security Considerations

1. **Signed URLs**: Used for private containers, expire after 15 minutes
2. **Public URLs**: External providers (Meshy) return public URLs
3. **CDN**: If configured, CDN URLs are returned instead of storage URLs
4. **CORS**: Ensure CORS is configured for storage/CDN

## Performance Optimization

1. **Model Caching**: Cache downloaded models locally
2. **LOD**: Use Level-of-Detail for complex models
3. **Texture Compression**: Compress textures before upload
4. **Progressive Loading**: Load model progressively if possible

## Error Handling

- **404**: Avatar not found → Show "Avatar not available"
- **400**: Avatar not ready → Show status and progress
- **500**: Server error → Show error message with retry button
- **Network Error**: Show retry option

## Future Enhancements

1. **WebSocket Updates**: Real-time progress updates instead of polling
2. **Model Preview**: Thumbnail/preview before full download
3. **AR Placement**: Place avatar in real-world space
4. **Animations**: Play idle/talking animations
5. **Customization**: Allow users to customize avatar appearance

## Testing Checklist

- [ ] Avatar generation starts automatically on agent creation
- [ ] Progress updates correctly during generation
- [ ] Model downloads successfully when ready
- [ ] 3D model renders correctly
- [ ] Signed URLs work for private containers
- [ ] Public URLs work for external providers
- [ ] Error states display correctly
- [ ] AR button shows correct status
- [ ] Modal opens/closes correctly
- [ ] Works on both iOS and Android

