# Unity App Lifecycle Management

## Overview

This document explains when avatar polling starts/stops, how views are managed, and how the Unity app handles termination.

---

## Current Issues

### ❌ Problems with Current Implementation

1. **Polling starts immediately** when GameObject is enabled (in `Start()`)
2. **No explicit stop method** - only stops in `OnDestroy()`
3. **No view lifecycle management** - doesn't match React Native behavior
4. **No graceful shutdown** when views close

### ✅ React Native Behavior (Reference)

- **Polling starts**: When `AvatarViewer` component mounts (user opens 3D viewer)
- **Polling stops**: When component unmounts (user closes viewer)
- **WebSocket connects**: When `ARChatScreen` opens
- **WebSocket disconnects**: When `ARChatScreen` closes

---

## Recommended Lifecycle Flow

### 1. Avatar Viewer (3D Model Viewer)

```
User clicks "View 3D Avatar" button
    ↓
AvatarViewer GameObject enabled
    ↓
AvatarLoader.StartPollingStatus() called
    ↓
Polling runs every 2 seconds
    ↓
When status = "ready", download and load model
    ↓
Polling stops automatically
    ↓
User closes viewer
    ↓
AvatarViewer GameObject disabled/destroyed
    ↓
AvatarLoader.StopPollingStatus() called
    ↓
Cleanup: Stop coroutines, release resources
```

### 2. AR Chat Screen

```
User opens AR Chat
    ↓
ARChatManager GameObject enabled
    ↓
ARChatManager.InitializeARChat() called
    ↓
- Create/get AR room
- Get provider tokens
- Load message history
- Connect WebSocket
- Start avatar loading
    ↓
User chats with agent
    ↓
WebSocket receives messages
    ↓
TTS, lip sync, animations play
    ↓
User closes AR Chat
    ↓
ARChatManager.Cleanup() called
    ↓
- Disconnect WebSocket
- Stop avatar polling
- Release resources
    ↓
ARChatManager GameObject disabled/destroyed
```

### 3. Unity App Termination

```
User exits Unity app
    ↓
OnApplicationPause(true) called (Android/iOS)
    ↓
All active components cleanup:
- Stop polling
- Disconnect WebSocket
- Release network resources
    ↓
OnApplicationQuit() called
    ↓
Final cleanup
    ↓
App terminates
```

---

## Implementation

### Updated AvatarLoader with Lifecycle Management

```csharp
public class AvatarLoader : MonoBehaviour
{
    private bool isPolling = false;
    
    // Start polling explicitly (called when viewer opens)
    public void StartPollingStatus()
    {
        if (isPolling) return; // Already polling
        
        isPolling = true;
        if (statusPollCoroutine != null)
        {
            StopCoroutine(statusPollCoroutine);
        }
        statusPollCoroutine = StartCoroutine(PollStatusCoroutine());
    }
    
    // Stop polling explicitly (called when viewer closes)
    public void StopPollingStatus()
    {
        isPolling = false;
        if (statusPollCoroutine != null)
        {
            StopCoroutine(statusPollCoroutine);
            statusPollCoroutine = null;
        }
    }
    
    void OnEnable()
    {
        // Don't auto-start - wait for explicit call
        // Only start if agentId is set AND explicitly requested
    }
    
    void OnDisable()
    {
        // Stop polling when disabled
        StopPollingStatus();
    }
    
    void OnDestroy()
    {
        StopPollingStatus();
        if (loadModelCoroutine != null)
        {
            StopCoroutine(loadModelCoroutine);
        }
    }
}
```

### Updated ARChatManager with Lifecycle Management

```csharp
public class ARChatManager : MonoBehaviour
{
    private bool isInitialized = false;
    
    // Initialize AR Chat (called when AR screen opens)
    public void InitializeARChat()
    {
        if (isInitialized) return;
        
        StartCoroutine(InitializeARChatCoroutine());
    }
    
    // Cleanup AR Chat (called when AR screen closes)
    public void Cleanup()
    {
        // Disconnect WebSocket
        if (webSocketClient != null)
        {
            webSocketClient.Disconnect();
        }
        
        // Stop avatar loading
        if (avatarLoader != null)
        {
            avatarLoader.StopPollingStatus();
        }
        
        // Clear state
        currentRoom = null;
        messages.Clear();
        isInitialized = false;
    }
    
    void OnDisable()
    {
        Cleanup();
    }
    
    void OnDestroy()
    {
        Cleanup();
    }
    
    void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus)
        {
            // App going to background - pause operations
            Cleanup();
        }
    }
    
    void OnApplicationQuit()
    {
        // Final cleanup
        Cleanup();
    }
}
```

---

## Scene/View Management

### Option 1: Scene-Based (Recommended for Unity)

Create separate scenes for different views:

```
MainMenuScene
    ↓ User clicks "View 3D Avatar"
AvatarViewerScene (loads additively)
    ↓ User closes
MainMenuScene (unloads AvatarViewerScene)
    ↓ User clicks "AR Chat"
ARChatScene (loads additively)
    ↓ User closes
MainMenuScene (unloads ARChatScene)
```

**Benefits:**
- Clean separation of concerns
- Easy to manage lifecycle
- Can unload scenes to free memory

### Option 2: GameObject Enable/Disable

Use single scene with GameObjects:

```csharp
// Main scene with all views
public class ViewManager : MonoBehaviour
{
    [SerializeField] private GameObject avatarViewer;
    [SerializeField] private GameObject arChatView;
    
    public void OpenAvatarViewer(string agentId)
    {
        avatarViewer.SetActive(true);
        var loader = avatarViewer.GetComponent<AvatarLoader>();
        loader.LoadAvatarForAgent(agentId);
        loader.StartPollingStatus();
    }
    
    public void CloseAvatarViewer()
    {
        var loader = avatarViewer.GetComponent<AvatarLoader>();
        loader.StopPollingStatus();
        avatarViewer.SetActive(false);
    }
    
    public void OpenARChat(string agentId)
    {
        arChatView.SetActive(true);
        var manager = arChatView.GetComponent<ARChatManager>();
        manager.SetAgentId(agentId);
        manager.InitializeARChat();
    }
    
    public void CloseARChat()
    {
        var manager = arChatView.GetComponent<ARChatManager>();
        manager.Cleanup();
        arChatView.SetActive(false);
    }
}
```

---

## Polling Behavior

### When Does Polling Start?

✅ **Should Start:**
- When user opens 3D Avatar Viewer
- When user opens AR Chat (to load avatar)
- When explicitly requested via `StartPollingStatus()`

❌ **Should NOT Start:**
- When Unity app starts
- When scene loads
- Automatically in `Start()`

### When Does Polling Stop?

✅ **Should Stop:**
- When avatar status = "ready" (model loaded)
- When avatar status = "failed"
- When user closes viewer
- When GameObject is disabled
- When app goes to background
- When app quits

### Polling States

```
Not Polling
    ↓ StartPollingStatus()
Polling (every 2 seconds)
    ↓ Status = "ready"
Loading Model
    ↓ Model Loaded
Polling Stopped (success)
    ↓
OR
    ↓ Status = "failed"
Polling Stopped (error)
    ↓
OR
    ↓ StopPollingStatus()
Polling Stopped (user action)
```

---

## WebSocket Lifecycle

### Connection Flow

```
ARChatManager enabled
    ↓
InitializeARChat() called
    ↓
Create/get AR room
    ↓
WebSocket.Connect(roomId)
    ↓
WebSocket connected
    ↓
Join room message sent
    ↓
Listening for messages
    ↓
User closes AR Chat
    ↓
WebSocket.Disconnect()
    ↓
WebSocket disconnected
    ↓
Cleanup complete
```

### Connection States

- **Disconnected**: Initial state, not connected
- **Connecting**: WebSocket connection in progress
- **Connected**: Ready to send/receive messages
- **Disconnecting**: Cleanup in progress
- **Disconnected**: Final state

---

## App Termination

### Android/iOS Lifecycle

```
User presses Home button
    ↓
OnApplicationPause(true)
    ↓
- Stop polling
- Disconnect WebSocket
- Pause audio
    ↓
App in background
    ↓
User returns to app
    ↓
OnApplicationPause(false)
    ↓
- Resume if needed
    ↓
OR
    ↓
User swipes away app
    ↓
OnApplicationQuit()
    ↓
- Final cleanup
    ↓
App terminated
```

### Graceful Shutdown Checklist

- [ ] Stop all coroutines
- [ ] Disconnect WebSocket
- [ ] Cancel pending HTTP requests
- [ ] Release audio resources
- [ ] Save any local state
- [ ] Clean up GameObjects
- [ ] Release memory

---

## Best Practices

### 1. Explicit Start/Stop

**Don't:**
```csharp
void Start()
{
    StartPollingStatus(); // Auto-starts
}
```

**Do:**
```csharp
void Start()
{
    // Wait for explicit call
}

public void OpenViewer()
{
    StartPollingStatus(); // Explicit start
}
```

### 2. Cleanup on Disable

**Always cleanup when disabled:**
```csharp
void OnDisable()
{
    StopPollingStatus();
    Cleanup();
}
```

### 3. Handle App Pause

**Pause operations when app goes to background:**
```csharp
void OnApplicationPause(bool pauseStatus)
{
    if (pauseStatus)
    {
        // App going to background
        PauseOperations();
    }
    else
    {
        // App returning to foreground
        ResumeOperations();
    }
}
```

### 4. Resource Management

**Release resources when not needed:**
```csharp
void Cleanup()
{
    // Stop coroutines
    StopAllCoroutines();
    
    // Disconnect network
    webSocketClient?.Disconnect();
    
    // Release audio
    audioSource?.Stop();
    
    // Clear references
    currentRoom = null;
    messages.Clear();
}
```

---

## Summary

### Polling Lifecycle

- **Starts**: When viewer/chat opens (explicit call)
- **Stops**: When viewer/chat closes, model ready, or error
- **Not**: Always running in background

### WebSocket Lifecycle

- **Connects**: When AR Chat opens
- **Disconnects**: When AR Chat closes or app pauses
- **Not**: Always connected

### App Lifecycle

- **Pause**: Stop operations, disconnect network
- **Resume**: Resume if needed
- **Quit**: Final cleanup, release resources

---

**Last Updated**: [Current Date]

