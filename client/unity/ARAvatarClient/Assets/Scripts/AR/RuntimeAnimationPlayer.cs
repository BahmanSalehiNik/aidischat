using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Animations;

namespace AIChatAR.AR
{
    /// <summary>
    /// Runtime animation player that can play imported AnimationClips without requiring AnimatorControllers.
    /// Designed for glTFast runtime-loaded clips (Generic/Transform animations).
    /// </summary>
    public class RuntimeAnimationPlayer : MonoBehaviour
    {
        [Header("Debug")]
        [SerializeField] private string currentClipName;

        private readonly Dictionary<string, AnimationClip> clips = new Dictionary<string, AnimationClip>(StringComparer.OrdinalIgnoreCase);

        private Animator animator;
        private Animation legacyAnimation;
        private PlayableGraph graph;
        private AnimationPlayableOutput output;
        private AnimationClipPlayable currentPlayable;
        private bool graphInitialized = false;

        private void Awake()
        {
            animator = GetComponentInChildren<Animator>();
            if (animator == null)
            {
                animator = gameObject.AddComponent<Animator>();
            }

            legacyAnimation = GetComponentInChildren<Animation>();
            if (legacyAnimation == null)
            {
                legacyAnimation = gameObject.AddComponent<Animation>();
            }
        }

        private void OnDisable()
        {
            DestroyGraph();
        }

        private void OnDestroy()
        {
            DestroyGraph();
        }

        private void EnsureGraph()
        {
            if (graphInitialized) return;

            graph = PlayableGraph.Create("RuntimeAnimationPlayer");
            graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            output = AnimationPlayableOutput.Create(graph, "AnimationOutput", animator);
            graphInitialized = true;
        }

        private void DestroyGraph()
        {
            if (graphInitialized && graph.IsValid())
            {
                graph.Destroy();
            }
            graphInitialized = false;
            currentClipName = null;
        }

        public void RegisterClip(string name, AnimationClip clip)
        {
            if (string.IsNullOrEmpty(name) || clip == null) return;

            // Normalize to lower-case canonical keys
            string key = name.Trim().ToLowerInvariant();
            clips[key] = clip;
        }

        public bool HasClip(string name)
        {
            if (string.IsNullOrEmpty(name)) return false;
            return clips.ContainsKey(name.Trim().ToLowerInvariant());
        }

        public void Play(string name, bool loop = true)
        {
            if (string.IsNullOrEmpty(name)) return;

            string key = name.Trim().ToLowerInvariant();
            if (!clips.TryGetValue(key, out var clip) || clip == null)
            {
                Debug.LogWarning($"⚠️ [RuntimeAnimationPlayer] Clip not found: {name}");
                return;
            }

            // glTFast currently yields LEGACY clips on device in this project.
            // Legacy clips cannot be used in Playables, so we play them via the legacy Animation component.
            if (clip.legacy)
            {
                clip.wrapMode = loop ? WrapMode.Loop : WrapMode.Once;
                if (legacyAnimation == null)
                {
                    legacyAnimation = gameObject.AddComponent<Animation>();
                }

                // Ensure the clip is registered on the Animation component.
                if (legacyAnimation.GetClip(key) == null)
                {
                    legacyAnimation.AddClip(clip, key);
                }

                legacyAnimation.wrapMode = clip.wrapMode;
                legacyAnimation.Play(key);
                currentClipName = key;
                Debug.Log($"🎬 [RuntimeAnimationPlayer] Playing LEGACY clip via Animation: {key} (loop={loop})");
                return;
            }

            // Non-legacy clips (if/when enabled) can use Playables.
            EnsureGraph();
            clip.wrapMode = loop ? WrapMode.Loop : WrapMode.Once;
            if (currentPlayable.IsValid())
            {
                currentPlayable.Destroy();
            }
            currentPlayable = AnimationClipPlayable.Create(graph, clip);
            currentPlayable.SetApplyFootIK(false);
            currentPlayable.SetApplyPlayableIK(false);
            output.SetSourcePlayable(currentPlayable);
            graph.Play();
            currentClipName = key;
            Debug.Log($"🎬 [RuntimeAnimationPlayer] Playing clip via Playables: {key} (loop={loop})");
        }
    }
}


