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
        private GameObject debugSphere;
        private Coroutine statusPollCoroutine;
        private Coroutine loadModelCoroutine;
        private bool isPolling = false;
        private bool autoStartOnEnable = false; // Set to true if you want auto-start behavior

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
            
            // MANUAL TEST BUTTON
            if (GUI.Button(new Rect(20, Screen.height - 150, 300, 100), "LOAD TEST MODEL"))
            {
               string testUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb";
               LoadModelFromUrl(testUrl);
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
            // HARDCODED OVERRIDE FOR DEBUGGING
            // Use a known-good public GLB (Astronaut from modelviewer.dev)
            url = "https://modelviewer.dev/shared-assets/models/Astronaut.glb";
            Debug.LogWarning($"⚠️ [AvatarLoader] FORCING HARDCODED TEST MODEL: {url}");

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
        /// Coroutine to load GLB model using Unity's glTFast
        /// Replaced async Task with Coroutine to avoid synchronization context stalls
        /// </summary>
        private IEnumerator LoadGLBModel(string url)
        {
            Debug.Log($"📥 [AvatarLoader] Starting LoadGLBModel Coroutine with URL: {url}");
            debugMessage = "Coroutine Started...";
            yield return null;
            
            Shader safeShader = Shader.Find("Unlit/Color");
            if (safeShader == null) safeShader = Shader.Find("Mobile/Diffuse");
            if (safeShader == null) safeShader = Shader.Find("Standard");

            // --- CLEANUP & SETUP (PURPLE) ---
            try 
            {
                debugMessage = "Cleaning up...";
                if (loadedAvatar != null) Destroy(loadedAvatar);
                if (debugSphere != null) Destroy(debugSphere);
                
                loadedAvatar = new GameObject("Avatar");
                
                debugMessage = "Setting up Transform...";
                SetupAvatarTransform(); // Helper method for positioning - CRITICAL: Called BEFORE downloading
                
                // Generate DEBUG SPHERE (Purple)
                Debug.LogWarning("⚠️ [AvatarLoader] Creating DEBUG_SPHERE (Pre-load)");
                debugSphere = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                debugSphere.name = "DEBUG_SPHERE";
                
                if (loadedAvatar.transform.parent != null)
                {
                    debugSphere.transform.SetParent(loadedAvatar.transform.parent);
                    debugSphere.transform.localPosition = loadedAvatar.transform.localPosition;
                }
                else
                {
                    debugSphere.transform.position = loadedAvatar.transform.position;
                }
                
                if (safeShader != null)
                {
                    Material sphereMaterial = new Material(safeShader);
                    if (debugSphere.GetComponent<Renderer>() != null)
                        debugSphere.GetComponent<Renderer>().material = sphereMaterial;
                }
                else
                {
                    Debug.LogWarning("⚠️ [AvatarLoader] No suitable shader found. Using default material.");
                }
                
                // SET STATE: PURPLE (Init)
                UpdateDebugState(new Color(0.5f, 0f, 0.5f), 0.5f, "Initializing (Purple)...");
            }
            catch (System.Exception e)
            {
                Debug.LogError($"❌ [AvatarLoader] Crash in Setup: {e}");
                debugMessage = $"CRASH in Setup:\n{e.Message}";
                yield break;
            }
            
            yield return null; // Wait one frame to ensure UI updates

            // --- STEP 1: DOWNLOAD (BLUE) ---
            Debug.Log($"📥 [AvatarLoader] Starting Download...");
            UpdateDebugState(Color.blue, 0.4f, $"Downloading from {url}..."); // BLUE = RETRIEVING
            
            byte[] modelData = null;
            
            using (UnityWebRequest webRequest = UnityWebRequest.Get(url))
            {
                yield return webRequest.SendWebRequest(); // Standard Coroutine Wait

                if (webRequest.result != UnityWebRequest.Result.Success)
                {
                    Debug.LogError($"❌ [AvatarLoader] Network Error: {webRequest.error}");
                    OnError?.Invoke($"Network Error: {webRequest.error}");
                    UpdateDebugState(Color.red, 0.6f, $"Network Error: {webRequest.error}"); // RED = FAIL
                    yield break;
                }
                
                Debug.Log($"✅ [AvatarLoader] Download Success! {webRequest.downloadHandler.data.Length} bytes received.");
                modelData = webRequest.downloadHandler.data;
            }
            
            if (modelData == null || modelData.Length == 0)
            {
                Debug.LogError("❌ [AvatarLoader] Downloaded data is empty");
                UpdateDebugState(Color.red, 0.6f, "Data Empty");
                yield break;
            }

            // --- STEP 2: PARSE & LOAD (CYAN) ---
            UpdateDebugState(Color.cyan, 0.3f, $"Parsing {modelData.Length} bytes..."); // CYAN = PARSING
            Debug.Log($"📥 [AvatarLoader] Loading {modelData.Length} bytes into glTFast...");
            
            var gltf = new GltfImport();
            
            // Bridge Async Task to Coroutine
            var loadTask = gltf.LoadGltfBinary(modelData);
            while (!loadTask.IsCompleted) yield return null;
            
            bool success = loadTask.Result;
            
            if (!success)
            {
                Debug.LogError($"❌ [AvatarLoader] glTFast.LoadGltfBinary returned false.");
                OnError?.Invoke("Failed to parse 3D model data");
                UpdateDebugState(Color.red, 0.6f, "Parse Failed");
            }
            else
            {
                // --- STEP 3: INSTANTIATE (YELLOW) ---
                UpdateDebugState(Color.yellow, 0.35f, "Instantiating...");
                Debug.Log("📥 [AvatarLoader] Instantiating scene...");
                
                var instantiateTask = gltf.InstantiateMainSceneAsync(loadedAvatar.transform);
                while (!instantiateTask.IsCompleted) yield return null;
                
                bool instantiateSuccess = instantiateTask.Result;
                
                if (instantiateSuccess)
                {
                    Debug.Log($"✅ [AvatarLoader] Avatar instantiated successfully!");
                    
                    // --- FORCE VISIBILITY (GREEN) ---
                    var renderers = loadedAvatar.GetComponentsInChildren<Renderer>();
                    if (renderers.Length > 0)
                    {
                        Material debugMat = new Material(safeShader);
                        debugMat.color = new Color(1f, 0.5f, 0f); // ORANGE
                        
                        Bounds totalBounds = new Bounds(renderers[0].transform.position, Vector3.zero);
                        foreach (var r in renderers)
                        {
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
                        
                        UpdateDebugState(Color.green, 0.2f, $"Success! Scale={maxDim}m -> 1m. Look for ORANGE."); // GREEN = SUCCESS
                    }
                    else
                    {
                        Debug.LogError("❌ [AvatarLoader] No Renderers found!");
                        UpdateDebugState(Color.magenta, 0.6f, "Success but EMPTY (No Renderers)"); // EMPTY
                    }
                    
                    OnAvatarLoaded?.Invoke(loadedAvatar);
                }
                else
                {
                    Debug.LogError("❌ [AvatarLoader] Failed to instantiate scene");
                    UpdateDebugState(Color.red, 0.6f, "Instantiate Failed");
                }
            }
            gltf.Dispose();
            
            // Clear coroutine reference when done
            loadModelCoroutine = null;
        }
        
        // ... (State vars unchanged)

        // ... (Inside PersistentFixer)
        private IEnumerator ApplyURPFix(GameObject root)
        {
            Debug.Log("🛡️ [AvatarLoader] Applying URP Material Fix...");
            yield return null; // Wait 1 frame only (No long delay)

            if (root == null) yield break;

            // REMOVED: DisableAnimatorAndPhysics(root); 
            // We MUST let the animator run, otherwise the mesh might stay collapsed at (0,0,0) bind pose.
            Debug.Log("   ✨ Animator left ENABLED to ensure mesh expansion.");

            // 2. FORCE BOUNDS (Prevent Culling)
            var skinnedMeshes = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            foreach (var smr in skinnedMeshes)
            {
                smr.updateWhenOffscreen = true;
                smr.localBounds = new Bounds(Vector3.zero, Vector3.one * 10f); // Force giant bounds
                Debug.Log($"   📦 Forced bounds on {smr.name} to 10m");
            }

            // 3. Fix Materials -> FORCE CYAN FOR DIAGNOSTIC
            var renderers = root.GetComponentsInChildren<Renderer>(true);
            Debug.Log($"🛡️ [AvatarLoader] DIAGNOSTIC: Forcing Cyan Material on {renderers.Length} renderers");

            foreach (var r in renderers)
            {
                if (r == null) continue;
                // Force Simple URP Cyan Material
                Material cyanMat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
                cyanMat.color = Color.cyan;
                cyanMat.name = "DiagnosticCyan";
                r.material = cyanMat;
                Debug.Log($"   🎨 Forced Cyan on {r.name}");
            }
            debugMessage = "Success: Model Loaded (Cyan Diagnostic)";
            
            // 4. Force Layer to Default (0) - Recursively
            void SetLayerRecursively(GameObject obj, int newLayer)
            {
                if (null == obj) return;
                obj.layer = newLayer;
                foreach (Transform child in obj.transform)
                {
                    if (null == child) continue;
                    SetLayerRecursively(child.gameObject, newLayer);
                }
            }
            SetLayerRecursively(root, 0); // Layer 0 = Default
            Debug.Log("🛡️ [AvatarLoader] Forced Layer to DEFAULT (0) recursively.");

            // 5. GEOMETRY CENTERING (Pull mesh to pivot)
            // Calculate total bounds again
            Bounds totalBounds = new Bounds(root.transform.position, Vector3.zero);
            var renderers2 = root.GetComponentsInChildren<Renderer>(true);
            if (renderers2.Length > 0)
            {
                totalBounds = renderers2[0].bounds;
                foreach (var r in renderers2) totalBounds.Encapsulate(r.bounds);
                
                // If Center is far from Pivot (Root Position), move Root to compensate
                Vector3 centerWorld = totalBounds.center;
                Vector3 pivotWorld = root.transform.position;
                Vector3 offset = pivotWorld - centerWorld;
                
                // Only center if significant offset (> 1m)
                if (offset.magnitude > 1.0f)
                {
                     Debug.LogWarning($"⚠️ [AvatarLoader] Mesh is offset by {offset} from Pivot. Recentering...");
                     // We can't move the root because that moves the bounds.
                     // We must move the children? Or just offset the root's position?
                     // Moving the Children is safer for the wrapper.
                     foreach (Transform child in root.transform)
                     {
                         child.position += offset;
                     }
                     Debug.Log("   ✅ Moved children to align Mesh Center with Pivot.");
                }
            }
            // End Geometry Centering

            /*
            if (baseMaterial != null)
            {
                // ... (Disabled original logic for diagnostic)
            }
            */

            // One final stats check
            try { DebugModelStats(root); } catch { }
        }

        private void DisableAnimatorAndPhysics(GameObject root)
        {
            // 1. Disable Animator
            var animators = root.GetComponentsInChildren<Animator>(true);
            foreach (var anim in animators) { if(anim.enabled) anim.enabled = false; }
            
            // 2. Disable Animation
            var animations = root.GetComponentsInChildren<Animation>(true);
            foreach (var anim in animations) { if(anim.enabled) anim.enabled = false; }
            
            // 3. Disable Physics
            var rbs = root.GetComponentsInChildren<Rigidbody>(true);
            foreach (var rb in rbs) { if(!rb.isKinematic) rb.isKinematic = true; }
            
            // 4. PREVENT CULLING
            var skinnedMeshes = root.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            foreach (var smr in skinnedMeshes) { smr.updateWhenOffscreen = true; }
        }

        private void FixMaterials(GameObject root)
        {
            // Deprecated - logic moved to PersistentFixer to share the material instance
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
        /// Update debug sphere color and scale to indicate state
        /// </summary>
        private void UpdateDebugState(Color color, float scale, string msg = null)
        {
            if (msg != null) debugMessage = $"Status: {msg}\nColor: {color}\nScale: {scale}";
            
            if (debugSphere != null)
            {
                var renderer = debugSphere.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material.color = color;
                }
                debugSphere.transform.localScale = new Vector3(scale, scale, scale);
                Debug.Log($"⚠️ [AvatarLoader] Debug State: Color={color}, Scale={scale}");
            }
        }

        private void DebugModelStats(GameObject root)
        {
            Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
            Debug.Log($"📊 [AvatarLoader] Model Stats: {renderers.Length} renderers found.");
            
            if (renderers.Length == 0)
            {
                Debug.LogError("❌ [AvatarLoader] No renderers found in loaded model! It might be empty.");
                return;
            }

            Bounds bounds = new Bounds(renderers[0].bounds.center, Vector3.zero);
            foreach (Renderer r in renderers)
            {
                bounds.Encapsulate(r.bounds);
                Debug.Log($"   🔹 Mesh: {r.name}, Enabled: {r.enabled}, Bounds: {r.bounds}, Material: {r.sharedMaterial?.name}, Shader: {r.sharedMaterial?.shader?.name}");
            }
            
            Debug.Log($"📊 [AvatarLoader] Total Bounds: {bounds}, Size: {bounds.size}");
            // OFFSET CHECK: Distance from Root (Pivot) to Mesh Center
            float offsetDist = Vector3.Distance(root.transform.position, bounds.center);
            Debug.Log($"📏 [AvatarLoader] Pivot Offset: {offsetDist}m (Center at {bounds.center})");
            
            debugMessage += $"\nRenderers: {renderers.Length}, Size: {bounds.size}";
            
            // Check if it's too small or too big
            if (bounds.size.magnitude < 0.01f)
            {
                // BLIND FALLBACK: 100x failed. Try 1000x (NUCLEAR OPTION)
                if (bounds.size.magnitude <= 0.0001f)
                {
                     Debug.LogWarning($"⚠️ [AvatarLoader] Model bounds are ZERO. NUCLEAR OPTION: Force Scale 1000.0x");
                     root.transform.localScale = Vector3.one * 1000.0f;
                }
                else
                {
                    Debug.LogWarning("⚠️ [AvatarLoader] Model is extremely small! Scaling up...");
                    float scaleFactor = 1.5f / bounds.size.magnitude;
                    if (!float.IsInfinity(scaleFactor) && !float.IsNaN(scaleFactor))
                    {
                        root.transform.localScale = Vector3.one * scaleFactor;
                        Debug.Log($"   Scale Factor applied: {scaleFactor}");
                    }
                }
            }
            else if (bounds.size.magnitude > 100f)
            {
                  Debug.LogWarning("⚠️ [AvatarLoader] Model is extremely large! Scaling down...");
                  float scaleFactor = 1.5f / bounds.size.magnitude;
                  root.transform.localScale = Vector3.one * scaleFactor;
                  Debug.Log($"   Scale Factor applied: {scaleFactor}");
            }
        }

        private void ForceVisibleMaterial(GameObject root)
        {
            Debug.Log("🎨 [AvatarLoader] FORCING VISIBLE MATERIAL (Orange)");
            var renderers = root.GetComponentsInChildren<Renderer>(true);
            Material debugMat = new Material(Shader.Find("Universal Render Pipeline/Unlit"));
            if (debugMat == null) debugMat = new Material(Shader.Find("Unlit/Color")); // Fallback
            
            debugMat.color = new Color(1f, 0.5f, 0f, 1f); // Bright Orange
            debugMat.name = "DebugOrange";

            foreach (var r in renderers)
            {
                r.sharedMaterial = debugMat;
            }
        }

        // Removed UpdateDebugState to clean up UI

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

