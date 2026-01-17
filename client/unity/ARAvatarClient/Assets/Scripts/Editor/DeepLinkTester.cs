using UnityEngine;
using UnityEditor;
using AIChatAR.Utils;

namespace AIChatAR.Editor
{
    /// <summary>
    /// Editor tool to test deep linking in Unity Editor
    /// </summary>
    public class DeepLinkTester : EditorWindow
    {
        private string testAgentId = "test-agent-123";
        private string testRoomId = "test-room-456";

        [MenuItem("AIChatAR/Test Deep Link")]
        public static void ShowWindow()
        {
            GetWindow<DeepLinkTester>("Deep Link Tester");
        }

        void OnGUI()
        {
            GUILayout.Label("Deep Link Tester", EditorStyles.boldLabel);
            GUILayout.Space(10);

            EditorGUILayout.HelpBox(
                "This tool tests deep link parsing in the Unity Editor.\n" +
                "It simulates receiving a deep link URL and parses it.",
                MessageType.Info
            );

            GUILayout.Space(10);

            testAgentId = EditorGUILayout.TextField("Agent ID:", testAgentId);
            testRoomId = EditorGUILayout.TextField("Room ID:", testRoomId);

            GUILayout.Space(10);

            if (GUILayout.Button("Test Deep Link"))
            {
                string testUrl = $"aichatar://ar?agentId={testAgentId}&roomId={testRoomId}";
                Debug.Log($"🧪 [DeepLinkTester] Testing URL: {testUrl}");

                // Find DeepLinkHandler in scene
                DeepLinkHandler handler = FindObjectOfType<DeepLinkHandler>();
                if (handler != null)
                {
                    handler.TestDeepLink(testUrl);
                    Debug.Log("✅ [DeepLinkTester] Deep link test triggered");
                }
                else
                {
                    Debug.LogError("❌ [DeepLinkTester] DeepLinkHandler not found in scene! Add it to a GameObject first.");
                }
            }

            GUILayout.Space(10);

            EditorGUILayout.HelpBox(
                "Note: This only tests URL parsing.\n" +
                "To fully test, build and install the app, then use:\n" +
                "Android: adb shell am start -W -a android.intent.action.VIEW -d \"aichatar://ar?agentId=test\" com.yourcompany.aichatar\n" +
                "iOS: xcrun simctl openurl booted \"aichatar://ar?agentId=test\"",
                MessageType.Warning
            );
        }
    }
}

