using System;
using System.Collections.Generic;

namespace AIChatAR.Models
{
    /// <summary>
    /// AR Room - matches React Native ARRoom interface
    /// </summary>
    [Serializable]
    public class ARRoom
    {
        public string id;
        public string type; // "ar"
        public string agentId;
        public string createdBy;
        public string status; // "active" | "paused" | "ended"
        public string createdAt;
    }

    /// <summary>
    /// AR Message - matches React Native ARMessage interface
    /// </summary>
    [Serializable]
    public class ARMessage
    {
        public string id;
        public string roomId;
        public string senderType; // "human" | "agent"
        public string senderId;
        public string content;
        public List<MessageMarker> markers;
        public string status; // "streaming" | "completed" | "failed"
        public string createdAt;
    }

    /// <summary>
    /// Message marker for emotions, gestures, poses, tone
    /// </summary>
    [Serializable]
    public class MessageMarker
    {
        public string type; // "emotion" | "gesture" | "pose" | "tone"
        public string value;
    }

    /// <summary>
    /// Provider tokens for TTS services - matches React Native ProviderTokens interface
    /// </summary>
    [Serializable]
    public class ProviderTokens
    {
        public string elevenLabsToken;
        public string azureSpeechToken;
        public string expiresIn;
    }
}

