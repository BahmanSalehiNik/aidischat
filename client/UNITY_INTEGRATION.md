# Unity AR Integration Guide

This document describes the architecture and data flow for the AR Avatar integration, which uses a hybrid approach combining React Native (for UI/Chat) and a standalone Unity application (for high-fidelity AR rendering).

## Architecture Overview

The system consists of two separate applications that communicate via Deep Linking:

1.  **React Native App (`mobile-app`)**: The main application for user interaction, chat history, and account management.
2.  **Unity App (`ARAvatarClient`)**: A specialized, lightweight app dedicated to rendering the 3D avatar in AR.

### Why this approach?
-   **Performance**: Unity provides superior 3D/AR performance compared to WebGL/Three.js in React Native.
-   **Stability**: Keeps the main app light and avoids complex native module bridging issues.
-   **Flexibility**: Allows independent updates to the AR renderer.

## Data Flow

### 1. Initialization (React Native)
When a user opens the "AR Chat" or "View in AR" screen:
1.  The RN app fetches the `modelUrl` from the backend (`aiCore/avatar-service`).
2.  It checks if the Unity app is installed (indirectly via deep link capability).
3.  It constructs a Deep Link URL with the necessary context.

### 2. Deep Linking Protocol
The Unity app registers the custom scheme `aichatar://`.

**URL Format:**
```
aichatar://ar?agentId={AGENT_ID}&roomId={ROOM_ID}&modelUrl={MODEL_URL}
```

-   `agentId`: The ID of the agent to chat with.
-   `roomId`: (Optional) The chat room ID for WebSocket connection.
-   `modelUrl`: (Optional) The direct URL to the GLB/VRM model. Passing this avoids a redundant fetch in Unity.

### 3. Unity Execution
1.  **DeepLinkHandler.cs**: Listens for the `aichatar://` Intent (Android) or URL (iOS).
2.  **Parsing**: Extracts the query parameters.
3.  **ARChatManager.cs**:
    -   Receives the config.
    -   Downloads the model from `modelUrl`.
    -   Connects to the WebSocket using `roomId`/`agentId`.
    -   Renders the avatar in the AR Session.

## Client Implementation Details

### React Native (`ARChatScreen.tsx` / `ARViewer.tsx`)
Use `Expo Linking` to launch the Unity app:

```typescript
import * as Linking from 'expo-linking';

const launchUnity = async () => {
  const queryParams = new URLSearchParams({
    agentId: agentId,
  });
  
  if (modelUrl) {
    queryParams.append('modelUrl', modelUrl);
  }
  
  const url = `aichatar://ar?${queryParams.toString()}`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
};
```

### Unity (`DeepLinkHandler.cs`)
The Unity app's entry point script handles the incoming data:

```csharp
private void ParseDeepLink(string url) {
    // Extracts parameters
    // Calls ARChatManager.InitializeARChat(agentId, roomId, modelUrl);
}
```

## Build & Deployment
-   **Unity**: Build as an Android APK / iOS IPA. Must be installed on the device alongside the RN app.
-   **React Native**: Standard build. No special Unity dependencies required in `package.json`.
