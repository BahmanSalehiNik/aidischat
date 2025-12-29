# Unity GLB Model Download Flow - Azure to Unity

## Overview

This document explains how 3D GLB models are downloaded from Azure Blob Storage to the Unity app.

---

## Complete Download Flow

```
Unity App
    ↓
1. Poll avatar status (GET /api/avatars/:agentId/status)
    ↓
2. When status = "ready", request download URL
   (GET /api/avatars/:agentId/download-url?expiresSeconds=900)
    ↓
3. Backend generates Azure signed URL (SAS token)
    ↓
4. Unity receives signed URL
    ↓
5. Unity downloads GLB directly from Azure Blob Storage
    ↓
6. GLTFast parses and loads the model
    ↓
7. Avatar appears in Unity scene
```

---

## Step-by-Step Process

### Step 1: Avatar Status Polling

**Unity Code:** `AvatarLoader.cs` → `PollStatusCoroutine()`

```csharp
// Unity polls every 2 seconds
avatarAPI.GetAvatarStatus(agentId, 
    (status) => {
        if (status.status == "ready") {
            LoadModel(); // Proceed to download
        }
    }
);
```

**API Call:**
```
GET /api/avatars/{agentId}/status
```

**Backend Response:**
```json
{
  "status": "ready",
  "progress": 100,
  "modelUrl": "https://youraccount.blob.core.windows.net/avatars/123/model.glb",
  "format": "glb",
  "modelType": "3d"
}
```

---

### Step 2: Request Download URL

**Unity Code:** `AvatarLoader.cs` → `LoadModelCoroutine()`

```csharp
// Request signed URL (expires in 15 minutes)
avatarAPI.GetDownloadUrl(agentId, 900,
    (downloadUrl) => {
        // downloadUrl.url contains Azure signed URL
        LoadGLBModel(downloadUrl.url);
    }
);
```

**API Call:**
```
GET /api/avatars/{agentId}/download-url?expiresSeconds=900
```

**Backend Process:**
1. Backend checks if `modelUrl` is from Azure Storage
2. If yes, generates **SAS (Shared Access Signature) token**
3. Creates signed URL with expiration (default: 15 minutes)

**Backend Response:**
```json
{
  "url": "https://youraccount.blob.core.windows.net/avatars/123/model.glb?sv=2021-06-08&ss=b&srt=co&sp=r&se=2024-01-01T12:00:00Z&st=2024-01-01T11:45:00Z&spr=https&sig=...",
  "expiresIn": 900,
  "format": "glb",
  "modelType": "3d"
}
```

**What is a Signed URL?**
- Azure Blob Storage uses **SAS tokens** for secure, time-limited access
- The URL includes authentication parameters in the query string
- Expires after specified time (prevents unauthorized access)
- No need for separate authentication headers

---

### Step 3: Download from Azure

**Unity Code:** `AvatarLoader.cs` → `LoadGLBModel()`

**Option A: Using GLTFast (Recommended)**

```csharp
#if GLTFAST
var gltf = new GLTFast.GltfImport();
// GLTFast handles HTTP download internally
yield return gltf.Load(signedUrl);
// Model is downloaded and parsed automatically
yield return gltf.InstantiateScene(avatarParent);
#endif
```

**What GLTFast Does:**
1. **Downloads** the GLB file from Azure using the signed URL
2. **Parses** the GLB format (binary glTF)
3. **Creates** Unity GameObjects with meshes, materials, textures
4. **Instantiates** the model in the scene

**Option B: Manual Download (Fallback)**

If GLTFast is not available, you can download manually:

```csharp
using (UnityWebRequest request = UnityWebRequest.Get(signedUrl))
{
    yield return request.SendWebRequest();
    
    if (request.result == UnityWebRequest.Result.Success)
    {
        byte[] glbData = request.downloadHandler.data;
        // Save to local cache or parse manually
    }
}
```

---

## Azure Blob Storage Details

### Storage Structure

```
Azure Blob Storage Account
└── Container: "avatars"
    └── Blob: "avatars/1234567890/model.glb"
```

### URL Format

**Base URL:**
```
https://{account}.blob.core.windows.net/{container}/{blob}
```

**Signed URL (with SAS token):**
```
https://{account}.blob.core.windows.net/{container}/{blob}?sv=2021-06-08&ss=b&srt=co&sp=r&se=...&sig=...
```

### SAS Token Parameters

- `sv`: API version
- `ss`: Services (blob, file, queue, table)
- `srt`: Resource types (container, object)
- `sp`: Permissions (read, write, delete, etc.)
- `se`: Expiration time
- `st`: Start time
- `sig`: Cryptographic signature

---

## Security & Access Control

### Why Signed URLs?

1. **Private Containers**: Azure containers can be private (not publicly accessible)
2. **Time-Limited Access**: URLs expire after 15 minutes (configurable)
3. **No Credentials in Client**: Unity app doesn't need Azure credentials
4. **Audit Trail**: Backend can log who requested URLs

### URL Expiration

- **Default**: 900 seconds (15 minutes)
- **Configurable**: Via `expiresSeconds` query parameter
- **Refresh**: Unity can request a new URL if expired

### CORS Configuration

Azure Blob Storage must have CORS enabled for Unity to download:

**Required CORS Settings:**
- **Allowed Origins**: `*` (or specific domains)
- **Allowed Methods**: `GET`, `HEAD`
- **Allowed Headers**: `*`
- **Max Age**: 3600

---

## Download Process in Detail

### 1. HTTP Request Flow

```
Unity App
    ↓ HTTP GET
Azure Blob Storage (signed URL)
    ↓ Response (GLB binary data)
Unity App
    ↓ Parse with GLTFast
Unity Scene (3D Model)
```

### 2. Network Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ Unity App   │────────▶│ Backend API  │────────▶│ Azure Blob  │
│             │ Request │              │ Generate│ Storage     │
│             │ Status  │              │ Signed  │             │
└─────────────┘         └──────────────┘ URL     └─────────────┘
      │                        │                        │
      │                        │                        │
      │                        │                        │
      │◀───────────────────────┘                        │
      │ Signed URL                                      │
      │                                                 │
      │─────────────────────────────────────────────────▶
      │ Direct Download (HTTP GET)
      │                                                 │
      │◀─────────────────────────────────────────────────
      │ GLB Binary Data
      │
      ▼
   GLTFast
   Parses & Loads
```

### 3. Data Flow

```
Azure Blob Storage
    │
    │ GLB File (binary)
    │ - Header (JSON metadata)
    │ - Binary chunks (meshes, textures)
    │
    ▼
HTTP Response
    │
    │ Binary stream
    │
    ▼
Unity Memory
    │
    │ Byte array
    │
    ▼
GLTFast Parser
    │
    │ Parsed data structures
    │
    ▼
Unity GameObjects
    │
    │ - Meshes
    │ - Materials
    │ - Textures
    │ - Animations
    │
    ▼
Scene Hierarchy
```

---

## Implementation Details

### Current Implementation

**File:** `Assets/Scripts/AR/AvatarLoader.cs`

```csharp
// 1. Poll status
avatarAPI.GetAvatarStatus(agentId, ...);

// 2. Get download URL
avatarAPI.GetDownloadUrl(agentId, 900, ...);

// 3. Load with GLTFast
yield return LoadGLBModel(downloadUrl.url);
```

### GLTFast Integration

GLTFast handles:
- ✅ HTTP download from URL
- ✅ Binary GLB parsing
- ✅ Texture loading
- ✅ Material creation
- ✅ Mesh generation
- ✅ Animation import

**Installation:**
```
Window > Package Manager > Add package from git URL
https://github.com/atteneder/glTFast.git?path=/Unity/Package
```

---

## Error Handling

### Common Issues

**1. CORS Error**
```
Error: CORS policy blocked
```
**Solution:** Configure CORS in Azure Blob Storage settings

**2. Expired URL**
```
Error: 403 Forbidden
```
**Solution:** Request a new download URL (they expire after 15 minutes)

**3. Network Error**
```
Error: Network unreachable
```
**Solution:** Check internet connection, retry with exponential backoff

**4. Invalid GLB**
```
Error: Failed to parse GLB
```
**Solution:** Verify model file is valid GLB format

---

## Performance Considerations

### Download Size

- **Typical GLB**: 1-10 MB
- **Large models**: 10-50 MB
- **Optimized**: < 5 MB recommended

### Download Time

- **4G**: ~2-5 seconds per MB
- **WiFi**: ~0.5-1 second per MB
- **5G**: ~0.2-0.5 seconds per MB

### Caching Strategy

**Current:** No caching (downloads every time)

**Recommended:** Cache downloaded GLB files locally

```csharp
// Check cache first
string cachePath = $"{Application.persistentDataPath}/avatars/{agentId}.glb";
if (File.Exists(cachePath))
{
    // Load from cache
    LoadGLBModelFromFile(cachePath);
}
else
{
    // Download and cache
    DownloadAndCache(url, cachePath);
}
```

---

## Summary

**Download Flow:**
1. ✅ Unity polls avatar status
2. ✅ When ready, requests signed URL from backend
3. ✅ Backend generates Azure SAS signed URL
4. ✅ Unity downloads GLB directly from Azure
5. ✅ GLTFast parses and loads model
6. ✅ Avatar appears in scene

**Key Points:**
- **Signed URLs** provide secure, time-limited access
- **GLTFast** handles download and parsing automatically
- **Direct download** from Azure (no backend proxy needed)
- **15-minute expiration** (configurable)

---

**Last Updated**: [Current Date]

