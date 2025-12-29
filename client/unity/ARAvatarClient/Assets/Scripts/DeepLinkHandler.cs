using UnityEngine;
using System;
using AIChatAR.AR;

namespace AIChatAR.Utils
{
    /// <summary>
    /// Handles deep links from React Native app
    /// Receives: aichatar://ar?agentId=123&roomId=456
    /// </summary>
    public class DeepLinkHandler : MonoBehaviour
    {
        private static DeepLinkHandler instance;
        private string pendingDeepLink;

        void Awake()
        {
            // Singleton pattern
            if (instance == null)
            {
                instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
                return;
            }
        }

        // DEBUG GUI
        private string deepLinkStatus = "DeepLink: Waiting...";
        private GUIStyle deepLinkStyle;
        
        void OnGUI()
        {
            if (deepLinkStyle == null)
            {
                deepLinkStyle = new GUIStyle();
                deepLinkStyle.fontSize = 30;
                deepLinkStyle.normal.textColor = Color.yellow;
            }
            GUI.Label(new Rect(20, 200, Screen.width - 40, 100), deepLinkStatus, deepLinkStyle);
        }

        void Start()
        {
            #if UNITY_ANDROID && !UNITY_EDITOR
            CheckAndroidDeepLink();
            #endif

            #if UNITY_IOS && !UNITY_EDITOR
            // iOS handles deep links via OnApplicationFocus
            CheckIOSDeepLink();
            #endif
        }

        #if UNITY_ANDROID && !UNITY_EDITOR
        private void CheckAndroidDeepLink()
        {
            try
            {
                AndroidJavaClass unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                AndroidJavaObject currentActivity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
                AndroidJavaObject intent = currentActivity.Call<AndroidJavaObject>("getIntent");
                string dataString = intent.Call<string>("getDataString");

                if (!string.IsNullOrEmpty(dataString))
                {
                    deepLinkStatus = $"DeepLink: Received {dataString}";
                    Debug.Log($"🔗 [DeepLink] Android deep link received: {dataString}");
                    ParseDeepLink(dataString);
                }
                else
                {
                    deepLinkStatus = "DeepLink: None (Android)";
                    Debug.Log("🔗 [DeepLink] No deep link on startup");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"❌ [DeepLink] Error getting Android deep link: {e.Message}");
            }
        }

        // Called when app is opened via deep link while already running
        void OnApplicationPause(bool pauseStatus)
        {
            if (!pauseStatus) // App resumed
            {
                CheckAndroidDeepLink();
            }
        }
        #endif

        #if UNITY_IOS && !UNITY_EDITOR
        private void CheckIOSDeepLink()
        {
            string url = Application.absoluteURL;
            if (!string.IsNullOrEmpty(url) && url.StartsWith("aichatar://"))
            {
                deepLinkStatus = $"DeepLink: iOS Received {url}";
                Debug.Log($"🔗 [DeepLink] iOS deep link received: {url}");
                ParseDeepLink(url);
            }
            else
            {
                 deepLinkStatus = "DeepLink: None (iOS)";
            }
        }

        void OnApplicationFocus(bool hasFocus)
        {
            if (hasFocus)
            {
                CheckIOSDeepLink();
            }
        }
        #endif

        private void ParseDeepLink(string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                return;
            }

            // Parse: aichatar://ar?agentId=123&roomId=456
            if (url.StartsWith("aichatar://ar"))
            {
                try
                {
                    Debug.Log($"📋 [DeepLink] Parsing deep link: {url}");

                    // Parse query parameters manually (Unity doesn't have System.Web by default)
                    string queryString = "";
                    int queryIndex = url.IndexOf('?');
                    if (queryIndex >= 0 && queryIndex < url.Length - 1)
                    {
                        queryString = url.Substring(queryIndex + 1);
                    }

                    string agentId = null;
                    string roomId = null;
                    string modelUrl = null;

                    if (!string.IsNullOrEmpty(queryString))
                    {
                        string[] pairs = queryString.Split('&');
                        foreach (string pair in pairs)
                        {
                            string[] keyValue = pair.Split('=');
                            if (keyValue.Length == 2)
                            {
                                string key = Uri.UnescapeDataString(keyValue[0]);
                                string value = Uri.UnescapeDataString(keyValue[1]);

                                if (key.Equals("agentId", StringComparison.OrdinalIgnoreCase))
                                {
                                    agentId = value;
                                }
                                else if (key.Equals("roomId", StringComparison.OrdinalIgnoreCase))
                                {
                                    roomId = value;
                                }
                                else if (key.Equals("modelUrl", StringComparison.OrdinalIgnoreCase))
                                {
                                    // value is already decoded via Uri.UnescapeDataString(keyValue[1]) above.
                                    // Do NOT decode again, as this corrupts tokens with special chars (e.g. SAS tokens with '+').
                                    modelUrl = value;
                                    Debug.Log($"📋 [DeepLink] modelUrl: {modelUrl}");
                                }
                            }
                        }
                    }

                    Debug.Log($"📋 [DeepLink] Parsed - agentId: {agentId}, roomId: {roomId}, modelUrl: {(string.IsNullOrEmpty(modelUrl) ? "not provided" : "provided")}");

                    // Initialize AR Chat with parameters
                    if (!string.IsNullOrEmpty(agentId))
                    {
                        InitializeARChatWithAgent(agentId, roomId, modelUrl);
                    }
                    else
                    {
                        Debug.LogWarning("⚠️ [DeepLink] No agentId in deep link");
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"❌ [DeepLink] Error parsing deep link: {e.Message}\n{e.StackTrace}");
                }
            }
            else
            {
                Debug.LogWarning($"⚠️ [DeepLink] Unknown deep link format: {url}");
            }
        }

        private void InitializeARChatWithAgent(string agentId, string roomId = null, string modelUrl = null)
        {
            Debug.Log($"🚀 [DeepLink] Initializing AR Chat with agentId: {agentId}");

            // Find ARChatManager in scene
            ARChatManager arChatManager = FindObjectOfType<ARChatManager>();
            if (arChatManager != null)
            {
                // Set agent ID
                arChatManager.SetAgentId(agentId);

                // Set model URL if provided (for faster loading)
                if (!string.IsNullOrEmpty(modelUrl))
                {
                    arChatManager.SetModelUrl(modelUrl);
                    Debug.Log($"✅ [DeepLink] Model URL set from deep link");
                }

                // Initialize AR Chat
                arChatManager.InitializeARChat();

                Debug.Log($"✅ [DeepLink] AR Chat initialized successfully");
            }
            else
            {
                Debug.LogError("❌ [DeepLink] ARChatManager not found in scene! Make sure ARChatManager is added to a GameObject in the scene.");
            }
        }

        /// <summary>
        /// Public method to manually trigger deep link parsing (for testing)
        /// </summary>
        public void TestDeepLink(string testUrl)
        {
            ParseDeepLink(testUrl);
        }
    }
}

