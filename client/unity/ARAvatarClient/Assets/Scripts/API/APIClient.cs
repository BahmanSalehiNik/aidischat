using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace AIChatAR.API
{
    /// <summary>
    /// Base API client for making HTTP requests
    /// Matches React Native api.ts functionality
    /// </summary>
    public class APIClient
    {
        private string baseUrl;
        private string authToken;

        public APIClient(string baseUrl, string authToken = null)
        {
            this.baseUrl = baseUrl.TrimEnd('/');
            this.authToken = authToken;
        }

        public void SetAuthToken(string token)
        {
            this.authToken = token;
        }

        /// <summary>
        /// GET request
        /// </summary>
        public IEnumerator Get<T>(string endpoint, Action<T> onSuccess, Action<string> onError)
        {
            string url = $"{baseUrl}{endpoint}";
            Debug.Log($"🌐 API GET: {url}");

            using (UnityWebRequest request = UnityWebRequest.Get(url))
            {
                if (!string.IsNullOrEmpty(authToken))
                {
                    request.SetRequestHeader("Authorization", $"Bearer {authToken}");
                }
                request.SetRequestHeader("Content-Type", "application/json");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    try
                    {
                        string json = request.downloadHandler.text;
                        Debug.Log($"✅ API Response: {json}");
                        T data = JsonUtility.FromJson<T>(json);
                        onSuccess?.Invoke(data);
                    }
                    catch (Exception e)
                    {
                        Debug.LogError($"❌ JSON Parse Error: {e.Message}");
                        onError?.Invoke($"Failed to parse response: {e.Message}");
                    }
                }
                else
                {
                    string error = request.error;
                    if (request.responseCode == 404)
                    {
                        onError?.Invoke("Not found");
                    }
                    else
                    {
                        Debug.LogError($"❌ API Error: {error} (Status: {request.responseCode})");
                        onError?.Invoke(error);
                    }
                }
            }
        }

        /// <summary>
        /// POST request
        /// </summary>
        public IEnumerator Post<T>(string endpoint, object body, Action<T> onSuccess, Action<string> onError)
        {
            string url = $"{baseUrl}{endpoint}";
            string jsonBody = JsonUtility.ToJson(body);
            Debug.Log($"🌐 API POST: {url}");
            Debug.Log($"📤 Body: {jsonBody}");

            using (UnityWebRequest request = new UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();

                if (!string.IsNullOrEmpty(authToken))
                {
                    request.SetRequestHeader("Authorization", $"Bearer {authToken}");
                }
                request.SetRequestHeader("Content-Type", "application/json");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.Success)
                {
                    try
                    {
                        string json = request.downloadHandler.text;
                        Debug.Log($"✅ API Response: {json}");
                        T data = JsonUtility.FromJson<T>(json);
                        onSuccess?.Invoke(data);
                    }
                    catch (Exception e)
                    {
                        Debug.LogError($"❌ JSON Parse Error: {e.Message}");
                        onError?.Invoke($"Failed to parse response: {e.Message}");
                    }
                }
                else
                {
                    string error = request.error;
                    Debug.LogError($"❌ API Error: {error} (Status: {request.responseCode})");
                    onError?.Invoke(error);
                }
            }
        }
    }
}

