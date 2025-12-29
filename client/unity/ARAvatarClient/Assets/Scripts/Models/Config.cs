using System;

namespace AIChatAR.Models
{
    /// <summary>
    /// Configuration loaded from Resources/Config.json
    /// </summary>
    [Serializable]
    public class Config
    {
        public string apiBaseUrl;
        public string wsUrl;
        public string avatarServiceUrl;
        public string ttsServiceUrl;
        public float pollInterval;
        public bool modelCacheEnabled;
    }
}

