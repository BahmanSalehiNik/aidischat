using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using AIChatAR.Models;
using AIChatAR.API;

namespace AIChatAR.AR
{
    /// <summary>
    /// TTS Controller - handles text-to-speech generation using provider tokens
    /// Supports ElevenLabs and Azure Speech
    /// </summary>
    public class TTSController : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private TTSProvider preferredProvider = TTSProvider.ElevenLabs;
        [SerializeField] private string voiceId = "default";
        [SerializeField] private float playbackSpeed = 1.0f;

        [Header("References")]
        [SerializeField] private AudioSource audioSource;

        private ProviderTokens providerTokens;
        private bool isPlaying = false;

        public enum TTSProvider
        {
            ElevenLabs,
            AzureSpeech
        }

        // Events
        public System.Action<AudioClip, float> OnAudioGenerated;
        public System.Action OnPlaybackComplete;
        public System.Action<string> OnError;

        void Start()
        {
            if (audioSource == null)
            {
                audioSource = gameObject.AddComponent<AudioSource>();
            }
        }

        /// <summary>
        /// Set provider tokens
        /// </summary>
        public void SetProviderTokens(ProviderTokens tokens)
        {
            providerTokens = tokens;
        }

        /// <summary>
        /// Generate TTS audio from text
        /// </summary>
        public void GenerateTTS(string text, System.Action<AudioClip, float> onComplete, System.Action<string> onError)
        {
            if (providerTokens == null)
            {
                onError?.Invoke("Provider tokens not set");
                return;
            }

            StartCoroutine(GenerateTTSCoroutine(text, onComplete, onError));
        }

        private IEnumerator GenerateTTSCoroutine(string text, System.Action<AudioClip, float> onComplete, System.Action<string> onError)
        {
            // Choose provider based on preference and token availability
            TTSProvider provider = preferredProvider;
            if (provider == TTSProvider.ElevenLabs && string.IsNullOrEmpty(providerTokens.elevenLabsToken))
            {
                provider = TTSProvider.AzureSpeech;
            }
            else if (provider == TTSProvider.AzureSpeech && string.IsNullOrEmpty(providerTokens.azureSpeechToken))
            {
                provider = TTSProvider.ElevenLabs;
            }

            switch (provider)
            {
                case TTSProvider.ElevenLabs:
                    yield return GenerateElevenLabsTTS(text, onComplete, onError);
                    break;
                case TTSProvider.AzureSpeech:
                    yield return GenerateAzureSpeechTTS(text, onComplete, onError);
                    break;
            }
        }

        /// <summary>
        /// Generate TTS using ElevenLabs API
        /// </summary>
        private IEnumerator GenerateElevenLabsTTS(string text, System.Action<AudioClip, float> onComplete, System.Action<string> onError)
        {
            if (string.IsNullOrEmpty(providerTokens.elevenLabsToken))
            {
                onError?.Invoke("ElevenLabs token not available");
                yield break;
            }

            string url = $"https://api.elevenlabs.io/v1/text-to-speech/{voiceId}";
            string jsonBody = $"{{\"text\":\"{text}\",\"model_id\":\"eleven_monolingual_v1\",\"voice_settings\":{{\"stability\":0.5,\"similarity_boost\":0.5}}}}";

            using (UnityEngine.Networking.UnityWebRequest request = new UnityEngine.Networking.UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonBody);
                request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new UnityEngine.Networking.DownloadHandlerAudioClip("", AudioType.MPEG);
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("xi-api-key", providerTokens.elevenLabsToken);

                yield return request.SendWebRequest();

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    AudioClip clip = UnityEngine.Networking.DownloadHandlerAudioClip.GetContent(request);
                    float duration = clip.length;
                    onComplete?.Invoke(clip, duration);
                }
                else
                {
                    onError?.Invoke($"ElevenLabs TTS error: {request.error}");
                }
            }
        }

        /// <summary>
        /// Generate TTS using Azure Speech API
        /// </summary>
        private IEnumerator GenerateAzureSpeechTTS(string text, System.Action<AudioClip, float> onComplete, System.Action<string> onError)
        {
            if (string.IsNullOrEmpty(providerTokens.azureSpeechToken))
            {
                onError?.Invoke("Azure Speech token not available");
                yield break;
            }

            // Azure Speech TTS requires SSML or plain text
            // This is a simplified implementation
            // For production, use Azure Speech SDK for Unity
            string url = "https://[region].tts.speech.microsoft.com/cognitiveservices/v1";
            string ssml = $"<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' name='en-US-JennyNeural'>{text}</voice></speak>";

            using (UnityEngine.Networking.UnityWebRequest request = new UnityEngine.Networking.UnityWebRequest(url, "POST"))
            {
                byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(ssml);
                request.uploadHandler = new UnityEngine.Networking.UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new UnityEngine.Networking.DownloadHandlerAudioClip("", AudioType.OGGVORBIS);
                request.SetRequestHeader("Content-Type", "application/ssml+xml");
                request.SetRequestHeader("Authorization", $"Bearer {providerTokens.azureSpeechToken}");
                request.SetRequestHeader("X-Microsoft-OutputFormat", "audio-16khz-128kbitrate-mono-mp3");

                yield return request.SendWebRequest();

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    AudioClip clip = UnityEngine.Networking.DownloadHandlerAudioClip.GetContent(request);
                    float duration = clip.length;
                    onComplete?.Invoke(clip, duration);
                }
                else
                {
                    onError?.Invoke($"Azure Speech TTS error: {request.error}");
                }
            }
        }

        /// <summary>
        /// Play audio clip
        /// </summary>
        public void PlayAudio(AudioClip clip, float duration)
        {
            if (audioSource == null)
            {
                Debug.LogError("AudioSource not found");
                return;
            }

            audioSource.clip = clip;
            audioSource.Play();
            isPlaying = true;

            StartCoroutine(WaitForPlaybackComplete(duration));
        }

        private IEnumerator WaitForPlaybackComplete(float duration)
        {
            yield return new WaitForSeconds(duration);
            isPlaying = false;
            OnPlaybackComplete?.Invoke();
        }

        /// <summary>
        /// Stop current playback
        /// </summary>
        public void StopPlayback()
        {
            if (audioSource != null && audioSource.isPlaying)
            {
                audioSource.Stop();
            }
            isPlaying = false;
        }

        public bool IsPlaying => isPlaying;
    }
}

