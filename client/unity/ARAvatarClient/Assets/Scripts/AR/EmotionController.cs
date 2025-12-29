using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using AIChatAR.Utils;

namespace AIChatAR.AR
{
    /// <summary>
    /// Emotion Controller - handles facial expression changes based on emotion markers
    /// </summary>
    public class EmotionController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private SkinnedMeshRenderer faceMeshRenderer;
        [SerializeField] private Animator animator;

        [Header("Emotion Blendshapes")]
        [SerializeField] private string happyBlendshape = "blendshape_happy";
        [SerializeField] private string sadBlendshape = "blendshape_sad";
        [SerializeField] private string angryBlendshape = "blendshape_angry";
        [SerializeField] private string excitedBlendshape = "blendshape_excited";
        [SerializeField] private string neutralBlendshape = "blendshape_neutral";

        [Header("Animation Settings")]
        [SerializeField] private float emotionTransitionDuration = 0.5f;

        private Dictionary<string, int> emotionToBlendshapeIndex = new Dictionary<string, int>();
        private string currentEmotion = "neutral";
        private Coroutine emotionTransitionCoroutine;

        void Start()
        {
            InitializeEmotionMapping();
        }

        /// <summary>
        /// Initialize emotion to blendshape mapping
        /// </summary>
        private void InitializeEmotionMapping()
        {
            if (faceMeshRenderer == null)
            {
                faceMeshRenderer = GetComponentInChildren<SkinnedMeshRenderer>();
            }

            if (faceMeshRenderer == null)
            {
                Debug.LogWarning("⚠️ No SkinnedMeshRenderer found for emotion controller");
                return;
            }

            Mesh mesh = faceMeshRenderer.sharedMesh;
            if (mesh == null) return;

            // Map emotions to blendshape indices
            string[] emotions = { "happy", "sad", "angry", "excited", "neutral" };
            string[] blendshapeNames = { happyBlendshape, sadBlendshape, angryBlendshape, excitedBlendshape, neutralBlendshape };

            for (int i = 0; i < emotions.Length; i++)
            {
                int index = GetBlendshapeIndex(mesh, blendshapeNames[i]);
                if (index >= 0)
                {
                    emotionToBlendshapeIndex[emotions[i]] = index;
                }
            }
        }

        private int GetBlendshapeIndex(Mesh mesh, string name)
        {
            for (int i = 0; i < mesh.blendShapeCount; i++)
            {
                string blendshapeName = mesh.GetBlendShapeName(i);
                if (blendshapeName.ToLower().Contains(name.ToLower()))
                {
                    return i;
                }
            }
            return -1;
        }

        /// <summary>
        /// Set emotion from marker
        /// </summary>
        public void SetEmotion(string emotionValue)
        {
            if (currentEmotion == emotionValue) return;

            string normalizedEmotion = emotionValue.ToLower();
            
            // Map common emotion values
            if (normalizedEmotion.Contains("happy") || normalizedEmotion.Contains("joy") || normalizedEmotion.Contains("smile"))
            {
                ApplyEmotion("happy");
            }
            else if (normalizedEmotion.Contains("sad") || normalizedEmotion.Contains("sorrow"))
            {
                ApplyEmotion("sad");
            }
            else if (normalizedEmotion.Contains("angry") || normalizedEmotion.Contains("mad"))
            {
                ApplyEmotion("angry");
            }
            else if (normalizedEmotion.Contains("excited") || normalizedEmotion.Contains("enthusiastic"))
            {
                ApplyEmotion("excited");
            }
            else
            {
                ApplyEmotion("neutral");
            }
        }

        /// <summary>
        /// Apply emotion with smooth transition
        /// </summary>
        private void ApplyEmotion(string emotion)
        {
            if (emotionTransitionCoroutine != null)
            {
                StopCoroutine(emotionTransitionCoroutine);
            }

            emotionTransitionCoroutine = StartCoroutine(TransitionEmotion(currentEmotion, emotion));
            currentEmotion = emotion;
        }

        /// <summary>
        /// Smoothly transition between emotions
        /// </summary>
        private IEnumerator TransitionEmotion(string fromEmotion, string toEmotion)
        {
            float elapsed = 0f;

            while (elapsed < emotionTransitionDuration)
            {
                float t = elapsed / emotionTransitionDuration;
                t = Mathf.SmoothStep(0f, 1f, t); // Smooth interpolation

                // Fade out current emotion
                if (emotionToBlendshapeIndex.ContainsKey(fromEmotion))
                {
                    int fromIndex = emotionToBlendshapeIndex[fromEmotion];
                    faceMeshRenderer.SetBlendShapeWeight(fromIndex, 100f * (1f - t));
                }

                // Fade in new emotion
                if (emotionToBlendshapeIndex.ContainsKey(toEmotion))
                {
                    int toIndex = emotionToBlendshapeIndex[toEmotion];
                    faceMeshRenderer.SetBlendShapeWeight(toIndex, 100f * t);
                }

                elapsed += Time.deltaTime;
                yield return null;
            }

            // Ensure final state
            if (emotionToBlendshapeIndex.ContainsKey(fromEmotion))
            {
                int fromIndex = emotionToBlendshapeIndex[fromEmotion];
                faceMeshRenderer.SetBlendShapeWeight(fromIndex, 0f);
            }

            if (emotionToBlendshapeIndex.ContainsKey(toEmotion))
            {
                int toIndex = emotionToBlendshapeIndex[toEmotion];
                faceMeshRenderer.SetBlendShapeWeight(toIndex, 100f);
            }
        }

        /// <summary>
        /// Reset to neutral emotion
        /// </summary>
        public void ResetToNeutral()
        {
            ApplyEmotion("neutral");
        }
    }
}

