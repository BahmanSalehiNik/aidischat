using System;
using System.Collections;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.XR.ARFoundation;
using Unity.XR.CoreUtils;
using AIChatAR.Models;
using AIChatAR.API;
using GLTFast;
using System.Collections.Generic;

namespace AIChatAR.AR
{
    /// <summary>
    /// Avatar Loader - matches React Native AvatarViewer functionality
    /// Handles avatar status checking, polling, and model loading
    /// </summary>
    public class AvatarLoader : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private string agentId;
        [SerializeField] private float pollInterval = 2.0f;
        [SerializeField] private Material baseMaterial; // Drag a URP/Lit material here!

        [Header("References")]
        [SerializeField] private Transform avatarParent;
        [SerializeField] private AvatarAPI avatarAPI;

        // State
        private AvatarStatus currentStatus;
        private GameObject loadedAvatar;
        private Coroutine statusPollCoroutine;
        private Coroutine loadModelCoroutine;
        private bool isPolling = false;
        private bool autoStartOnEnable = false; // Set to true if you want auto-start behavior

        // Animation GLB URLs (separate files; stored only — base model remains default)
        private readonly List<string> animationUrls = new List<string>();
        private bool autoPlayLegacyAnimationOnNextLoad = false;
        private string autoPlayLegacyAnimationName = null;

        // Events
        public System.Action<AvatarStatus> OnStatusChanged;
        public System.Action<GameObject> OnAvatarLoaded;
        public System.Action<string> OnError;

        // DEBUG GUI
        private string debugMessage = "AvatarLoader: Initializing...";
        private GUIStyle debugStyle;

        void OnGUI()
        {
            if (debugStyle == null)
            {
                debugStyle = new GUIStyle();
                debugStyle.fontSize = 40;
                debugStyle.normal.textColor = Color.red;
                debugStyle.wordWrap = true;
            }
            GUI.Label(new Rect(20, 20, Screen.width - 40, 600), debugMessage, debugStyle);

            // NOTE: Hardcoded test URLs removed. Use Meshy/Azure-provided URLs (deeplink / backend) instead.

            // Button: switch to idle animation GLB (if provided via SetAnimationUrls)
            if (GUI.Button(new Rect(20, Screen.height - 160, 380, 110), "LOAD IDLE GLB"))
            {
                LoadIdleGlb();
            }
        }

        /// <summary>
        /// Receive animation GLB URLs (e.g. idle/talking/walking) from deep link or status endpoint.
        /// This does NOT auto-load animations; it only stores them for button-triggered loading.
        /// </summary>
        public void SetAnimationUrls(string[] urls)
        {
            animationUrls.Clear();
            if (urls == null) return;
            foreach (var u in urls)
            {
                if (!string.IsNullOrEmpty(u)) animationUrls.Add(u);
            }
            Debug.Log($"🎞️ [AvatarLoader] Stored animation URLs: {animationUrls.Count}");
        }

        private void LoadIdleGlb()
        {
            // Find a URL whose embedded name is "idle" (backend uploads as: {agentId}_anim_{name}_{timestamp}.glb)
            string idleUrl = null;
            foreach (var u in animationUrls)
            {
                var name = TryExtractAnimNameFromUrl(u);
                if (string.Equals(name, "idle", StringComparison.OrdinalIgnoreCase))
                {
                    idleUrl = u;
                    break;
                }
            }

            if (string.IsNullOrEmpty(idleUrl))
            {
                Debug.LogWarning("⚠️ [AvatarLoader] No idle animation URL available. Make sure backend returned animationUrls[] and it includes an 'idle' clip.");
                debugMessage = "No idle URL";
                return;
            }

            Debug.Log($"🎞️ [AvatarLoader] Loading IDLE GLB URL: {idleUrl}");
            debugMessage = "Loading IDLE GLB...";
            // When loading the idle GLB, auto-play its animation using Unity's legacy Animation component.
            autoPlayLegacyAnimationOnNextLoad = true;
            autoPlayLegacyAnimationName = "idle";
            LoadModelFromUrl(idleUrl);
        }

        private static string TryExtractAnimNameFromUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            try
            {
                // Strip query
                var clean = url;
                var q = clean.IndexOf('?');
                if (q >= 0) clean = clean.Substring(0, q);
                var lastSlash = clean.LastIndexOf('/');
                var filename = lastSlash >= 0 ? clean.Substring(lastSlash + 1) : clean;

                // Find "_anim_" marker: {agentId}_anim_{name}_{timestamp}.glb
                var marker = "_anim_";
                var idx = filename.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (idx < 0) return null;
                var after = filename.Substring(idx + marker.Length);
                var nextUnderscore = after.IndexOf('_');
                if (nextUnderscore <= 0) return null;
                return after.Substring(0, nextUnderscore).ToLowerInvariant();
            }
            catch
            {
                return null;
            }
        }

        void Start()
        {
            if (avatarAPI == null)
            {
                avatarAPI = FindObjectOfType<AvatarAPI>();
            }

            // Auto-start if agentId is set (restored to fix "Waiting for start" issue)
            if (!string.IsNullOrEmpty(agentId))
            {
                Debug.Log($"ℹ️ [AvatarLoader] AvatarLoader initialized with agentId: {agentId}. Starting polling...");
                StartPollingStatus();
            }
            else
            {
                Debug.Log("ℹ️ [AvatarLoader] AvatarLoader initialized. Waiting for agentId or model URL...");
            }
        }

        void OnEnable()
        {
            // Auto-start if agentId is set and not already polling (restored to fix "Waiting for start" issue)
            if (!string.IsNullOrEmpty(agentId) && !isPolling)
            {
                Debug.Log($"ℹ️ [AvatarLoader] OnEnable: Starting polling for agentId: {agentId}");
                StartPollingStatus();
            }
        }

        void OnDisable()
        {
            // Stop polling when GameObject is disabled (viewer closed)
            StopPollingStatus();
        }

        /// <summary>
        /// Start polling for avatar status - matches checkAvatarStatus() in React Native
        /// Call this explicitly when the viewer opens (not automatically in Start())
        /// </summary>
        public void StartPollingStatus()
        {
            if (isPolling)
            {
                Debug.LogWarning("⚠️ Already polling avatar status");
                return;
            }

            if (string.IsNullOrEmpty(agentId))
            {
                Debug.LogError("❌ Cannot start polling: agentId not set");
                return;
            }

            isPolling = true;
            if (statusPollCoroutine != null)
            {
                StopCoroutine(statusPollCoroutine);
            }
            statusPollCoroutine = StartCoroutine(PollStatusCoroutine());
            Debug.Log($"🔄 Started polling avatar status for agent: {agentId}");
        }

        /// <summary>
        /// Stop polling for avatar status
        /// Call this when the viewer closes or cleanup is needed
        /// </summary>
        public void StopPollingStatus()
        {
            if (!isPolling)
            {
                return; // Already stopped
            }

            isPolling = false;
            if (statusPollCoroutine != null)
            {
                StopCoroutine(statusPollCoroutine);
                statusPollCoroutine = null;
            }
            Debug.Log("⏹️ Stopped polling avatar status");
        }

        private IEnumerator PollStatusCoroutine()
        {
            while (true)
            {
                bool statusReceived = false;
                AvatarStatus status = null;
                string error = null;

                avatarAPI.GetAvatarStatus(agentId,
                    (s) => {
                        status = s;
                        statusReceived = true;
                    },
                    (e) => {
                        error = e;
                        statusReceived = true;
                    }
                );

                yield return new WaitUntil(() => statusReceived);

                if (error != null)
                {
                    Debug.LogError($"❌ Error checking avatar status: {error}");
                    OnError?.Invoke(error);
                    yield break;
                }

                if (status != null)
                {
                    currentStatus = status;
                    OnStatusChanged?.Invoke(status);

                    // Store animation GLB URLs if backend provides them (base model is still the default).
                    // This enables the "LOAD IDLE GLB" button without requiring animation URLs in the deep link.
                    if (status.animationUrls != null && status.animationUrls.Length > 0)
                    {
                        SetAnimationUrls(status.animationUrls);
                    }

                    if (status.status == "ready" && !string.IsNullOrEmpty(status.modelUrl))
                    {
                        // Get download URL and load model
                        isPolling = false; // Stop polling before loading
                        LoadModel();
                        yield break; // Stop polling
                    }
                    else if (status.status == "failed")
                    {
                        Debug.LogError($"❌ Avatar generation failed: {status.error}");
                        OnError?.Invoke(status.error ?? "Avatar generation failed");
                        yield break;
                    }
                }

                // Poll every interval if still generating
                if (currentStatus == null || currentStatus.status == "generating" || currentStatus.status == "pending")
                {
                    yield return new WaitForSeconds(pollInterval);
                }
                else
                {
                    yield break;
                }
            }
        }

        /// <summary>
        /// Load model from URL - matches getDownloadUrl() and model loading in React Native
        /// </summary>
        private void LoadModel()
        {
            if (loadModelCoroutine != null)
            {
                StopCoroutine(loadModelCoroutine);
            }
            loadModelCoroutine = StartCoroutine(LoadModelCoroutine());
        }

        /// <summary>
        /// Load model directly from URL (from deep link) - skips API call for faster loading
        /// </summary>
        public void LoadModelFromUrl(string url)
        {
            // MODIFICATION vs backup:
            // Do NOT force a hardcoded test URL. Use the URL passed in (Meshy/Azure).

            if (string.IsNullOrEmpty(url))
            {
                Debug.LogError("❌ [AvatarLoader] Cannot load model: URL is empty");
                OnError?.Invoke("Model URL is empty");
                return;
            }

            // Check if AR session is initialized
            var arSession = FindObjectOfType<ARSession>();
            if (arSession == null)
            {
                Debug.LogWarning("⚠️ [AvatarLoader] AR Session not found! Model may not be visible. Make sure AR Session is in the scene.");
            }
            else
            {
                Debug.Log($"✅ [AvatarLoader] AR Session found: {arSession.name}, State: {arSession.subsystem?.running ?? false}");
            }

            // Check for AR origin
            var xrOrigin = FindObjectOfType<XROrigin>();
            var arSessionOrigin = FindObjectOfType<ARSessionOrigin>();
            if (xrOrigin == null && arSessionOrigin == null)
            {
                Debug.LogWarning("⚠️ [AvatarLoader] No XR Origin or AR Session Origin found! Model may not be positioned correctly.");
            }

            // Ensure URL is properly decoded
            // Do NOT unescape the URL here. It has already been unescaped by DeepLinkHandler (if coming from deep link)
            // or API (if coming from backend).
            // Further unescaping will corrupt SAS tokens (converting %2B to + which is then interpreted as space, etc.)
            string decodedUrl = url;

            Debug.Log($"📥 [AvatarLoader] Loading model directly from URL: {decodedUrl}");
            Debug.Log($"📥 [AvatarLoader] Original URL: {url}");
            Debug.Log($"📥 [AvatarLoader] URL validation - Length: {decodedUrl.Length}, Starts with https: {decodedUrl.StartsWith("https://")}");
            Debug.Log($"📥 [AvatarLoader] AvatarParent: {(avatarParent != null ? avatarParent.name : "null")}");
            Debug.Log($"📥 [AvatarLoader] GameObject active: {gameObject.activeInHierarchy}");
            Debug.Log($"📥 [AvatarLoader] GameObject name: {gameObject.name}");

            if (loadModelCoroutine != null)
            {
                Debug.Log("⚠️ [AvatarLoader] Stopping previous load coroutine");
                StopCoroutine(loadModelCoroutine);
            }

            Debug.Log("📥 [AvatarLoader] Starting LoadGLBModel coroutine...");

            // Wait for AR session to initialize, then load model
            StartCoroutine(WaitForARAndLoad(decodedUrl));
        }

        /// <summary>
        /// Wait for AR session to initialize, then load model
        /// </summary>
        private IEnumerator WaitForARAndLoad(string url)
        {
            // Wait a few frames for AR session to initialize
            yield return new WaitForEndOfFrame();
            yield return new WaitForEndOfFrame();

            // Check AR session
            var arSession = FindObjectOfType<ARSession>();
            int waitFrames = 0;
            int maxWaitFrames = 300; // Wait up to 5 seconds (60fps * 5)

            // Wait for AR session to exist
            while (arSession == null && waitFrames < maxWaitFrames)
            {
                yield return null;
                waitFrames++;
                arSession = FindObjectOfType<ARSession>();
            }

            if (arSession == null)
            {
                Debug.LogWarning("⚠️ [AvatarLoader] AR Session not found after waiting, but proceeding with model load anyway");
            }
            else
            {
                Debug.Log($"✅ [AvatarLoader] AR Session found after {waitFrames} frames");

                // Wait for AR session to be tracking (optional - don't wait too long)
                int trackingWaitFrames = 0;
                int maxTrackingWait = 120; // Wait up to 2 seconds for tracking
                while (ARSession.state != ARSessionState.SessionTracking &&
                       ARSession.state != ARSessionState.SessionInitializing &&
                       trackingWaitFrames < maxTrackingWait)
                {
                    yield return null;
                    trackingWaitFrames++;
                }

                if (ARSession.state == ARSessionState.SessionTracking)
                {
                    Debug.Log($"✅ [AvatarLoader] AR Session is tracking after {trackingWaitFrames} frames");
                }
                else if (ARSession.state == ARSessionState.SessionInitializing)
                {
                    Debug.Log($"ℹ️ [AvatarLoader] AR Session is initializing (state: {ARSession.state}), proceeding with model load");
                }
                else
                {
                    Debug.LogWarning($"⚠️ [AvatarLoader] AR Session state is {ARSession.state}, proceeding with model load anyway");
                }
            }

            // Now load the model
            Debug.Log("📥 [AvatarLoader] Starting model load coroutine...");
            loadModelCoroutine = StartCoroutine(LoadGLBModel(url));
        }

        private IEnumerator LoadModelCoroutine()
        {
            bool urlReceived = false;
            AvatarDownloadUrl downloadUrl = null;
            string error = null;

            avatarAPI.GetDownloadUrl(agentId,
                (url) => {
                    downloadUrl = url;
                    urlReceived = true;
                },
                (e) => {
                    error = e;
                    urlReceived = true;
                },
                900
            );

            yield return new WaitUntil(() => urlReceived);

            if (error != null || downloadUrl == null || string.IsNullOrEmpty(downloadUrl.url))
            {
                Debug.LogError($"❌ Failed to get download URL: {error}");
                OnError?.Invoke(error ?? "Failed to get download URL");
                yield break;
            }

            Debug.Log($"📥 Loading model from Azure: {downloadUrl.url}");
            Debug.Log($"📦 Format: {downloadUrl.format}, Type: {downloadUrl.modelType}");
            Debug.Log($"⏰ URL expires in: {downloadUrl.expiresIn} seconds");

            // Load GLB/GLTF model using GLTFast
            // GLTFast will download directly from Azure Blob Storage using the signed URL
            // Note: This requires GLTFast package to be installed
            yield return LoadGLBModel(downloadUrl.url);
        }

        /// <summary>
        /// Coroutine to load GLB/GLTF model using Unity's glTFast
        /// Replaced async Task with Coroutine to avoid synchronization context stalls
        /// </summary>
        private IEnumerator LoadGLBModel(string url)
        {
            Debug.Log($"📥 [AvatarLoader] Starting LoadGLBModel Coroutine with URL: {url}");
            debugMessage = "Coroutine Started...";
            yield return null;

            // Backup behavior: safe shader fallback for forced visibility
            Shader safeShader = Shader.Find("Unlit/Color");
            if (safeShader == null) safeShader = Shader.Find("Mobile/Diffuse");
            if (safeShader == null) safeShader = Shader.Find("Standard");
            if (safeShader == null) safeShader = Shader.Find("Sprites/Default");
            if (safeShader == null) safeShader = Shader.Find("UI/Default");

            // --- CLEANUP & SETUP (PURPLE) ---
            try
            {
                debugMessage = "Cleaning up...";
                if (loadedAvatar != null) Destroy(loadedAvatar);

                loadedAvatar = new GameObject("Avatar");

                debugMessage = "Setting up Transform...";
                SetupAvatarTransform(); // Helper method for positioning - CRITICAL: Called BEFORE downloading

                // MODIFICATION vs backup:
                // Sphere/debugSphere removed.
                debugMessage = "Initializing...";
            }
            catch (System.Exception e)
            {
                Debug.LogError($"❌ [AvatarLoader] Crash in Setup: {e}");
                debugMessage = $"CRASH in Setup:\n{e.Message}";
                yield break;
            }

            yield return null; // Wait one frame to ensure UI updates

            // Detect format from URL (Azure SAS URLs include query strings, so strip ?/# first)
            string urlNoQuery = url;
            int q = urlNoQuery.IndexOf('?');
            if (q >= 0) urlNoQuery = urlNoQuery.Substring(0, q);
            int h = urlNoQuery.IndexOf('#');
            if (h >= 0) urlNoQuery = urlNoQuery.Substring(0, h);

            bool isGLTF = urlNoQuery.EndsWith(".gltf", System.StringComparison.OrdinalIgnoreCase);
            bool isGLB = urlNoQuery.EndsWith(".glb", System.StringComparison.OrdinalIgnoreCase);

            var gltf = new GltfImport();
            Task<bool> loadTask;
            bool success = false;

            if (isGLTF)
            {
                // GLTF format (JSON + separate files) - use Load with URL directly
                // GLTFast will automatically download the .gltf file and all referenced resources (bin, textures)
                Debug.Log("📦 [AvatarLoader] Detected GLTF format (JSON + separate textures)");
                Debug.Log($"📦 [AvatarLoader] Loading GLTF directly from URL: {url}");

                // --- STEP 1: LOAD (BLUE) ---
                debugMessage = $"Loading GLTF from\n{url}";

                // For GLTF files, GLTFast can load directly from URL
                // It will automatically resolve relative paths for .bin files and textures
                loadTask = gltf.Load(url);
                while (!loadTask.IsCompleted) yield return null;

                success = loadTask.Result;
            }
            else if (isGLB)
            {
                // GLB format (binary, embedded textures) - download first, then load
                Debug.Log("📦 [AvatarLoader] Detected GLB format (binary, embedded textures)");

                // --- STEP 1: DOWNLOAD (BLUE) ---
                Debug.Log($"📥 [AvatarLoader] Starting Download...");
                debugMessage = $"Downloading...\n{url}";

                byte[] modelData = null;

                using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
                {
                    yield return webRequest.SendWebRequest(); // Standard Coroutine Wait

                    if (webRequest.result != UnityWebRequest.Result.Success)
                    {
                        Debug.LogError($"❌ [AvatarLoader] Network Error: {webRequest.error}");
                        OnError?.Invoke($"Network Error: {webRequest.error}");
                        debugMessage = $"Network Error:\n{webRequest.error}";
                        yield break;
                    }

                    Debug.Log($"✅ [AvatarLoader] Download Success! {webRequest.downloadHandler.data.Length} bytes received.");
                    modelData = webRequest.downloadHandler.data;
                }

                if (modelData == null || modelData.Length == 0)
                {
                    Debug.LogError("❌ [AvatarLoader] Downloaded data is empty");
                    debugMessage = "Data Empty";
                    yield break;
                }

                // --- STEP 2: PARSE & LOAD (CYAN) ---
                debugMessage = $"Parsing {modelData.Length} bytes...";
                Debug.Log($"📥 [AvatarLoader] Loading {modelData.Length} bytes into glTFast...");

                // Bridge Async Task to Coroutine
                loadTask = gltf.LoadGltfBinary(modelData);
                while (!loadTask.IsCompleted) yield return null;

                success = loadTask.Result;
            }
            else
            {
                Debug.LogError($"❌ [AvatarLoader] Unknown format. URL must end with .gltf or .glb");
                OnError?.Invoke("Unknown model format");
                debugMessage = "Unknown Format";
                yield break;
            }

            if (!success)
            {
                string formatType = isGLTF ? "GLTF" : "GLB";
                Debug.LogError($"❌ [AvatarLoader] glTFast.Load{formatType} returned false.");
                OnError?.Invoke($"Failed to parse {formatType} 3D model data");
                debugMessage = $"Parse Failed ({formatType})";
            }
            else
            {
                // --- STEP 3: INSTANTIATE (YELLOW) ---
                debugMessage = "Instantiating...";
                Debug.Log("📥 [AvatarLoader] Instantiating scene...");

                // IMPORTANT: Disable glTFast's automatic Animation component wiring during instantiation.
                // On some devices/GLBs, GLTFast.GameObjectInstantiator.AddAnimation can throw and prevent playback.
                // We'll instantiate meshes/skeleton only, then play the clip ourselves via legacy `Animation`.
                var instantiationSettings = new InstantiationSettings();
                instantiationSettings.Mask = ComponentType.All & ~ComponentType.Animation;
                var instantiator = new GameObjectInstantiator(gltf, loadedAvatar.transform, null, instantiationSettings);

                var instantiateTask = gltf.InstantiateMainSceneAsync(instantiator);
                while (!instantiateTask.IsCompleted) yield return null;

                bool instantiateSuccess = instantiateTask.Result;

                if (instantiateSuccess)
                {
                    Debug.Log($"✅ [AvatarLoader] Avatar instantiated successfully!");

                    // Use the scene root created by glTFast (may be the parent itself or a child "Scene")
                    var sceneRoot = instantiator.SceneTransform != null ? instantiator.SceneTransform.gameObject : loadedAvatar;

                    // Dump blendshape names to help identify viseme/emotion targets on Meshy models.
                    // This is safe even if the model has no blendshapes (it will log a warning/summary).
                    BlendshapeDebugUtil.DumpAllBlendshapes(sceneRoot, "After GLB instantiate (AvatarLoader)");
                    BlendshapeDebugUtil.DumpRigHints(sceneRoot, "After GLB instantiate (AvatarLoader)");

                    // If we intentionally loaded an animation GLB (e.g. idle), auto-play its embedded clip
                    // using Unity legacy Animation component (not Animator).
                    if (autoPlayLegacyAnimationOnNextLoad)
                    {
                        TryPlayLegacyAnimationFromGltf(gltf, sceneRoot, autoPlayLegacyAnimationName);
                        autoPlayLegacyAnimationOnNextLoad = false;
                        autoPlayLegacyAnimationName = null;
                    }

                    // --- FORCE VISIBILITY (GREEN) ---
                    var renderers = sceneRoot.GetComponentsInChildren<Renderer>();
                    if (renderers.Length > 0)
                    {
                        Bounds totalBounds = new Bounds(renderers[0].transform.position, Vector3.zero);
                        foreach (var r in renderers)
                        {

                            // Force a visible material only if we have a valid shader on this device/build.
                            // Some Android builds strip unused shaders, so Shader.Find can return null.

                                Material debugMat = new Material(safeShader);
                                debugMat.color = new Color(1f, 0.5f, 0f); // ORANGE
                                r.material = debugMat;


                            totalBounds.Encapsulate(r.bounds);
                        }

                        // Force Scale to 1m
                        float maxDim = Mathf.Max(totalBounds.size.x, totalBounds.size.y, totalBounds.size.z);
                        if (maxDim > 0)
                        {
                            float scaleFactor = 1.0f / maxDim;
                            loadedAvatar.transform.localScale = Vector3.one * scaleFactor;
                        }

                        debugMessage = $"Success! Scale={maxDim}m -> 1m. Look for ORANGE.";
                    }
                    else
                    {
                        Debug.LogError("❌ [AvatarLoader] No Renderers found!");
                        debugMessage = "Success but EMPTY (No Renderers)";
                    }

                    OnAvatarLoaded?.Invoke(loadedAvatar);
                }
                else
                {
                    Debug.LogError("❌ [AvatarLoader] Failed to instantiate scene");
                    debugMessage = "Instantiate Failed";
                }
            }
            gltf.Dispose();

            // Clear coroutine reference when done
            loadModelCoroutine = null;
        }

        private void TryPlayLegacyAnimationFromGltf(GltfImport gltf, GameObject root, string preferredName)
        {
            if (gltf == null || root == null) return;
            try
            {
                // Requires glTFast animation support. If not enabled, this will be empty.
                var clips = gltf.GetAnimationClips();
                if (clips == null || clips.Length == 0)
                {
                    Debug.LogWarning("⚠️ [AvatarLoader] No animation clips found in this GLB. Ensure glTFast animation support is enabled in the project.");
                    return;
                }

                // Use first clip (Meshy animation GLBs typically contain a single clip).
                var clip = clips[0];
                if (clip == null)
                {
                    Debug.LogWarning("⚠️ [AvatarLoader] Animation clip[0] was null.");
                    return;
                }

                string clipName = !string.IsNullOrEmpty(preferredName) ? preferredName : (string.IsNullOrEmpty(clip.name) ? "clip0" : clip.name);

                // Legacy Animation component requires legacy clips.
                clip.legacy = true;
                clip.wrapMode = WrapMode.Loop;

                var anim = root.GetComponent<Animation>();
                if (anim == null) anim = root.AddComponent<Animation>();

                // Add + play
                if (anim.GetClip(clipName) == null)
                {
                    anim.AddClip(clip, clipName);
                }
                anim.clip = anim.GetClip(clipName);
                anim.Play(clipName);

                Debug.Log($"✅ [AvatarLoader] Playing legacy animation clip: {clipName}");
                debugMessage = $"Playing: {clipName}";
            }
            catch (Exception e)
            {
                Debug.LogWarning($"⚠️ [AvatarLoader] Failed to play legacy animation: {e.Message}");
            }
        }

        private void SetupAvatarTransform()
        {
            // Position avatar in AR space
            Transform parentTransform = null;
            Vector3 targetLocalPosition = Vector3.zero;
            Quaternion targetLocalRotation = Quaternion.identity;

            var xrOrigin = FindObjectOfType<XROrigin>();
            var arSessionOrigin = FindObjectOfType<ARSessionOrigin>();
            var mainCamera = Camera.main;

            if (xrOrigin != null && xrOrigin.Origin != null)
            {
                parentTransform = xrOrigin.Origin.transform;
                if (mainCamera != null)
                {
                    Vector3 cameraPos = mainCamera.transform.position;
                    Vector3 cameraForward = mainCamera.transform.forward;
                    cameraForward.y = 0;
                    cameraForward.Normalize();
                    Vector3 worldPos = cameraPos + (cameraForward * 1.5f);
                    targetLocalPosition = parentTransform.InverseTransformPoint(worldPos);
                    targetLocalRotation = Quaternion.LookRotation(-cameraForward);
                }
                else
                {
                    targetLocalPosition = new Vector3(0f, 0f, 1.5f);
                }
            }
            else if (arSessionOrigin != null && arSessionOrigin.trackablesParent != null)
            {
                parentTransform = arSessionOrigin.trackablesParent;
                if (mainCamera != null)
                {
                    Vector3 cameraPos = mainCamera.transform.position;
                    Vector3 cameraForward = mainCamera.transform.forward;
                    cameraForward.y = 0;
                    cameraForward.Normalize();
                    Vector3 worldPos = cameraPos + (cameraForward * 1.5f);
                    targetLocalPosition = parentTransform.InverseTransformPoint(worldPos);
                    targetLocalRotation = Quaternion.LookRotation(-cameraForward);
                }
                else
                {
                    targetLocalPosition = new Vector3(0f, -0.5f, 1.5f);
                }
            }
            else if (mainCamera != null)
            {
                parentTransform = null;
                Vector3 cameraPos = mainCamera.transform.position;
                Vector3 cameraForward = mainCamera.transform.forward;
                targetLocalPosition = cameraPos + (cameraForward * 1.5f);
                Vector3 directionToCamera = cameraPos - targetLocalPosition;
                directionToCamera.y = 0;
                if (directionToCamera != Vector3.zero)
                    targetLocalRotation = Quaternion.LookRotation(directionToCamera);
            }
            else if (avatarParent != null)
            {
                parentTransform = avatarParent;
                targetLocalPosition = Vector3.forward * 1.5f;
            }
            else
            {
                parentTransform = transform;
                targetLocalPosition = Vector3.forward * 1.5f;
            }

            if (parentTransform != null)
                loadedAvatar.transform.SetParent(parentTransform);

            if (parentTransform != null)
            {
                loadedAvatar.transform.localPosition = targetLocalPosition;
                loadedAvatar.transform.localRotation = targetLocalRotation;
            }
            else
            {
                loadedAvatar.transform.position = targetLocalPosition;
                loadedAvatar.transform.rotation = targetLocalRotation;
            }

            loadedAvatar.transform.localScale = Vector3.one;
            if (!loadedAvatar.activeSelf) loadedAvatar.SetActive(true);
        }

        /// <summary>
        /// Set agent ID and start loading
        /// </summary>
        public void LoadAvatarForAgent(string newAgentId)
        {
            agentId = newAgentId;
            if (statusPollCoroutine != null)
            {
                StopCoroutine(statusPollCoroutine);
            }
            if (loadModelCoroutine != null)
            {
                StopCoroutine(loadModelCoroutine);
            }
            StartPollingStatus();
        }

        void OnDestroy()
        {
            StopPollingStatus();
            if (loadModelCoroutine != null)
            {
                StopCoroutine(loadModelCoroutine);
            }
        }

        /// <summary>
        /// Handle app pause (Android/iOS) - stop polling when app goes to background
        /// </summary>
        void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // App going to background - stop polling to save resources
                StopPollingStatus();
            }
        }

        /// <summary>
        /// Handle app quit - final cleanup
        /// </summary>
        void OnApplicationQuit()
        {
            StopPollingStatus();
        }
    }
}


