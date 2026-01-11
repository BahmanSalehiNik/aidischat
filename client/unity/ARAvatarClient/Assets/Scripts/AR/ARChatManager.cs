using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using AIChatAR.Models;
using AIChatAR.API;
using AIChatAR.WebSocket;

namespace AIChatAR.AR
{
    /// <summary>
    /// AR Chat Manager - matches React Native ARChatScreen functionality
    /// Manages AR room, messages, WebSocket connection, and streaming
    /// </summary>
    public class ARChatManager : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private string agentId;
        [SerializeField] private string apiBaseUrl = "http://localhost:3000/api";
        [SerializeField] private string wsUrl = "ws://localhost:3000/api/realtime";
        [SerializeField] private string authToken;

        [Header("References")]
        [SerializeField] private AvatarLoader avatarLoader;
        [SerializeField] private ARAPI arAPI;
        [SerializeField] private AvatarAPI avatarAPI;
        [SerializeField] private WebSocketClient webSocketClient;

        // State
        private ARRoom currentRoom;
        private List<ARMessage> messages = new List<ARMessage>();
        private ProviderTokens providerTokens;
        private string modelUrl;
        private string streamingMessageId;
        private string streamingContent = "";

        // Events
        public System.Action<ARMessage> OnMessageReceived;
        public System.Action<string> OnStreamingChunk;
        public System.Action<string> OnStreamComplete;
        public System.Action<ARRoom> OnRoomInitialized;
        public System.Action<string> OnError;

        private bool isInitialized = false;

        void Start()
        {
            InitializeComponents();
            
            // Try to find AvatarLoader if not assigned
            if (avatarLoader == null)
            {
                avatarLoader = GetComponentInChildren<AvatarLoader>();
                if (avatarLoader == null)
                {
                    avatarLoader = FindObjectOfType<AvatarLoader>();
                }
                
                if (avatarLoader != null)
                {
                    Debug.Log($"✅ [ARChatManager] Found AvatarLoader automatically: {avatarLoader.name}");
                }
                else
                {
                    Debug.LogWarning("⚠️ [ARChatManager] AvatarLoader not found. Please add AvatarLoader GameObject to scene and assign it in ARChatManager.");
                }
            }
            
            // Don't auto-initialize - wait for explicit InitializeARChat() call
            // This matches React Native where AR chat initializes when screen opens
        }

        void OnEnable()
        {
            // Don't auto-initialize - wait for explicit call
        }

        void OnDisable()
        {
            // Cleanup when GameObject is disabled (AR chat closed)
            Cleanup();
        }

        private void InitializeComponents()
        {
            // Initialize API clients
            if (arAPI == null)
            {
                arAPI = gameObject.AddComponent<ARAPI>();
            }
            arAPI.Initialize(apiBaseUrl, authToken);

            if (avatarAPI == null)
            {
                avatarAPI = gameObject.AddComponent<AvatarAPI>();
            }
            avatarAPI.Initialize(apiBaseUrl, authToken);

            // Initialize WebSocket
            if (webSocketClient == null)
            {
                webSocketClient = gameObject.AddComponent<WebSocketClient>();
            }
            webSocketClient.Initialize(wsUrl, authToken);
            webSocketClient.OnMessageReceived += HandleWebSocketMessage;
            webSocketClient.OnConnected += OnWebSocketConnected;
            webSocketClient.OnDisconnected += OnWebSocketDisconnected;
            webSocketClient.OnError += OnWebSocketError;
        }

        /// <summary>
        /// Initialize AR Chat - matches initializeARChat() in React Native
        /// Call this explicitly when AR chat screen opens
        /// </summary>
        public void InitializeARChat()
        {
            if (isInitialized)
            {
                Debug.LogWarning("⚠️ AR Chat already initialized");
                return;
            }

            if (string.IsNullOrEmpty(agentId))
            {
                Debug.LogError("❌ Cannot initialize AR Chat: agentId not set");
                OnError?.Invoke("Agent ID not set");
                return;
            }

            StartCoroutine(InitializeARChatCoroutine());
        }

        /// <summary>
        /// Cleanup AR Chat - call when AR chat screen closes
        /// </summary>
        public void Cleanup()
        {
            if (!isInitialized)
            {
                return; // Already cleaned up
            }

            Debug.Log("🧹 Cleaning up AR Chat");

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
            streamingMessageId = null;
            streamingContent = "";
            isInitialized = false;
        }

        /// <summary>
        /// Set agent ID for AR chat
        /// </summary>
        public void SetAgentId(string newAgentId)
        {
            agentId = newAgentId;
            if (avatarLoader != null)
            {
                avatarLoader.LoadAvatarForAgent(newAgentId);
            }
        }

        /// <summary>
        /// Set model URL directly (from deep link) - skips API call for faster loading
        /// </summary>
        public void SetModelUrl(string url)
        {
            // HARDCODED TEST URL (GLTF with separate textures)
            // This is to verify that GLTF loading and rendering works, independent of Azure SAS token issues.
            // Use a known-good public GLTF with separate textures (Duck from Khronos glTF Sample Models)
            // GLTF format with separate textures is more reliable for texture handling in Unity
            url = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF/Duck.gltf";
            Debug.LogWarning($"⚠️ [ARChatManager] FORCING HARDCODED TEST MODEL (GLTF with separate textures): {url}");

            if (!string.IsNullOrEmpty(url))
            {
                modelUrl = url;
                Debug.Log($"✅ [ARChatManager] Model URL set: {url}");
                Debug.Log($"✅ [ARChatManager] Model URL length: {url.Length}");
                Debug.Log($"✅ [ARChatManager] Model URL starts with https: {url.StartsWith("https://")}");
                
                // Try to find AvatarLoader if not assigned
                if (avatarLoader == null)
                {
                    avatarLoader = GetComponentInChildren<AvatarLoader>();
                    if (avatarLoader == null)
                    {
                        avatarLoader = FindObjectOfType<AvatarLoader>();
                    }
                }
                
                // If avatar loader is available, load the model directly
                if (avatarLoader != null)
                {
                    Debug.Log($"📥 [ARChatManager] AvatarLoader found, loading model immediately");
                    Debug.Log($"📥 [ARChatManager] AvatarLoader GameObject: {avatarLoader.gameObject.name}");
                    Debug.Log($"📥 [ARChatManager] AvatarLoader active: {avatarLoader.gameObject.activeInHierarchy}");
                    Debug.Log($"📥 [ARChatManager] Calling avatarLoader.LoadModelFromUrl with: {url}");
                    Debug.Log($"📥 [ARChatManager] URL length: {url.Length}, starts with https: {url.StartsWith("https://")}");
                    avatarLoader.LoadModelFromUrl(url);
                }
                else
                {
                    Debug.LogWarning("⚠️ [ARChatManager] AvatarLoader not found. Will try to load during initialization.");
                    Debug.LogWarning("⚠️ [ARChatManager] Searching for AvatarLoader in scene...");
                    var foundLoader = FindObjectOfType<AvatarLoader>();
                    if (foundLoader != null)
                    {
                        Debug.LogWarning($"⚠️ [ARChatManager] Found AvatarLoader but it wasn't assigned: {foundLoader.gameObject.name}");
                    }
                    else
                    {
                        Debug.LogError("❌ [ARChatManager] AvatarLoader not found anywhere in scene!");
                    }
                }
            }
            else
            {
                Debug.LogWarning("⚠️ [ARChatManager] SetModelUrl called with empty URL");
            }
        }

        /// <summary>
        /// Initialize AR Chat coroutine - matches initializeARChat() in React Native
        /// </summary>
        private IEnumerator InitializeARChatCoroutine()
        {
            Debug.Log($"🚀 Initializing AR Chat for agent: {agentId}");

            // 1. Create or get AR room
            bool roomReceived = false;
            ARRoom arRoom = null;
            string roomError = null;

            arAPI.CreateOrGetARRoom(agentId,
                (room) => {
                    arRoom = room;
                    roomReceived = true;

                    // Handle both 'id' and '_id' formats
                    if (room != null && string.IsNullOrEmpty(room.id))
                    {
                        Debug.LogWarning("Room may have _id instead of id - check JSON parsing");
                    }
                },
                (error) => {
                    roomError = error;
                    roomReceived = true;
                }
            );

            yield return new WaitUntil(() => roomReceived);

            if (roomError != null || arRoom == null)
            {
                Debug.LogError($"❌ Failed to create AR room: {roomError}");
                OnError?.Invoke(roomError ?? "Failed to create AR room");
                yield break;
            }

            // Normalize room ID
            if (string.IsNullOrEmpty(arRoom.id))
            {
                Debug.LogError("❌ Invalid AR room response: missing id");
                OnError?.Invoke("Invalid AR room response");
                yield break;
            }

            currentRoom = arRoom;
            Debug.Log($"✅ AR Room created: {arRoom.id}");
            OnRoomInitialized?.Invoke(arRoom);

            // 2. Get provider tokens
            bool tokensReceived = false;
            arAPI.GetProviderTokens(arRoom.id,
                (tokens) => {
                    providerTokens = tokens;
                    tokensReceived = true;
                },
                (error) => {
                    Debug.LogWarning($"⚠️ Failed to get provider tokens: {error}");
                    tokensReceived = true;
                }
            );

            yield return new WaitUntil(() => tokensReceived);

            // 3. Load message history
            bool messagesReceived = false;
            arAPI.GetARMessages(arRoom.id,
                (history) => {
                    messages = new List<ARMessage>(history);
                    messagesReceived = true;
                    Debug.Log($"✅ Loaded {messages.Count} messages");
                },
                (error) => {
                    Debug.LogWarning($"⚠️ Failed to load messages: {error}");
                    messagesReceived = true;
                }
            );

            yield return new WaitUntil(() => messagesReceived);

            // 4. Get 3D model URL (skip if already set from deep link)
            if (string.IsNullOrEmpty(modelUrl))
            {
                bool avatarReceived = false;
                avatarAPI.GetAvatarStatus(agentId,
                    (status) => {
                        if (status.status == "ready" && !string.IsNullOrEmpty(status.modelUrl))
                        {
                            modelUrl = status.modelUrl;
                            Debug.Log($"✅ Avatar model URL: {modelUrl}");
                        }
                        avatarReceived = true;
                    },
                    (error) => {
                        Debug.LogWarning($"⚠️ Failed to load avatar: {error}");
                        avatarReceived = true;
                    }
                );

                yield return new WaitUntil(() => avatarReceived);
            }
            else
            {
                Debug.Log($"✅ Using model URL from deep link: {modelUrl}");
            }

            // 5. Find AvatarLoader if not assigned
            if (avatarLoader == null)
            {
                avatarLoader = GetComponentInChildren<AvatarLoader>();
                if (avatarLoader == null)
                {
                    avatarLoader = FindObjectOfType<AvatarLoader>();
                }
                
                if (avatarLoader == null)
                {
                    Debug.LogError("❌ [ARChatManager] AvatarLoader not found! Make sure AvatarLoader component is in the scene.");
                }
            }

            // 6. Load model if URL is available and avatar loader is ready
            if (!string.IsNullOrEmpty(modelUrl))
            {
                if (avatarLoader != null)
                {
                    Debug.Log($"📥 [ARChatManager] Loading model in AvatarLoader: {modelUrl}");
                    avatarLoader.LoadModelFromUrl(modelUrl);
                }
                else
                {
                    Debug.LogError($"❌ [ARChatManager] Cannot load model: AvatarLoader is null. Model URL: {modelUrl}");
                }
            }
            else
            {
                Debug.LogWarning("⚠️ [ARChatManager] No model URL available to load");
            }

            // 7. Connect WebSocket
            webSocketClient.Connect(arRoom.id);

            isInitialized = true;
            Debug.Log("✅ AR Chat initialized successfully");
        }

        /// <summary>
        /// Send message - matches handleSendMessage() in React Native
        /// </summary>
        public new void SendMessage(string content)
        {
            if (string.IsNullOrEmpty(content) || currentRoom == null || string.IsNullOrEmpty(agentId))
            {
                Debug.LogWarning("Cannot send message: missing content, room, or agentId");
                return;
            }

            StartCoroutine(SendMessageCoroutine(content));
        }

        private IEnumerator SendMessageCoroutine(string content)
        {
            bool messageSent = false;
            ARMessage newMessage = null;
            string error = null;

            arAPI.SendARMessage(currentRoom.id, content, agentId,
                (message) => {
                    newMessage = message;
                    messageSent = true;
                },
                (err) => {
                    error = err;
                    messageSent = true;
                }
            );

            yield return new WaitUntil(() => messageSent);

            if (error != null || newMessage == null || string.IsNullOrEmpty(newMessage.id))
            {
                Debug.LogError($"❌ Failed to send message: {error}");
                OnError?.Invoke(error ?? "Failed to send message");
                yield break;
            }

            messages.Add(newMessage);
            streamingMessageId = newMessage.id;
            streamingContent = "";
            OnMessageReceived?.Invoke(newMessage);
        }

        /// <summary>
        /// Handle WebSocket messages - matches handleMessage() in React Native
        /// </summary>
        private void HandleWebSocketMessage(string jsonMessage)
        {
            try
            {
                // Parse WebSocket message
                // Note: Unity's JsonUtility doesn't support nested objects well
                // For production, consider using Newtonsoft.Json or a custom parser
                var messageData = JsonUtility.FromJson<WebSocketMessage>(jsonMessage);

                if (messageData.type == "ar-stream-chunk")
                {
                    var chunkData = JsonUtility.FromJson<StreamChunkData>(messageData.data.ToString());
                    
                    if (chunkData.messageId == streamingMessageId)
                    {
                        streamingContent += chunkData.chunk;
                        OnStreamingChunk?.Invoke(streamingContent);

                        if (chunkData.isFinal)
                        {
                            StartCoroutine(ProcessStreamComplete(streamingContent));
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"❌ Error parsing WebSocket message: {e.Message}");
            }
        }

        /// <summary>
        /// Process stream complete - matches processStreamComplete() in React Native
        /// </summary>
        private IEnumerator ProcessStreamComplete(string fullContent)
        {
            if (string.IsNullOrEmpty(streamingMessageId)) yield break;

            // Update message in list
            for (int i = 0; i < messages.Count; i++)
            {
                if (messages[i].id == streamingMessageId)
                {
                    messages[i].content = fullContent;
                    messages[i].status = "completed";
                    break;
                }
            }

            // Parse markers from content
            var parsed = AIChatAR.Utils.MarkerParser.ParseMarkers(fullContent);
            string cleanText = parsed.text;

            // Get components for TTS, lip sync, emotions, gestures
            var ttsController = GetComponent<TTSController>();
            var lipSyncController = GetComponentInChildren<LipSyncController>();
            var emotionController = GetComponentInChildren<EmotionController>();
            var gestureController = GetComponentInChildren<GestureController>();

            // Apply emotion markers
            var emotionMarkers = AIChatAR.Utils.MarkerParser.GetMarkersByType(parsed, AIChatAR.Utils.MarkerParser.MarkerType.Emotion);
            if (emotionMarkers.Count > 0 && emotionController != null)
            {
                var lastEmotion = emotionMarkers[emotionMarkers.Count - 1];
                emotionController.SetEmotion(lastEmotion.value);
            }

            // Apply gesture markers
            var gestureMarkers = AIChatAR.Utils.MarkerParser.GetMarkersByType(parsed, AIChatAR.Utils.MarkerParser.MarkerType.Gesture);
            if (gestureMarkers.Count > 0 && gestureController != null)
            {
                var lastGesture = gestureMarkers[gestureMarkers.Count - 1];
                gestureController.PlayGesture(lastGesture.value);
            }

            // Generate TTS and play with lip sync
            if (ttsController != null && !string.IsNullOrEmpty(cleanText))
            {
                bool ttsComplete = false;
                AudioClip audioClip = null;
                float audioDuration = 0f;

                ttsController.GenerateTTS(cleanText,
                    (clip, duration) => {
                        audioClip = clip;
                        audioDuration = duration;
                        ttsComplete = true;
                    },
                    (error) => {
                        Debug.LogError($"TTS Error: {error}");
                        ttsComplete = true;
                    }
                );

                yield return new WaitUntil(() => ttsComplete);

                if (audioClip != null && audioDuration > 0)
                {
                    // Play audio
                    ttsController.PlayAudio(audioClip, audioDuration);

                    // Generate and play visemes (simplified - in production, use proper phoneme-to-viseme conversion)
                    if (lipSyncController != null)
                    {
                        // Generate simple viseme sequence based on text length
                        // In production, use a proper phoneme library
                        int visemeCount = Mathf.Max(1, cleanText.Length / 3);
                        int[] visemeIds = new int[visemeCount];
                        float[] timings = new float[visemeCount];
                        
                        for (int i = 0; i < visemeCount; i++)
                        {
                            visemeIds[i] = (i % 8) + 1; // Cycle through visemes
                            timings[i] = (float)i / visemeCount * audioDuration;
                        }

                        lipSyncController.PlayLipSyncFromIds(visemeIds, timings, audioDuration);
                    }
                }
            }

            Debug.Log($"✅ Stream complete: {cleanText}");
            OnStreamComplete?.Invoke(cleanText);

            streamingMessageId = null;
            streamingContent = "";
        }

        private void OnWebSocketConnected()
        {
            Debug.Log("✅ WebSocket connected");
        }

        private void OnWebSocketDisconnected()
        {
            Debug.Log("🔌 WebSocket disconnected");
        }

        private void OnWebSocketError(string error)
        {
            Debug.LogError($"❌ WebSocket error: {error}");
            OnError?.Invoke(error);
        }

        void OnDestroy()
        {
            Cleanup();
        }

        /// <summary>
        /// Handle app pause (Android/iOS) - cleanup when app goes to background
        /// </summary>
        void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // App going to background - cleanup to save resources
                Cleanup();
            }
        }

        /// <summary>
        /// Handle app quit - final cleanup
        /// </summary>
        void OnApplicationQuit()
        {
            Cleanup();
        }

        // Helper classes for WebSocket message parsing
        [System.Serializable]
        private class WebSocketMessage
        {
            public string type;
            public object data;
        }

        [System.Serializable]
        private class StreamChunkData
        {
            public string messageId;
            public string chunk;
            public bool isFinal;
        }
    }
}

