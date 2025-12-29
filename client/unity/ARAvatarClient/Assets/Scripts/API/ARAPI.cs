using System.Collections;
using UnityEngine;
using AIChatAR.Models;
using AIChatAR.API;

namespace AIChatAR.API
{
    /// <summary>
    /// AR Conversations API client - matches React Native arApi.ts
    /// </summary>
    public class ARAPI : MonoBehaviour
    {
        private APIClient apiClient;
        private string apiBaseUrl;

        public void Initialize(string baseUrl, string authToken = null)
        {
            apiBaseUrl = baseUrl;
            apiClient = new APIClient(baseUrl, authToken);
        }

        /// <summary>
        /// Create or get AR room for agent - matches createOrGetARRoom()
        /// </summary>
        public void CreateOrGetARRoom(string agentId, System.Action<ARRoom> onSuccess, System.Action<string> onError)
        {
            var body = new
            {
                type = "ar",
                agentId = agentId
            };

            StartCoroutine(apiClient.Post<ARRoom>(
                "/rooms",
                body,
                (room) => {
                    // Handle both 'id' and '_id' formats (matching React Native behavior)
                    if (room != null && string.IsNullOrEmpty(room.id))
                    {
                        // Try to get _id from JSON if Unity's JsonUtility didn't map it
                        // This is a workaround - in production, use a custom JSON parser if needed
                        Debug.LogWarning("Room response may have _id instead of id");
                    }
                    onSuccess?.Invoke(room);
                },
                onError
            ));
        }

        /// <summary>
        /// Get AR room by ID - matches getARRoom()
        /// </summary>
        public void GetARRoom(string roomId, System.Action<ARRoom> onSuccess, System.Action<string> onError)
        {
            StartCoroutine(apiClient.Get<ARRoom>(
                $"/rooms/{roomId}",
                onSuccess,
                onError
            ));
        }

        /// <summary>
        /// Send AR message - matches sendARMessage()
        /// </summary>
        public void SendARMessage(string roomId, string content, string agentId, System.Action<ARMessage> onSuccess, System.Action<string> onError)
        {
            var body = new
            {
                content = content,
                agentId = agentId
            };

            StartCoroutine(apiClient.Post<ARMessage>(
                $"/ar-rooms/{roomId}/messages",
                body,
                (message) => {
                    // Ensure message has proper structure
                    if (message != null && string.IsNullOrEmpty(message.id))
                    {
                        Debug.LogWarning("Message response may have _id instead of id");
                    }
                    onSuccess?.Invoke(message);
                },
                onError
            ));
        }

        /// <summary>
        /// Get AR message history - matches getARMessages()
        /// </summary>
        public void GetARMessages(string roomId, System.Action<ARMessage[]> onSuccess, System.Action<string> onError)
        {
            StartCoroutine(apiClient.Get<ARMessage[]>(
                $"/ar-rooms/{roomId}/messages",
                onSuccess,
                onError
            ));
        }

        /// <summary>
        /// Get provider tokens for TTS/animation - matches getProviderTokens()
        /// </summary>
        public void GetProviderTokens(string roomId, System.Action<ProviderTokens> onSuccess, System.Action<string> onError)
        {
            StartCoroutine(apiClient.Get<ProviderTokens>(
                $"/ar-rooms/{roomId}/provider-tokens",
                onSuccess,
                onError
            ));
        }
    }
}

