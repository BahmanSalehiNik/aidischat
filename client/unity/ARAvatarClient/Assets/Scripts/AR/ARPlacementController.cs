using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

namespace AIChatAR.AR
{
    /// <summary>
    /// AR Placement Controller - handles tap-to-place avatar in AR space
    /// Matches AR placement functionality from the integration guide
    /// </summary>
    public class ARPlacementController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private ARRaycastManager raycastManager;
        [SerializeField] private Camera arCamera;
        [SerializeField] private GameObject avatarPrefab; // The loaded avatar

        [Header("Placement Settings")]
        [SerializeField] private bool allowRepositioning = true;
        [SerializeField] private LayerMask planeLayerMask = -1;

        private GameObject placedAvatar;
        private List<ARRaycastHit> hits = new List<ARRaycastHit>();

        void Start()
        {
            // Auto-find components if not assigned
            if (raycastManager == null)
            {
                raycastManager = FindObjectOfType<ARRaycastManager>();
            }

            if (arCamera == null)
            {
                arCamera = Camera.main;
            }
        }

        void Update()
        {
            // Handle touch input
            if (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)
            {
                PlaceAvatar(Input.GetTouch(0).position);
            }

            // Handle mouse input (for testing in editor)
            if (Input.GetMouseButtonDown(0))
            {
                PlaceAvatar(Input.mousePosition);
            }
        }

        /// <summary>
        /// Place avatar at screen position
        /// </summary>
        public void PlaceAvatar(Vector2 screenPosition)
        {
            if (raycastManager == null)
            {
                Debug.LogWarning("⚠️ ARRaycastManager not found");
                return;
            }

            // Perform raycast
            if (raycastManager.Raycast(screenPosition, hits, TrackableType.PlaneWithinPolygon))
            {
                Pose hitPose = hits[0].pose;

                if (placedAvatar == null)
                {
                    // Create new avatar instance
                    if (avatarPrefab != null)
                    {
                        placedAvatar = Instantiate(avatarPrefab, hitPose.position, hitPose.rotation);
                        Debug.Log($"✅ Avatar placed at {hitPose.position}");
                    }
                    else
                    {
                        Debug.LogWarning("⚠️ Avatar prefab not assigned");
                    }
                }
                else if (allowRepositioning)
                {
                    // Reposition existing avatar
                    placedAvatar.transform.position = hitPose.position;
                    placedAvatar.transform.rotation = hitPose.rotation;
                    Debug.Log($"✅ Avatar repositioned to {hitPose.position}");
                }
            }
            else
            {
                Debug.Log("No plane detected at touch position");
            }
        }

        /// <summary>
        /// Set avatar prefab to place
        /// </summary>
        public void SetAvatarPrefab(GameObject avatar)
        {
            avatarPrefab = avatar;
        }

        /// <summary>
        /// Set placed avatar directly (for when avatar is loaded dynamically)
        /// </summary>
        public void SetPlacedAvatar(GameObject avatar)
        {
            if (placedAvatar != null && placedAvatar != avatar)
            {
                Destroy(placedAvatar);
            }
            placedAvatar = avatar;
        }

        /// <summary>
        /// Remove placed avatar
        /// </summary>
        public void RemoveAvatar()
        {
            if (placedAvatar != null)
            {
                Destroy(placedAvatar);
                placedAvatar = null;
            }
        }

        /// <summary>
        /// Get currently placed avatar
        /// </summary>
        public GameObject GetPlacedAvatar()
        {
            return placedAvatar;
        }
    }
}

