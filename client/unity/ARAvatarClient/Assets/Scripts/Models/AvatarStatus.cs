using System;

namespace AIChatAR.Models
{
    /// <summary>
    /// Avatar generation status - matches React Native AvatarStatus interface
    /// </summary>
    [Serializable]
    public class AvatarStatus
    {
        public string status; // "pending" | "generating" | "ready" | "failed"
        public int progress; // 0-100
        public string error;
        public string modelUrl;
        public string format; // "glb" | "gltf" | "vrm"
        public string modelType; // "3d" | "2d"
        public int estimatedTimeRemaining; // seconds
    }

    /// <summary>
    /// Avatar download URL response - matches React Native AvatarDownloadUrl interface
    /// </summary>
    [Serializable]
    public class AvatarDownloadUrl
    {
        public string url;
        public int expiresIn; // seconds (null in JSON becomes 0 in C#)
        public string format;
        public string modelType;
    }

    /// <summary>
    /// Full avatar metadata - matches React Native Avatar interface
    /// </summary>
    [Serializable]
    public class Avatar
    {
        public string agentId;
        public string ownerUserId;
        public string modelType;
        public string format;
        public string modelUrl;
        public string status;
        public string generationStartedAt;
        public string generationCompletedAt;
        public string generationError;
        public string provider;
        // characterDescription is dynamic, can be parsed separately if needed
    }
}

