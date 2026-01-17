using System;
using System.Collections;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace AIChatAR.WebSocket
{
    /// <summary>
    /// WebSocket client for real-time messaging - matches React Native useGlobalWebSocket
    /// </summary>
    public class WebSocketClient : MonoBehaviour
    {
        private ClientWebSocket webSocket;
        private CancellationTokenSource cancellationTokenSource;
        private bool isConnected = false;
        private string wsUrl;
        private string authToken;

        public bool IsConnected => isConnected && webSocket != null && webSocket.State == WebSocketState.Open;

        public event Action<string> OnMessageReceived;
        public event Action OnConnected;
        public event Action OnDisconnected;
        public event Action<string> OnError;

        /// <summary>
        /// Initialize WebSocket client
        /// </summary>
        public void Initialize(string url, string token = null)
        {
            wsUrl = url;
            authToken = token;
        }

        /// <summary>
        /// Connect to WebSocket server
        /// </summary>
        public async void Connect(string roomId = null)
        {
            if (isConnected)
            {
                Debug.LogWarning("WebSocket already connected");
                return;
            }

            try
            {
                webSocket = new ClientWebSocket();
                cancellationTokenSource = new CancellationTokenSource();

                // Add auth token to URL if provided
                string fullUrl = wsUrl;
                if (!string.IsNullOrEmpty(roomId))
                {
                    fullUrl += $"?roomId={roomId}";
                }

                Debug.Log($"🔌 Connecting to WebSocket: {fullUrl}");
                await webSocket.ConnectAsync(new Uri(fullUrl), cancellationTokenSource.Token);

                isConnected = true;
                Debug.Log("✅ WebSocket connected");
                OnConnected?.Invoke();

                // Join room if roomId provided
                if (!string.IsNullOrEmpty(roomId))
                {
                    SendJoinMessage(roomId);
                }

                // Start receiving messages
                _ = ReceiveMessages();
            }
            catch (Exception e)
            {
                Debug.LogError($"❌ WebSocket connection error: {e.Message}");
                isConnected = false;
                OnError?.Invoke(e.Message);
            }
        }

        /// <summary>
        /// Send join message to room
        /// </summary>
        private void SendJoinMessage(string roomId)
        {
            var joinMessage = new
            {
                type = "join",
                roomId = roomId,
                isARRoom = true
            };

            string json = JsonUtility.ToJson(joinMessage);
            SendMessage(json);
        }

        /// <summary>
        /// Receive messages from WebSocket
        /// </summary>
        private async Task ReceiveMessages()
        {
            var buffer = new byte[1024 * 4];

            while (isConnected && webSocket != null && webSocket.State == WebSocketState.Open)
            {
                try
                {
                    var result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationTokenSource.Token);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        Debug.Log($"📨 WebSocket message received: {message}");
                        OnMessageReceived?.Invoke(message);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Debug.Log("🔌 WebSocket closed by server");
                        break;
                    }
                }
                catch (Exception e)
                {
                    if (!cancellationTokenSource.Token.IsCancellationRequested)
                    {
                        Debug.LogError($"❌ WebSocket receive error: {e.Message}");
                        OnError?.Invoke(e.Message);
                    }
                    break;
                }
            }

            isConnected = false;
            OnDisconnected?.Invoke();
        }

        /// <summary>
        /// Send message to WebSocket
        /// </summary>
        public new async void SendMessage(string message)
        {
            if (!IsConnected)
            {
                Debug.LogWarning("Cannot send message: WebSocket not connected");
                return;
            }

            try
            {
                byte[] bytes = Encoding.UTF8.GetBytes(message);
                await webSocket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    cancellationTokenSource.Token
                );
                Debug.Log($"📤 WebSocket message sent: {message}");
            }
            catch (Exception e)
            {
                Debug.LogError($"❌ WebSocket send error: {e.Message}");
                OnError?.Invoke(e.Message);
            }
        }

        /// <summary>
        /// Disconnect WebSocket
        /// </summary>
        public async void Disconnect()
        {
            isConnected = false;
            cancellationTokenSource?.Cancel();

            if (webSocket != null && webSocket.State == WebSocketState.Open)
            {
                try
                {
                    await webSocket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "Closing",
                        CancellationToken.None
                    );
                }
                catch (Exception e)
                {
                    Debug.LogError($"Error closing WebSocket: {e.Message}");
                }
            }

            webSocket?.Dispose();
            cancellationTokenSource?.Dispose();
            OnDisconnected?.Invoke();
        }

        void OnDestroy()
        {
            Disconnect();
        }
    }
}

