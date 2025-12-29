using System.Collections;
using UnityEngine;
using AIChatAR.Models;
using AIChatAR.API;

namespace AIChatAR.API
{
    /// <summary>
    /// Avatar API client - matches React Native avatarApi.ts
    /// </summary>
    public class AvatarAPI : MonoBehaviour
    {
        private APIClient apiClient;
        private string avatarServiceUrl;

        public void Initialize(string baseUrl, string authToken = null)
        {
            // Load config to get avatar service URL
            TextAsset configFile = Resources.Load<TextAsset>("Config");
            if (configFile != null)
            {
                Config config = JsonUtility.FromJson<Config>(configFile.text);
                avatarServiceUrl = config.avatarServiceUrl;
            }
            else
            {
                // Fallback to baseUrl + /avatars
                avatarServiceUrl = $"{baseUrl}/avatars";
            }

            apiClient = new APIClient(avatarServiceUrl, authToken);
        }

        /// <summary>
        /// Get avatar for an agent - matches getAvatar()
        /// </summary>
        public void GetAvatar(string agentId, System.Action<AIChatAR.Models.Avatar> onSuccess, System.Action<string> onError)
        {
            StartCoroutine(apiClient.Get<AIChatAR.Models.Avatar>(
                $"/{agentId}",
                (avatar) => {
                    if (avatar != null)
                    {
                        onSuccess?.Invoke(avatar);
                    }
                    else
                    {
                        onError?.Invoke("Avatar not found");
                    }
                },
                (error) => {
                    if (error == "Not found")
                    {
                        onSuccess?.Invoke(null); // Return null for 404, matching React Native behavior
                    }
                    else
                    {
                        onError?.Invoke(error);
                    }
                }
            ));
        }

        /// <summary>
        /// Get avatar generation status with progress - matches getAvatarStatus()
        /// </summary>
        public void GetAvatarStatus(string agentId, System.Action<AvatarStatus> onSuccess, System.Action<string> onError)
        {
            StartCoroutine(apiClient.Get<AvatarStatus>(
                $"/{agentId}/status",
                onSuccess,
                onError
            ));
        }

        /// <summary>
        /// Get signed download URL for avatar model - matches getDownloadUrl()
        /// </summary>
        public void GetDownloadUrl(string agentId, System.Action<AvatarDownloadUrl> onSuccess, System.Action<string> onError, int expiresSeconds = 900)
        {
            string endpoint = $"/{agentId}/download-url?expiresSeconds={expiresSeconds}";
            StartCoroutine(apiClient.Get<AvatarDownloadUrl>(
                endpoint,
                onSuccess,
                onError
            ));
        }

        /// <summary>
        /// Start avatar generation for an agent - matches generateAvatar()
        /// </summary>
        public void GenerateAvatar(string agentId, object agentProfile, System.Action<object> onSuccess, System.Action<string> onError)
        {
            var body = new
            {
                agentId = agentId,
                agentProfile = agentProfile
            };

            StartCoroutine(apiClient.Post<object>(
                "/generate",
                body,
                onSuccess,
                onError
            ));
        }
    }
}

