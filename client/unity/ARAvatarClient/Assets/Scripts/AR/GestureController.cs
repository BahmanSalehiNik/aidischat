using System.Collections;
using UnityEngine;

namespace AIChatAR.AR
{
    /// <summary>
    /// Gesture Controller - handles body gestures and animations based on gesture markers
    /// </summary>
    public class GestureController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Animator animator;

        [Header("Gesture Animation Triggers")]
        [SerializeField] private string waveTrigger = "Wave";
        [SerializeField] private string pointTrigger = "Point";
        [SerializeField] private string nodTrigger = "Nod";
        [SerializeField] private string shakeTrigger = "Shake";
        [SerializeField] private string idleTrigger = "Idle";

        [Header("Animation Settings")]
        [SerializeField] private float gestureDuration = 2.0f;

        private string currentGesture = "idle";
        private Coroutine gestureCoroutine;

        void Start()
        {
            if (animator == null)
            {
                animator = GetComponentInChildren<Animator>();
            }

            if (animator == null)
            {
                Debug.LogWarning("⚠️ No Animator found for gesture controller");
            }
        }

        /// <summary>
        /// Play gesture from marker
        /// </summary>
        public void PlayGesture(string gestureValue)
        {
            if (animator == null) return;

            string normalizedGesture = gestureValue.ToLower();

            // Map common gesture values
            if (normalizedGesture.Contains("wave") || normalizedGesture.Contains("hello"))
            {
                TriggerGesture(waveTrigger, "wave");
            }
            else if (normalizedGesture.Contains("point"))
            {
                TriggerGesture(pointTrigger, "point");
            }
            else if (normalizedGesture.Contains("nod") || normalizedGesture.Contains("yes"))
            {
                TriggerGesture(nodTrigger, "nod");
            }
            else if (normalizedGesture.Contains("shake") || normalizedGesture.Contains("no"))
            {
                TriggerGesture(shakeTrigger, "shake");
            }
            else
            {
                // Default to idle
                TriggerGesture(idleTrigger, "idle");
            }
        }

        /// <summary>
        /// Trigger gesture animation
        /// </summary>
        private void TriggerGesture(string triggerName, string gestureName)
        {
            if (gestureCoroutine != null)
            {
                StopCoroutine(gestureCoroutine);
            }

            if (animator != null)
            {
                animator.SetTrigger(triggerName);
                currentGesture = gestureName;
                Debug.Log($"✅ Playing gesture: {gestureName}");

                // Return to idle after gesture duration
                gestureCoroutine = StartCoroutine(ReturnToIdleAfterDelay());
            }
        }

        /// <summary>
        /// Return to idle animation after gesture completes
        /// </summary>
        private IEnumerator ReturnToIdleAfterDelay()
        {
            yield return new WaitForSeconds(gestureDuration);

            if (animator != null && currentGesture != "idle")
            {
                animator.SetTrigger(idleTrigger);
                currentGesture = "idle";
            }
        }

        /// <summary>
        /// Play idle animation
        /// </summary>
        public void PlayIdle()
        {
            if (animator != null)
            {
                animator.SetTrigger(idleTrigger);
                currentGesture = "idle";
            }
        }

        /// <summary>
        /// Stop current gesture
        /// </summary>
        public void StopGesture()
        {
            if (gestureCoroutine != null)
            {
                StopCoroutine(gestureCoroutine);
            }
            PlayIdle();
        }
    }
}

