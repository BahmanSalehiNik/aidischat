using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AIChatAR.AR
{
    /// <summary>
    /// Lip Sync Controller - handles viseme-based lip synchronization
    /// Matches React Native viseme generation functionality
    /// </summary>
    public class LipSyncController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private SkinnedMeshRenderer faceMeshRenderer;

        [Header("Blendshape Configuration")]
        [SerializeField] private string[] visemeBlendshapeNames = new string[]
        {
            "viseme_silence",    // 0
            "viseme_aa_ao_aw",   // 1
            "viseme_aa",          // 2
            "viseme_aa_ao",       // 3
            "viseme_eh_er",       // 4
            "viseme_ih_iy",       // 5
            "viseme_ow_oy",       // 6
            "viseme_uw",          // 7
            "viseme_m_b_p",       // 8
            "viseme_f_v",         // 9
            "viseme_th_dh",       // 10
            "viseme_t_d_n_l",     // 11
            "viseme_s_z",         // 12
            "viseme_sh_ch_jh_zh", // 13
            "viseme_k_g_ng",      // 14
            "viseme_y",           // 15
            "viseme_w",           // 16
            "viseme_r",           // 17
            "viseme_l",           // 18
            "viseme_th",          // 19
            "viseme_th_alt",      // 20
            "viseme_silence_end"  // 21
        };

        private Dictionary<int, int> visemeToBlendshapeIndex = new Dictionary<int, int>();
        private Coroutine lipSyncCoroutine;
        private bool isInitialized = false;

        /// <summary>
        /// Viseme IDs matching React Native VisemeId enum
        /// </summary>
        public enum VisemeId
        {
            SILENCE = 0,
            AA_AO_AW = 1,
            AA = 2,
            AA_AO = 3,
            EH_ER = 4,
            IH_IY = 5,
            OW_OY = 6,
            UW = 7,
            M_B_P = 8,
            F_V = 9,
            TH_DH = 10,
            T_D_N_L = 11,
            S_Z = 12,
            SH_CH_JH_ZH = 13,
            K_G_NG = 14,
            Y = 15,
            W = 16,
            R = 17,
            L = 18,
            TH = 19,
            TH_ALT = 20,
            SILENCE_END = 21
        }

        /// <summary>
        /// Viseme data with timing
        /// </summary>
        [System.Serializable]
        public class VisemeData
        {
            public VisemeId id;
            public float offset;    // Start time in seconds
            public float duration;  // Duration in seconds
        }

        void Start()
        {
            InitializeBlendshapeMapping();
        }

        /// <summary>
        /// Initialize blendshape mapping from viseme IDs to blendshape indices
        /// </summary>
        private void InitializeBlendshapeMapping()
        {
            if (faceMeshRenderer == null)
            {
                faceMeshRenderer = GetComponentInChildren<SkinnedMeshRenderer>();
            }

            if (faceMeshRenderer == null)
            {
                Debug.LogWarning("⚠️ No SkinnedMeshRenderer found for lip sync");
                return;
            }

            Mesh mesh = faceMeshRenderer.sharedMesh;
            if (mesh == null)
            {
                Debug.LogWarning("⚠️ No mesh found on SkinnedMeshRenderer");
                return;
            }

            // Helpful diagnostics: dump the blendshape names on the chosen renderer.
            BlendshapeDebugUtil.DumpRendererBlendshapes(faceMeshRenderer, "LipSyncController selected faceMeshRenderer");

            // Map viseme IDs to blendshape indices
            for (int visemeId = 0; visemeId < visemeBlendshapeNames.Length; visemeId++)
            {
                string blendshapeName = visemeBlendshapeNames[visemeId];
                int blendshapeIndex = GetBlendshapeIndex(mesh, blendshapeName);
                
                if (blendshapeIndex >= 0)
                {
                    visemeToBlendshapeIndex[visemeId] = blendshapeIndex;
                }
                else
                {
                    Debug.LogWarning($"⚠️ Blendshape '{blendshapeName}' not found in mesh");
                }
            }

            isInitialized = visemeToBlendshapeIndex.Count > 0;
            if (isInitialized)
            {
                Debug.Log($"✅ Lip sync initialized with {visemeToBlendshapeIndex.Count} viseme mappings");
            }
        }

        /// <summary>
        /// Get blendshape index by name (case-insensitive partial match)
        /// </summary>
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
        /// Play lip sync with viseme data - matches React Native viseme playback
        /// </summary>
        public void PlayLipSync(List<VisemeData> visemes, float audioDuration)
        {
            if (!isInitialized)
            {
                Debug.LogWarning("⚠️ Lip sync not initialized");
                return;
            }

            if (lipSyncCoroutine != null)
            {
                StopCoroutine(lipSyncCoroutine);
            }

            lipSyncCoroutine = StartCoroutine(LipSyncRoutine(visemes, audioDuration));
        }

        /// <summary>
        /// Play lip sync from viseme ID array with timing
        /// </summary>
        public void PlayLipSyncFromIds(int[] visemeIds, float[] timings, float totalDuration)
        {
            if (!isInitialized || visemeIds == null || visemeIds.Length == 0)
            {
                return;
            }

            List<VisemeData> visemes = new List<VisemeData>();
            for (int i = 0; i < visemeIds.Length; i++)
            {
                visemes.Add(new VisemeData
                {
                    id = (VisemeId)visemeIds[i],
                    offset = i < timings.Length ? timings[i] : (float)i / visemeIds.Length * totalDuration,
                    duration = totalDuration / visemeIds.Length
                });
            }

            PlayLipSync(visemes, totalDuration);
        }

        /// <summary>
        /// Lip sync coroutine
        /// </summary>
        private IEnumerator LipSyncRoutine(List<VisemeData> visemes, float duration)
        {
            float elapsed = 0f;
            int currentIndex = 0;

            // Reset all blendshapes
            ResetBlendshapes();

            while (elapsed < duration && currentIndex < visemes.Count)
            {
                // Find next viseme
                while (currentIndex < visemes.Count - 1 && visemes[currentIndex + 1].offset <= elapsed)
                {
                    currentIndex++;
                }

                // Apply current viseme
                if (currentIndex < visemes.Count)
                {
                    VisemeData viseme = visemes[currentIndex];
                    int visemeId = (int)viseme.id;

                    if (visemeToBlendshapeIndex.ContainsKey(visemeId))
                    {
                        int blendshapeIndex = visemeToBlendshapeIndex[visemeId];
                        faceMeshRenderer.SetBlendShapeWeight(blendshapeIndex, 100f);
                    }
                }

                // Update at 60fps for smooth animation
                yield return new WaitForSeconds(1f / 60f);
                elapsed += 1f / 60f;
            }

            // Reset all blendshapes at end
            ResetBlendshapes();
        }

        /// <summary>
        /// Reset all blendshapes to 0
        /// </summary>
        private void ResetBlendshapes()
        {
            if (faceMeshRenderer == null) return;

            Mesh mesh = faceMeshRenderer.sharedMesh;
            if (mesh == null) return;

            for (int i = 0; i < mesh.blendShapeCount; i++)
            {
                faceMeshRenderer.SetBlendShapeWeight(i, 0f);
            }
        }

        /// <summary>
        /// Stop current lip sync
        /// </summary>
        public void StopLipSync()
        {
            if (lipSyncCoroutine != null)
            {
                StopCoroutine(lipSyncCoroutine);
                lipSyncCoroutine = null;
            }
            ResetBlendshapes();
        }
    }
}

