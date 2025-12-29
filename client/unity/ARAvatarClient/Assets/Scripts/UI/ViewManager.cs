using UnityEngine;
using AIChatAR.AR;

namespace AIChatAR.UI
{
    /// <summary>
    /// View Manager - manages opening/closing of avatar viewer and AR chat
    /// Handles proper lifecycle: start/stop polling, connect/disconnect WebSocket
    /// </summary>
    public class ViewManager : MonoBehaviour
    {
        [Header("View References")]
        [SerializeField] private GameObject avatarViewerPanel;
        [SerializeField] private GameObject arChatPanel;

        [Header("Component References")]
        [SerializeField] private AvatarLoader avatarLoader;
        [SerializeField] private ARChatManager arChatManager;

        /// <summary>
        /// Open 3D Avatar Viewer
        /// Called when user clicks "View 3D Avatar" button
        /// </summary>
        public void OpenAvatarViewer(string agentId)
        {
            if (avatarViewerPanel == null)
            {
                Debug.LogError("❌ Avatar viewer panel not assigned");
                return;
            }

            Debug.Log($"📱 Opening Avatar Viewer for agent: {agentId}");

            // Enable the viewer panel
            avatarViewerPanel.SetActive(true);

            // Get or find AvatarLoader
            if (avatarLoader == null)
            {
                avatarLoader = avatarViewerPanel.GetComponentInChildren<AvatarLoader>();
            }

            if (avatarLoader != null)
            {
                // Set agent ID and start polling
                avatarLoader.LoadAvatarForAgent(agentId);
                avatarLoader.StartPollingStatus();
            }
            else
            {
                Debug.LogWarning("⚠️ AvatarLoader not found in viewer panel");
            }
        }

        /// <summary>
        /// Close 3D Avatar Viewer
        /// Called when user closes the viewer
        /// </summary>
        public void CloseAvatarViewer()
        {
            Debug.Log("📱 Closing Avatar Viewer");

            // Stop polling before disabling
            if (avatarLoader != null)
            {
                avatarLoader.StopPollingStatus();
            }

            // Disable the viewer panel
            if (avatarViewerPanel != null)
            {
                avatarViewerPanel.SetActive(false);
            }
        }

        /// <summary>
        /// Open AR Chat
        /// Called when user clicks "AR Chat" button
        /// </summary>
        public void OpenARChat(string agentId)
        {
            if (arChatPanel == null)
            {
                Debug.LogError("❌ AR Chat panel not assigned");
                return;
            }

            Debug.Log($"📱 Opening AR Chat for agent: {agentId}");

            // Enable the AR chat panel
            arChatPanel.SetActive(true);

            // Get or find ARChatManager
            if (arChatManager == null)
            {
                arChatManager = arChatPanel.GetComponentInChildren<ARChatManager>();
            }

            if (arChatManager != null)
            {
                // Set agent ID and initialize
                arChatManager.SetAgentId(agentId);
                arChatManager.InitializeARChat();
            }
            else
            {
                Debug.LogWarning("⚠️ ARChatManager not found in AR chat panel");
            }
        }

        /// <summary>
        /// Close AR Chat
        /// Called when user closes AR chat
        /// </summary>
        public void CloseARChat()
        {
            Debug.Log("📱 Closing AR Chat");

            // Cleanup before disabling
            if (arChatManager != null)
            {
                arChatManager.Cleanup();
            }

            // Disable the AR chat panel
            if (arChatPanel != null)
            {
                arChatPanel.SetActive(false);
            }
        }

        /// <summary>
        /// Handle app pause - cleanup all views
        /// </summary>
        void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // App going to background - close all views
                CloseAvatarViewer();
                CloseARChat();
            }
        }

        /// <summary>
        /// Handle app quit - final cleanup
        /// </summary>
        void OnApplicationQuit()
        {
            CloseAvatarViewer();
            CloseARChat();
        }
    }
}

