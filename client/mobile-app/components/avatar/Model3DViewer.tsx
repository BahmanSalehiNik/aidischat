// 3D Model Viewer Component using Three.js and expo-gl
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, PanResponder, GestureResponderEvent } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Ionicons } from '@expo/vector-icons';
import { DeviceMotion } from 'expo-sensors';

import { Marker } from '../../utils/markerParser';
import { AnimationController } from '../../utils/animations/AnimationController';
import { MovementState } from '../../utils/animations/animationTypes';

// shared buffer to pass data from verification to loader patch
let preloadedBinBuffer: ArrayBuffer | null = null;

interface Model3DViewerProps {
  modelUrl: string;
  textureUrls?: string[]; // Signed URLs for texture images
  animationUrls?: string[]; // Separate animation GLB URLs (for Meshy models)
  binFileName?: string; // For GLTF format: the .bin filename referenced in the GLTF JSON
  binUrl?: string; // Explicit signed URL for the .bin file (needed for private containers)
  onClose?: () => void;
  enableAR?: boolean;
  onARPress?: () => void;
  markers?: Marker[]; // Emotion and movement markers for animations
  currentEmotion?: string; // Current emotion state
  currentMovement?: string; // Current movement state
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({
  modelUrl,
  animationUrls = [],
  textureUrls = [],
  binFileName,
  binUrl,
  onClose,
  enableAR = false,
  onARPress,
  markers = [],
  currentEmotion,
  currentMovement,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rotationRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);
  const baseScaleRef = useRef(1);
  const cameraDistanceRef = useRef(8); // Start closer for better visibility
  const [isAnchored, setIsAnchored] = useState(false);
  const anchorPositionRef = useRef<THREE.Vector3 | null>(null);
  const anchorRotationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);
  const deviceMotionSubscriptionRef = useRef<any>(null);
  const animationControllerRef = useRef<AnimationController | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Calculate distance between two touches for pinch gesture
  const getDistance = (touches: any[]) => {
    if (touches.length < 2) return null;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Handle double tap to anchor/unanchor model
  const lastTapRef = useRef<number | null>(null);
  const handleDoubleTap = () => {
    if (!modelRef.current) return;

    if (isAnchored) {
      // Unanchor: stop tracking device motion
      setIsAnchored(false);
      anchorPositionRef.current = null;
      anchorRotationRef.current = null;
      if (deviceMotionSubscriptionRef.current) {
        deviceMotionSubscriptionRef.current.remove();
        deviceMotionSubscriptionRef.current = null;
      }
      console.log('🔓 [Model3DViewer] Model unanchored');
    } else {
      // Anchor: lock model position and start tracking device motion
      setIsAnchored(true);
      // Store current model position in world space
      anchorPositionRef.current = modelRef.current.position.clone();

      // Check if device motion is available, request permissions, and start tracking
      DeviceMotion.isAvailableAsync().then(async (available) => {
        if (!available) {
          console.warn('⚠️ [Model3DViewer] Device motion not available on this device');
          setIsAnchored(false);
          return;
        }

        // Request permissions (required on iOS, optional on Android)
        try {
          // Check current permission status first
          const { status: currentStatus } = await DeviceMotion.getPermissionsAsync();

          let finalStatus = currentStatus;

          if (currentStatus !== 'granted') {
            // Request permission explicitly
            console.log('📱 [Model3DViewer] Requesting device motion permission...');
            const { status } = await DeviceMotion.requestPermissionsAsync();
            finalStatus = status;
          } else {
            console.log('✅ [Model3DViewer] Device motion permission already granted');
          }

          if (finalStatus === 'granted') {
            console.log('✅ [Model3DViewer] Device motion permission granted');
          } else {
            console.warn('⚠️ [Model3DViewer] Device motion permission denied. Status:', finalStatus);
            console.warn('⚠️ [Model3DViewer] Please enable motion permissions in device settings:');
            console.warn('⚠️ [Model3DViewer] iOS: Settings > Privacy & Security > Motion & Fitness');
            console.warn('⚠️ [Model3DViewer] Android: Usually granted automatically, check app permissions');
            setIsAnchored(false);
            return;
          }
        } catch (error: any) {
          // Some platforms might not require explicit permissions
          const errorMsg = error?.message || String(error);
          console.log('ℹ️ [Model3DViewer] Permission request result:', errorMsg);

          // On Android, permissions might not be required, so continue
          // On iOS, if permission is denied, we should stop
          if (errorMsg.includes('denied') || errorMsg.includes('permission')) {
            console.warn('⚠️ [Model3DViewer] Permission denied, disabling anchor feature');
            setIsAnchored(false);
            return;
          } else {
            console.log('ℹ️ [Model3DViewer] Continuing - permission may not be required on this platform');
          }
        }

        // Set update interval for smooth tracking
        DeviceMotion.setUpdateInterval(50); // Update every 50ms

        let initialRotation: { alpha: number; beta: number; gamma: number } | null = null;

        // Create subscription to device motion
        const subscription = DeviceMotion.addListener((motion) => {
          if (motion.rotation && modelRef.current && anchorPositionRef.current) {
            const rotation = motion.rotation;

            // Store initial rotation on first reading
            if (!initialRotation) {
              initialRotation = {
                alpha: rotation.alpha || 0,
                beta: rotation.beta || 0,
                gamma: rotation.gamma || 0,
              };
              anchorRotationRef.current = initialRotation;
              return;
            }

            // Calculate rotation delta from initial position (in radians)
            const deltaAlpha = ((rotation.alpha || 0) - initialRotation.alpha) * (Math.PI / 180);
            const deltaBeta = ((rotation.beta || 0) - initialRotation.beta) * (Math.PI / 180);
            const deltaGamma = ((rotation.gamma || 0) - initialRotation.gamma) * (Math.PI / 180);

            // Convert rotation deltas to position compensation
            // This keeps the model in the same "world position" as device moves
            const compensationFactor = 0.2; // Adjust this to fine-tune sensitivity
            const compensationX = deltaGamma * compensationFactor;
            const compensationY = deltaBeta * compensationFactor;
            const compensationZ = deltaAlpha * compensationFactor;

            // Apply compensation to keep model in same world position
            modelRef.current.position.x = anchorPositionRef.current.x - compensationX;
            modelRef.current.position.y = anchorPositionRef.current.y - compensationY;
            modelRef.current.position.z = anchorPositionRef.current.z - compensationZ;
          }
        });

        deviceMotionSubscriptionRef.current = subscription;
        console.log('🔒 [Model3DViewer] Model anchored - tracking device motion');
      }).catch((error) => {
        console.error('❌ [Model3DViewer] Failed to setup device motion:', error);
        setIsAnchored(false);
      });
    }
  };

  // Pan responder for touch controls (rotation and pinch zoom)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Check for double tap
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (lastTapRef.current && (now - lastTapRef.current) < DOUBLE_TAP_DELAY) {
          handleDoubleTap();
          lastTapRef.current = null;
          return;
        }
        lastTapRef.current = now;

        // Don't allow manual rotation/zoom when anchored
        if (isAnchored) return;

        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Two-finger pinch gesture
          const distance = getDistance(touches);
          if (distance !== null) {
            lastPinchDistanceRef.current = distance;
            baseScaleRef.current = modelRef.current ? modelRef.current.scale.x : 1;
          }
        } else {
          // Single finger rotation
          lastPanRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        }
      },
      onPanResponderMove: (evt) => {
        // Don't allow manual rotation/zoom when anchored
        if (isAnchored) return;

        const touches = evt.nativeEvent.touches;

        if (touches.length === 2) {
          // Two-finger pinch zoom
          const distance = getDistance(touches);
          if (distance !== null && lastPinchDistanceRef.current !== null && modelRef.current) {
            // Calculate scale change based on distance change
            const scaleChange = distance / lastPinchDistanceRef.current;
            const currentScale = modelRef.current.scale.x;
            const newScale = Math.max(0.3, Math.min(5, currentScale * scaleChange));
            modelRef.current.scale.setScalar(newScale);
            // Update base scale for next pinch gesture
            baseScaleRef.current = newScale;
            lastPinchDistanceRef.current = distance;
          }
        } else if (touches.length === 1 && lastPanRef.current) {
          // Single finger rotation
          const deltaX = evt.nativeEvent.pageX - lastPanRef.current.x;
          const deltaY = evt.nativeEvent.pageY - lastPanRef.current.y;

          // Reduced sensitivity: from 0.01 to 0.003 (much less sensitive)
          rotationRef.current.y += deltaX * 0.003;
          rotationRef.current.x += deltaY * 0.003;

          lastPanRef.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
        }
      },
      onPanResponderRelease: (evt) => {
        const touches = evt.nativeEvent.touches;

        // If ending a pinch gesture, update base scale
        if (touches.length === 0 && modelRef.current) {
          baseScaleRef.current = modelRef.current.scale.x;
        }

        lastPanRef.current = null;
        lastPinchDistanceRef.current = null;
        // Reset rotation velocity to stop continuous rotation
        rotationRef.current.x = 0;
        rotationRef.current.y = 0;
      },
    })
  ).current;

  // Initialize 3D scene
  const onContextCreate = async (gl: any) => {
    try {
      // Create renderer
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      // Use transparent background in AR mode, white in VR mode
      renderer.setClearColor(enableAR ? 0x000000 : 0xf5f5f5, enableAR ? 0 : 1); // Transparent in AR, white in VR
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera
      const camera = new THREE.PerspectiveCamera(
        75,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        2000 // Increased far plane to match model distance calculation
      );
      // Start camera much further back - will be adjusted when model loads
      // But start with safe distance to prevent being inside model
      camera.position.set(0, 0, cameraDistanceRef.current);
      cameraRef.current = camera;

      // Add lighting - increased intensity for better color visibility
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased from 0.6 to 1.0
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2); // Increased from 0.8 to 1.2
      directionalLight1.position.set(5, 5, 5);
      directionalLight1.castShadow = true;
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6); // Increased from 0.4 to 0.6
      directionalLight2.position.set(-5, -5, -5);
      scene.add(directionalLight2);

      const pointLight = new THREE.PointLight(0xffffff, 0.8); // Increased from 0.5 to 0.8
      pointLight.position.set(0, 10, 0);
      scene.add(pointLight);

      // Add ground plane with shadow
      const planeGeometry = new THREE.PlaneGeometry(20, 20);
      const planeMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -2;
      plane.receiveShadow = true;
      scene.add(plane);

      // Load GLB/GLTF model
      // Textures are now extracted server-side and loaded separately (React Native compatible)
      // The GLB should have embedded textures removed to prevent React Native loading errors

      // CRITICAL PATCH: React Native doesn't support Blob from ArrayBuffer
      // We need to patch THREE.FileLoader to handle texture loading failures gracefully
      // This prevents GLTFLoader from throwing errors when embedded textures can't be loaded

      // Extract query string and base URL for .bin file resolution (before patches)
      const modelUrlQuery = modelUrl.includes('?') ? modelUrl.substring(modelUrl.indexOf('?')) : '';
      const cleanModelUrl = modelUrl.split('?')[0];
      const baseUrl = cleanModelUrl.substring(0, cleanModelUrl.lastIndexOf('/') + 1);

      // Patch FileLoader to catch ArrayBuffer to Blob conversion errors AND add query string to .bin files
      const FileLoaderPrototype = THREE.FileLoader.prototype as any;
      if (FileLoaderPrototype.load && !FileLoaderPrototype._reactNativePatchApplied) {
        const originalLoad = FileLoaderPrototype.load;
        FileLoaderPrototype.load = function (url: string, onLoad?: (data: any) => void, onProgress?: (progress: any) => void, onError?: (error: any) => void) {
          // Check if this is a .bin file request
          const isBinRequest = url.endsWith('.bin') || url.includes('.bin?');

          if (isBinRequest) {
            // Updated patch: Handle .bin, potentially adding query string if missing
            const currentQueryString = (FileLoaderPrototype as any)._currentBinQueryString;
            const currentBaseUrl = (FileLoaderPrototype as any)._currentBaseUrl;
            // Use the explicit binUrl if set - this prevents GLTFLoader from mangling encoded chars in the SAS token
            const directBinUrl = (FileLoaderPrototype as any)._currentBinUrl;

            let fetchUrl = url;

            if (directBinUrl) {
              console.log(`📦 [Model3DViewer] Using explicit direct binUrl for fetch (bypassing potentially mangled URL)`);
              // Verify if the requested URL (filename) matches the directBinUrl's filename to be safe
              // But for this specific avatar use case, we typically have 1 bin file
              fetchUrl = directBinUrl;
            } else if (!url.includes('?') && currentQueryString) {
              // Add query string if missing and matching base URL (fallback)
              const urlWithoutQuery = url.split('?')[0];
              const isFromSameBase = !url.startsWith('http') ||
                (currentBaseUrl && (urlWithoutQuery.startsWith(currentBaseUrl) ||
                  urlWithoutQuery.includes(currentBaseUrl.split('/').slice(-2).join('/'))));

              if (isFromSameBase) {
                fetchUrl = url + currentQueryString;
                console.log(`📦 [Model3DViewer] Added query string to .bin file request: ${fetchUrl.substring(0, 50)}...`);
              }
            }
            // CRITICAL: Force direct fetch for .bin files in React Native
            console.log(`📦 [Model3DViewer] Intercepting .bin load with direct fetch: ${fetchUrl.substring(0, 150)}...`);

            // OPTIMIZATION: Check if we have a pre-loaded buffer from verification
            if (preloadedBinBuffer) {
              console.log('📦 [Model3DViewer] Using PRE-LOADED .bin buffer (skipping fetch)');
              const buffer = preloadedBinBuffer;
              // Clear it to avoid holding memory or reusing for wrong request
              preloadedBinBuffer = null;

              // Return buffer on next tick to simulate async load
              setTimeout(() => {
                if (onLoad) onLoad(buffer);
              }, 0);
              return { abort: () => { } };
            }

            fetch(fetchUrl)
              .then(async (response) => {
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error(`❌ [Model3DViewer] Direct fetch failed. Status: ${response.status}. Body: ${errorText}`);
                  throw new Error(`HTTP ${response.status} - ${response.statusText} - ${errorText.substring(0, 100)}`);
                }
                const buffer = await response.arrayBuffer();
                if (onLoad) onLoad(buffer);
              })
              .catch((err) => {
                console.error(`❌ [Model3DViewer] Direct fetch failed for .bin:`, err);
                console.error(`❌ [Model3DViewer] Failed URL: ${fetchUrl}`);
                if (onError) onError(err);
              });

            // Return a dummy object with abort method
            return { abort: () => { } };
          }

          // Check if this is a texture/image request
          const isTextureRequest = url.includes('data:image') ||
            url.includes('texture') ||
            url.endsWith('.png') ||
            url.endsWith('.jpg') ||
            url.endsWith('.jpeg');

          if (isTextureRequest) {
            // ... [existing texture logic]
            // For texture requests in React Native, catch the error and return null
            // This prevents the "Creating blobs from ArrayBuffer" error from crashing the model load
            return originalLoad.call(this, url,
              (data: any) => {
                if (onLoad) onLoad(data);
              },
              onProgress,
              (error: any) => {
                // Suppress texture loading errors - textures are loaded separately
                console.warn(`⚠️ [Model3DViewer] Texture loading failed (expected in React Native): ${url}`);
                if (onLoad) onLoad(null); // Return null instead of calling onError
              }
            );
          }

          // For non-texture requests, use original behavior
          return originalLoad.call(this, url, onLoad, onProgress, onError);
        };
        FileLoaderPrototype._reactNativePatchApplied = true;
        console.log(`✅ [Model3DViewer] Applied FileLoader patch for React Native compatibility and .bin query string`);
      }

      // Patch Texture.prototype to handle null textures gracefully
      const TexturePrototype = THREE.Texture.prototype as any;

      // Check if patch is already applied (to avoid applying multiple times)
      if (!TexturePrototype._encodingPatchApplied) {
        const originalEncodingDescriptor = Object.getOwnPropertyDescriptor(TexturePrototype, 'encoding');

        if (originalEncodingDescriptor && originalEncodingDescriptor.set) {
          const originalSetter = originalEncodingDescriptor.set;
          Object.defineProperty(TexturePrototype, 'encoding', {
            set: function (value: any) {
              // CRITICAL: Check if 'this' is null/undefined before trying to set anything
              if (this == null || this === undefined) {
                // Silently ignore - prevents "Cannot set property 'encoding' of null" error
                return;
              }

              try {
                originalSetter.call(this, value);
              } catch (e: any) {
                // If setting fails (e.g., object is frozen or sealed), store as property
                try {
                  (this as any)._encoding = value;
                } catch (e2) {
                  // If even that fails, silently ignore
                }
              }
            },
            get: function () {
              if (this == null || this === undefined) {
                return 3000; // Default LinearEncoding
              }
              return (this as any)._encoding !== undefined
                ? (this as any)._encoding
                : (originalEncodingDescriptor.get ? originalEncodingDescriptor.get.call(this) : 3000);
            },
            configurable: true,
            enumerable: true
          });

          // Mark as applied
          TexturePrototype._encodingPatchApplied = true;
          console.log(`✅ [Model3DViewer] Applied Texture.encoding patch for React Native compatibility`);
        }
      }

      // Create loader AFTER all patches are applied
      const loader = new GLTFLoader();

      // If loading GLTF format, extract .bin filename from GLTF JSON if not provided
      let actualModelUrl = modelUrl;
      let extractedBinFileName = binFileName; // Use provided binFileName or extract from GLTF

      // Check if URL is GLTF format (strip query string first)
      const cleanModelUrlForCheck = modelUrl.split('?')[0];
      const isGltfFormat = cleanModelUrlForCheck.endsWith('.gltf');

      console.log(`📊 [Model3DViewer] Initial binFileName prop: ${binFileName || 'undefined'}`);
      console.log(`📊 [Model3DViewer] Format check:`, {
        originalUrl: modelUrl,
        cleanUrl: cleanModelUrlForCheck,
        isGltfFormat,
        endsWithGltf: cleanModelUrlForCheck.endsWith('.gltf')
      });

      if (isGltfFormat) {
        // Always download GLTF JSON to extract .bin filename if not provided
        try {
          console.log(`📦 [Model3DViewer] Downloading GLTF JSON from: ${modelUrl}`);
          const response = await fetch(modelUrl);
          const gltfJson = await response.json();

          console.log(`📊 [Model3DViewer] GLTF JSON structure:`, {
            hasBuffers: !!gltfJson.buffers,
            buffersLength: gltfJson.buffers?.length || 0,
            firstBuffer: gltfJson.buffers?.[0] ? {
              uri: gltfJson.buffers[0].uri,
              byteLength: gltfJson.buffers[0].byteLength,
              hasUri: !!gltfJson.buffers[0].uri
            } : null,
            buffersArray: gltfJson.buffers
          });

          // Extract .bin filename from GLTF JSON if not provided by server
          if (!extractedBinFileName && gltfJson.buffers && gltfJson.buffers.length > 0) {
            if (gltfJson.buffers[0].uri) {
              extractedBinFileName = gltfJson.buffers[0].uri;
              console.log(`📦 [Model3DViewer] ✅ Extracted .bin filename from GLTF JSON: ${extractedBinFileName}`);
            } else {
              console.warn(`⚠️ [Model3DViewer] GLTF buffers[0] exists but has no 'uri' property`);
              console.warn(`⚠️ [Model3DViewer] buffers[0] =`, gltfJson.buffers[0]);
            }
          } else if (extractedBinFileName) {
            console.log(`📦 [Model3DViewer] Using binFileName from server: ${extractedBinFileName}`);
          } else {
            console.warn(`⚠️ [Model3DViewer] No binFileName available (not from server, not in GLTF)`);
          }

          // Update GLTF to use absolute URL for .bin file to avoid resource path issues
          // This ensures the .bin file can be loaded with the same query string (SAS token) as the GLTF
          if (gltfJson.buffers && gltfJson.buffers.length > 0) {
            const currentBinName = gltfJson.buffers[0].uri;
            const targetBinFileName = binFileName || currentBinName;

            if (binUrl) {
              // Use explicit signed binUrl if provided (BEST option for private containers)
              gltfJson.buffers[0].uri = binUrl;
              console.log(`📦 [Model3DViewer] Updated GLTF JSON to use explicit signed .bin URL`);
            } else if (targetBinFileName) {
              // Construct absolute URL for .bin file with same query string as model URL
              const cleanModelUrl = modelUrl.split('?')[0];
              const baseUrl = cleanModelUrl.substring(0, cleanModelUrl.lastIndexOf('/') + 1);
              const modelUrlQuery = modelUrl.includes('?') ? modelUrl.substring(modelUrl.indexOf('?')) : '';
              const absoluteBinUrl = `${baseUrl}${targetBinFileName}${modelUrlQuery}`;

              // Update GLTF to use absolute URL for .bin file
              gltfJson.buffers[0].uri = absoluteBinUrl;
              console.log(`📦 [Model3DViewer] Updated GLTF to use absolute .bin URL: ${absoluteBinUrl}`);
            }

            // Patch textures if available
            console.log(`📦 [Model3DViewer] Checking for texture patching. TextureUrls count: ${textureUrls ? textureUrls.length : 0}. GLTF images count: ${gltfJson.images ? gltfJson.images.length : 0}`);

            // STRATEGY: Replace all textures with a 1x1 dummy placeholder in the GLTF JSON.
            // This prevents GLTFLoader from hanging on network requests (403s or slow loads).
            // We will load the real textures manually afterwards using the signed textureUrls.
            const DUMMY_TEXTURE_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

            if (gltfJson.images && gltfJson.images.length > 0) {
              console.log(`📦 [Model3DViewer] Replacing ${gltfJson.images.length} textures with dummy placeholders to prevent loader hang...`);
              gltfJson.images.forEach((image: any, index: number) => {
                image.uri = DUMMY_TEXTURE_URI;
              });
            } else if (gltfJson.images && gltfJson.images.length > 0) {
              console.warn(`⚠️ [Model3DViewer] GLTF has images but no textureUrls prop provided. Textures might fail to load (403) from private container.`);
            }

            // Create a blob URL from the updated JSON (with fallback for React Native)
            const updatedJson = JSON.stringify(gltfJson);
            let urlCreated = false;

            // Method 1: Try Blob + createObjectURL (Preferred for web/some native envs)
            try {
              if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
                // @ts-ignore - React Native Blob type may differ from web
                const blob = new Blob([updatedJson], { type: 'application/json' });
                actualModelUrl = URL.createObjectURL(blob);
                urlCreated = true;
                console.log(`📦 [Model3DViewer] Created blob URL with absolute .bin file reference`);
              }
            } catch (blobError: any) {
              console.warn(`⚠️ [Model3DViewer] Blob creation failed, trying fallback:`, blobError);
            }

            // Method 2: Fallback to Data URL (Reliable in React Native)
            if (!urlCreated) {
              try {
                const base64 = typeof btoa !== 'undefined'
                  ? btoa(updatedJson)
                  : (typeof Buffer !== 'undefined' ? Buffer.from(updatedJson).toString('base64') : null);

                if (base64) {
                  actualModelUrl = `data:application/json;base64,${base64}`;
                  urlCreated = true;
                  console.log(`📦 [Model3DViewer] Created data URL with absolute .bin file reference`);
                } else {
                  console.warn('⚠️ [Model3DViewer] No base64 encoding method available');
                }
              } catch (dataUrlError) {
                console.warn(`⚠️ [Model3DViewer] Data URL creation failed:`, dataUrlError);
              }
            }

            if (!urlCreated) {
              console.warn(`⚠️ [Model3DViewer] All JSON-to-URL methods failed.`);
              // If blob creation fails, we need to use original URL and set resource path
              // The original GLTF file has relative .bin filename, so we need resource path to resolve it
              actualModelUrl = modelUrl;
              // Mark that we need to set resource path
              console.warn(`⚠️ [Model3DViewer] Will use original URL and set resource path for .bin file resolution`);
            }
          }
        } catch (error: any) {
          console.warn(`⚠️ [Model3DViewer] Failed to read GLTF JSON:`, error);
          console.warn(`⚠️ [Model3DViewer] Will attempt to load with original GLTF file`);
          // Continue with original URL if update fails
        }
      }

      // If loading GLTF format, handle resource path
      if (isGltfFormat) {
        // Check if we're using a blob/data URL (from GLTF JSON modification with absolute .bin URLs)
        const isBlobOrDataUrl = actualModelUrl.startsWith('blob:') || actualModelUrl.startsWith('data:');


        // Store verification info in FileLoader prototype for the patch to use
        // This is needed regardless of whether we use Data URL or original URL
        (FileLoaderPrototype as any)._currentBinQueryString = modelUrlQuery;
        (FileLoaderPrototype as any)._currentBaseUrl = baseUrl;
        (FileLoaderPrototype as any)._currentBinUrl = binUrl;

        if (isBlobOrDataUrl) {
          // GLTF JSON has been modified to use absolute URLs for .bin file
          // No need to set resource path - the .bin URL is already absolute in the JSON
          console.log(`📦 [Model3DViewer] Using blob/data URL with absolute .bin URLs in GLTF JSON`);
          console.log(`📦 [Model3DViewer] No resource path needed - .bin file uses absolute URL`);
        } else {
          // Using original URL - the GLTF file on server has relative .bin filename
          // We need to set resource path so Three.js can resolve the relative .bin filename
          // IMPORTANT: setResourcePath only affects relative URLs in GLTF JSON, not the main file URL
          // However, setResourcePath doesn't preserve query strings, so we need to patch the FileLoader
          loader.setResourcePath(baseUrl);

          console.log(`📦 [Model3DViewer] Using original HTTP URL - setting resource path for .bin file resolution`);
          console.log(`📦 [Model3DViewer] Resource path: ${baseUrl}`);
          console.log(`📦 [Model3DViewer] Query string stored for .bin file requests: ${modelUrlQuery ? modelUrlQuery.substring(0, 50) + '...' : 'none'}`);
          console.log(`📦 [Model3DViewer] This will resolve relative .bin filename: ${extractedBinFileName || '<filename>.bin'}`);
        }

        console.log(`📦 [Model3DViewer] Loading GLTF model (React Native compatible) from: ${actualModelUrl}`);
        console.log(`📦 [Model3DViewer] .bin filename: ${extractedBinFileName || 'not found'}`);
        console.log(`📦 [Model3DViewer] actualModelUrl type: ${isBlobOrDataUrl ? 'blob/data URL' : 'HTTP URL'}`);

        // DO NOT set loader.setPath() - it causes URL duplication with absolute URLs
        // setResourcePath is safe because it only affects relative URLs in GLTF JSON
      } else {
        console.log(`📦 [Model3DViewer] Loading GLB model from: ${modelUrl}`);
        console.warn(`⚠️ [Model3DViewer] WARNING: GLB format may have embedded textures that fail in React Native`);
        console.warn(`⚠️ [Model3DViewer] Model should be converted to GLTF format server-side`);
      }

      // Suppress texture loading errors during GLB load (textures are loaded separately)
      const originalError = console.error;
      const textureErrors: any[] = [];
      console.error = (...args: any[]) => {
        const errorMsg = args.join(' ');
        // Suppress texture-related errors (textures are loaded separately)
        if (errorMsg.includes('texture') ||
          errorMsg.includes('ArrayBuffer') ||
          errorMsg.includes('blob') ||
          errorMsg.includes('encoding')) {
          textureErrors.push(errorMsg);
          return; // Suppress this error
        }
        // Log other errors normally
        originalError.apply(console, args);
      };

      // Verify file is accessible before loading
      if (isGltfFormat) {
        try {
          console.log(`🔍 [Model3DViewer] Verifying GLTF file is accessible: ${modelUrl}`);
          const verifyResponse = await fetch(modelUrl, { method: 'HEAD' });
          if (!verifyResponse.ok) {
            throw new Error(`GLTF file not accessible: ${verifyResponse.status} ${verifyResponse.statusText}`);
          }
          console.log(`✅ [Model3DViewer] GLTF file is accessible (${verifyResponse.headers.get('content-length')} bytes)`);

          // Also verify .bin file if we have the filename (from server or extracted from GLTF)
          if (extractedBinFileName) {
            let verifyBinUrl = binUrl; // Use prop if available

            if (!verifyBinUrl) {
              // Remove query string and extract base URL
              const cleanModelUrl = modelUrl.split('?')[0];
              const baseUrl = cleanModelUrl.substring(0, cleanModelUrl.lastIndexOf('/') + 1);
              // Construct .bin URL with same query string as model URL (for SAS tokens)
              const modelUrlQuery = modelUrl.includes('?') ? modelUrl.substring(modelUrl.indexOf('?')) : '';
              verifyBinUrl = `${baseUrl}${extractedBinFileName}${modelUrlQuery}`;
            }

            console.log(`🔍 [Model3DViewer] Verifying .bin file is accessible: ${verifyBinUrl}`);
            // Use GET instead of HEAD to verify full accessibility (headers + content access)
            const binVerifyResponse = await fetch(verifyBinUrl, { method: 'GET' });
            if (!binVerifyResponse.ok) {
              const errorText = await binVerifyResponse.text();
              const msg = `.bin file not accessible (verify GET): ${binVerifyResponse.status} ${binVerifyResponse.statusText} - ${errorText.substring(0, 200)}`;
              console.error(`❌ [Model3DViewer] ${msg}`);
              throw new Error(msg);
            }

            // PRE-FETCH OPTIMIZATION:
            // Since we already downloaded the content to verify it, store it!
            // This prevents a second network request and bypasses the 404 issue in the interceptor.
            const binBuffer = await binVerifyResponse.arrayBuffer();
            preloadedBinBuffer = binBuffer;
            console.log(`✅ [Model3DViewer] .bin file verified and PRE-LOADED (${binBuffer.byteLength} bytes)`);
          } else {
            console.warn(`⚠️ [Model3DViewer] No .bin filename available (neither from server nor extracted from GLTF)`);
          }
        } catch (verifyError: any) {
          console.error(`❌ [Model3DViewer] File verification failed:`, verifyError);
          // Continue anyway - might be CORS or other issue, but file might still be loadable
        }
      }

      let gltf: any;
      try {
        console.log(`📦 [Model3DViewer] Attempting to load model from: ${actualModelUrl}`);
        gltf = await loader.loadAsync(actualModelUrl);
        console.log(`✅ [Model3DViewer] Model loaded successfully`);
      } catch (loadError: any) {
        // Restore console.error first
        console.error = originalError;

        // Get the real error message
        const errorMsg = String(loadError?.message ?? loadError);
        const errorStack = loadError?.stack;

        console.error(`❌ [Model3DViewer] GLTF load failed with real error:`, {
          message: errorMsg,
          stack: errorStack,
          modelUrl: actualModelUrl,
          originalModelUrl: modelUrl,
          binFileNameFromServer: binFileName,
          extractedBinFileName: extractedBinFileName,
          isGltf: isGltfFormat,
        });

        // Check for specific error patterns
        const looksLikeEmbeddedTextureBlobIssue =
          errorMsg.includes("Creating blobs from 'ArrayBuffer'") ||
          errorMsg.includes("Couldn't load texture") ||
          errorMsg.includes("Blob") ||
          errorMsg.includes("objectURL") ||
          errorMsg.includes("ArrayBuffer");

        const looksLikeMissingBin =
          errorMsg.includes("Failed to load buffer") ||
          errorMsg.includes(".bin") ||
          errorMsg.includes("404") ||
          errorMsg.includes("Not Found");

        const looksLikeNetworkIssue =
          errorMsg.includes("NetworkError") ||
          errorMsg.includes("Failed to fetch") ||
          errorMsg.includes("CORS") ||
          errorMsg.includes("timeout");

        // Provide specific error messages based on the actual error
        if (looksLikeMissingBin) {
          // Remove query string to get clean base URL
          const cleanModelUrl = modelUrl.split('?')[0];
          const baseUrl = cleanModelUrl.substring(0, cleanModelUrl.lastIndexOf('/') + 1);
          const modelUrlQuery = modelUrl.includes('?') ? modelUrl.substring(modelUrl.indexOf('?')) : '';
          const expectedBinUrl = extractedBinFileName
            ? `${baseUrl}${extractedBinFileName}${modelUrlQuery}`
            : `${baseUrl}<filename>.bin${modelUrlQuery}`;
          throw new Error(
            `Failed to load model binary (.bin file). Make sure the .gltf and .bin are hosted together and loader.setResourcePath() points to that folder.\n` +
            `Model URL: ${modelUrl}\n` +
            `Expected .bin URL: ${expectedBinUrl}\n` +
            `Resource path: ${baseUrl}\n` +
            `Bin filename from server: ${binFileName || 'not provided'}\n` +
            `Bin filename from GLTF: ${extractedBinFileName || 'not found'}\n` +
            `Original error: ${errorMsg}`
          );
        }

        if (looksLikeEmbeddedTextureBlobIssue) {
          throw new Error(
            `Texture load failed in React Native (embedded/bufferView textures). Convert to .gltf + external PNG/JPG textures.\n` +
            `Original error: ${errorMsg}`
          );
        }

        if (looksLikeNetworkIssue) {
          throw new Error(
            `Network error loading model. Check if the file is accessible and CORS is configured correctly.\n` +
            `Model URL: ${modelUrl}\n` +
            `Original error: ${errorMsg}`
          );
        }

        // Otherwise, don't guess—return the real error
        throw new Error(`Failed to load 3D model: ${errorMsg}`);
      } finally {
        // Ensure console.error is restored
        if (console.error !== originalError) {
          console.error = originalError;
        }
      }

      if (textureErrors.length > 0) {
        console.warn(`⚠️ [Model3DViewer] ${textureErrors.length} texture loading error(s) suppressed (textures loaded separately)`);
      }

      const model = gltf.scene;
      modelRef.current = model;

      // Log model info for debugging
      console.log(`📦 [Model3DViewer] Model loaded successfully`);
      console.log(`📦 [Model3DViewer] Model has ${gltf.animations?.length || 0} embedded animations`);

      // Load textures separately if provided (extracted server-side for React Native compatibility)
      if (textureUrls && textureUrls.length > 0) {
        console.log(`🎨 [Model3DViewer] Loading ${textureUrls.length} textures separately (extracted server-side)...`);
        const textureLoader = new THREE.TextureLoader();

        // Load all textures
        const textures = await Promise.all(
          textureUrls.map((url, index) => {
            return textureLoader.loadAsync(url).catch((error) => {
              console.warn(`⚠️ [Model3DViewer] Failed to load texture ${index} from ${url}:`, error);
              return null;
            });
          })
        );

        // Apply textures to materials
        // Match textures to materials by index (assuming order matches)
        let textureIndex = 0;
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: THREE.Material) => {
              if (mat instanceof THREE.MeshStandardMaterial && textureIndex < textures.length) {
                const texture = textures[textureIndex];
                if (texture) {
                  mat.map = texture;
                  mat.needsUpdate = true;
                  texture.needsUpdate = true;
                  texture.flipY = false; // GLTF uses flipped Y
                  console.log(`✅ [Model3DViewer] Applied texture ${textureIndex} to material`);
                }
                textureIndex++;
              }
            });
          }
        });

        console.log(`✅ [Model3DViewer] Applied ${textureIndex} textures to materials`);
      } else {
        console.log(`⚠️ [Model3DViewer] No texture URLs provided - model may appear without colors`);
      }

      // Check for textures in the model
      let textureCount = 0;
      let materialCount = 0;
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          materialCount++;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat: THREE.Material) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) textureCount++;
              if (mat.normalMap) textureCount++;
              if (mat.roughnessMap) textureCount++;
              if (mat.metalnessMap) textureCount++;
            }
          });
        }
      });
      console.log(`📦 [Model3DViewer] Model has ${materialCount} materials, ${textureCount} textures`);

      // Collect all animation clips (from base model + separate animation files)
      let allAnimations: THREE.AnimationClip[] = [...(gltf.animations || [])];

      // Load animations from separate URLs if provided (Meshy workflow)
      if (animationUrls && animationUrls.length > 0) {
        console.log(`🎬 [Model3DViewer] Loading ${animationUrls.length} animation GLBs from separate URLs...`);
        for (let i = 0; i < animationUrls.length; i++) {
          try {
            const animGltf = await loader.loadAsync(animationUrls[i]);
            if (animGltf.animations && animGltf.animations.length > 0) {
              // Extract animation clips from animation GLB
              // Meshy animation GLBs contain animation clips that can be applied to the base model
              animGltf.animations.forEach((clip) => {
                // Rename animation to match expected names (idle, talking, thinking, walking)
                // Try to infer from URL or use default names based on order
                const urlLower = animationUrls[i].toLowerCase();
                let animName = clip.name;

                // Try to infer from URL
                if (urlLower.includes('idle')) {
                  animName = 'idle';
                } else if (urlLower.includes('thinking') || urlLower.includes('confused') || urlLower.includes('scratch')) {
                  animName = 'thinking';
                } else if (urlLower.includes('wave') || urlLower.includes('hello')) {
                  animName = 'talking';
                } else if (urlLower.includes('walk')) {
                  animName = 'walking';
                } else {
                  // Default mapping based on order (Meshy order: idle, thinking, wave)
                  if (i === 0) animName = 'idle';
                  else if (i === 1) animName = 'thinking';
                  else if (i === 2) animName = 'talking';
                  else animName = clip.name.toLowerCase(); // Use original name as fallback
                }

                // Use the clip directly but with renamed track names if needed
                // Create a new clip with the proper name
                const tracks = clip.tracks.map(track => track.clone());
                const renamedClip = new THREE.AnimationClip(animName, clip.duration, tracks);
                allAnimations.push(renamedClip);
                console.log(`✅ [Model3DViewer] Loaded animation: ${animName} (from ${clip.name}) from ${animationUrls[i]}`);
              });
            } else {
              console.warn(`⚠️ [Model3DViewer] Animation GLB ${i + 1} has no animation clips: ${animationUrls[i]}`);
            }
          } catch (error: any) {
            console.warn(`⚠️ [Model3DViewer] Failed to load animation ${i + 1} from ${animationUrls[i]}:`, error.message);
          }
        }
        console.log(`🎬 [Model3DViewer] Total animations loaded: ${allAnimations.length} (${gltf.animations?.length || 0} from base + ${allAnimations.length - (gltf.animations?.length || 0)} from separate files)`);
      }

      // Enable shadows, materials, and fix frustum culling for animated models
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          // Ensure materials are properly set up for colors and textures
          if (child.material) {
            // Handle both single material and material arrays
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: THREE.Material) => {
              // Enable color rendering for all material types
              if (mat instanceof THREE.MeshStandardMaterial ||
                mat instanceof THREE.MeshBasicMaterial ||
                mat instanceof THREE.MeshPhongMaterial ||
                mat instanceof THREE.MeshLambertMaterial) {
                // Force material update to ensure textures/colors load
                mat.needsUpdate = true;

                // Ensure material is not transparent unless it should be
                if (mat.transparent && mat.opacity < 0.1) {
                  mat.transparent = false;
                  mat.opacity = 1.0;
                }

                // Ensure material is visible
                mat.visible = true;

                // For MeshStandardMaterial, ensure textures are loaded
                if (mat instanceof THREE.MeshStandardMaterial) {
                  // Log material info for debugging and ensure textures load
                  if (mat.map) {
                    const texture = mat.map as THREE.Texture;
                    console.log(`🎨 [Model3DViewer] Material has texture map`);

                    // Ensure texture is properly loaded and visible
                    texture.needsUpdate = true;
                    texture.flipY = false; // GLTF uses flipped Y

                    // Check if texture has image data
                    const hasImage = texture.image !== null && texture.image !== undefined;
                    console.log(`🎨 [Model3DViewer] Texture image status: ${hasImage ? 'present' : 'missing'}`);

                    // Force texture update to ensure it renders
                    texture.needsUpdate = true;
                    console.log(`✅ [Model3DViewer] Texture marked for update`);
                  } else {
                    console.log(`⚠️ [Model3DViewer] Material has NO texture map, using color: #${mat.color.getHexString()}`);
                    // If model is black/white, try to use a more visible color
                    // But first check if the material has any color information
                    const currentColor = mat.color.getHex();
                    if (currentColor === 0xffffff || currentColor === 0x000000 || currentColor === 0x0) {
                      // Model appears to have no color - this might mean textures weren't applied
                      console.warn(`⚠️ [Model3DViewer] Model appears to have no color/texture - this may indicate retexture failed`);
                      mat.color.setHex(0x888888); // Gray fallback
                      console.log(`🎨 [Model3DViewer] Changed material color to gray for visibility: #${mat.color.getHexString()}`);
                    } else {
                      // Material has a color, use it
                      console.log(`🎨 [Model3DViewer] Using material color: #${mat.color.getHexString()}`);
                    }
                  }

                  // Ensure material is not too dark
                  if (mat.color.getHex() === 0x000000) {
                    mat.color.setHex(0x888888); // Gray if black
                  }

                  // Increase material brightness if it's too dark
                  const brightness = mat.color.r + mat.color.g + mat.color.b;
                  if (brightness < 0.3) {
                    mat.color.multiplyScalar(1.5); // Brighten dark materials
                    console.log(`🎨 [Model3DViewer] Brightened dark material: #${mat.color.getHexString()}`);
                  }

                  // Force texture updates
                  if (mat.normalMap) {
                    mat.normalMap.needsUpdate = true;
                    mat.normalMap.flipY = false;
                  }
                  if (mat.roughnessMap) {
                    mat.roughnessMap.needsUpdate = true;
                    mat.roughnessMap.flipY = false;
                  }
                  if (mat.metalnessMap) {
                    mat.metalnessMap.needsUpdate = true;
                    mat.metalnessMap.flipY = false;
                  }

                  // Ensure material uses color if no texture
                  if (!mat.map) {
                    // If no texture, use a visible color (not white, so we can see it)
                    if (mat.color.getHex() === 0xffffff) {
                      mat.color.setHex(0xcccccc); // Light gray so we can see the model
                    }
                    console.log(`🎨 [Model3DViewer] Material color set to: #${mat.color.getHexString()}`);
                  }

                  // Ensure material is not too dark
                  if (mat.color.getHex() === 0x000000) {
                    mat.color.setHex(0x888888); // Gray if black
                  }
                }

                // Force material to update again
                mat.needsUpdate = true;
              }
            });
            // Force geometry update
            if (child.geometry) {
              child.geometry.computeBoundingBox();
            }
          }

          // Disable frustum culling for skinned meshes to prevent disappearing during animation
          if (child instanceof THREE.SkinnedMesh) {
            child.frustumCulled = false;
            // Update bounding box for skinned meshes
            if (child.geometry) {
              child.geometry.computeBoundingBox();
              if (child.geometry.boundingBox) {
                // Expand bounding box to prevent culling issues
                child.geometry.boundingBox.expandByScalar(2);
              }
            }
          }
        }
      });

      // Initialize animation controller if animations are available
      if (allAnimations.length > 0) {
        console.log(`🎬 [Model3DViewer] Found ${allAnimations.length} animations:`,
          allAnimations.map(a => a.name));
        animationControllerRef.current = new AnimationController(model, allAnimations);
        console.log(`✅ [Model3DViewer] Animation controller initialized successfully`);
        console.log(`🔍 [Model3DViewer] Initial state:`, animationControllerRef.current.getCurrentState());
      } else {
        console.warn('⚠️ [Model3DViewer] No animations found in GLTF model or animation URLs');
        console.warn('⚠️ [Model3DViewer] Using fallback visual effects (rotation/scale) instead of animations');
        console.warn('⚠️ [Model3DViewer] To get full animations, ensure animations are generated and uploaded');
        // Set a flag that we're using fallback animations
        animationControllerRef.current = null;
      }

      // Center and scale model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale model to be much smaller - ensure it fits in a reasonable view
      // Use smaller scale to prevent camera from being inside model
      const scale = 1.5 / maxDim; // Even smaller scale

      model.position.x = -center.x * scale;
      model.position.y = -center.y * scale;
      model.position.z = -center.z * scale;
      model.scale.setScalar(scale);

      // Store initial scale for pinch zoom and fallback animations
      baseScaleRef.current = scale;

      // Adjust camera distance based on model size
      if (cameraRef.current) {
        // Calculate appropriate camera distance based on model size
        const modelSize = Math.max(size.x, size.y, size.z) * scale;

        // CRITICAL: Ensure camera is at proper distance - 2-3x model size for good view
        // This prevents camera from being inside the model while keeping it visible
        const minDistance = Math.max(modelSize * 2, 5); // At least 2x model size, minimum 5 units
        const idealDistance = Math.max(modelSize * 2.5, 8); // 2.5x for comfortable view, minimum 8 units

        // Update camera distance
        cameraDistanceRef.current = idealDistance;
        cameraRef.current.position.set(0, 0, cameraDistanceRef.current);

        // Make sure camera can see the entire model range
        const modelDistance = modelSize * 8; // Far plane should be 8x model size
        if (cameraRef.current.near > 0.01) {
          cameraRef.current.near = 0.01;
        }
        if (cameraRef.current.far < modelDistance) {
          cameraRef.current.far = Math.max(modelDistance, 200); // Reasonable far plane
        }
        cameraRef.current.updateProjectionMatrix();

        console.log(`📷 [Model3DViewer] Camera positioned at distance: ${cameraDistanceRef.current.toFixed(1)}, model size: ${modelSize.toFixed(2)}, scale: ${scale.toFixed(4)}`);
        console.log(`📷 [Model3DViewer] Model bounds: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
      }

      scene.add(model);
      setModelLoaded(true);
      setIsLoading(false);
      lastUpdateTimeRef.current = Date.now();

      // Animation loop
      const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !modelRef.current) {
          return;
        }

        // Calculate delta time for animation updates
        const currentTime = Date.now();
        const deltaTime = (currentTime - lastUpdateTimeRef.current) / 1000; // Convert to seconds
        lastUpdateTimeRef.current = currentTime;

        // Update animation controller
        if (animationControllerRef.current) {
          animationControllerRef.current.update(deltaTime);
        }

        // Device motion compensation is handled in the subscription callback
        // No need to do anything here in the animation loop

        // Auto-rotation disabled - model stays still unless manually rotated

        // Apply manual rotation from touch (only if not anchored)
        if (!isAnchored && rotationRef.current.x !== 0 || rotationRef.current.y !== 0) {
          modelRef.current.rotation.x += rotationRef.current.x;
          modelRef.current.rotation.y += rotationRef.current.y;
          // Stronger damping to stop rotation faster
          rotationRef.current.x *= 0.85;
          rotationRef.current.y *= 0.85;

          // Stop rotation if values become very small
          if (Math.abs(rotationRef.current.x) < 0.001) rotationRef.current.x = 0;
          if (Math.abs(rotationRef.current.y) < 0.001) rotationRef.current.y = 0;
        }

        // Apply emotion and movement markers to blend shapes
        // This is a placeholder - actual implementation depends on model structure
        if (modelRef.current) {
          modelRef.current.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.SkinnedMesh && (child as any).morphTargetInfluences) {
              const mesh = child as THREE.SkinnedMesh & { morphTargetInfluences?: number[] };
              // Apply emotion-based blend shapes
              // Note: Actual blend shape indices depend on the model
              // This is a template for future implementation
              if (currentEmotion) {
                // Example: Apply emotion to blend shapes
                // mesh.morphTargetInfluences[emotionBlendShapeIndex] = 1.0;
              }
              if (currentMovement) {
                // Example: Apply movement to blend shapes
                // mesh.morphTargetInfluences[movementBlendShapeIndex] = 1.0;
              }
            }
          });
        }

        // Apply scale
        if (scaleRef.current !== 1) {
          const currentScale = modelRef.current.scale.x;
          modelRef.current.scale.setScalar(currentScale * scaleRef.current);
          scaleRef.current = 1;
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
        gl.endFrameEXP();
        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animate();
    } catch (err: any) {
      console.error('Error loading 3D model:', err);
      setError(err.message || 'Failed to load 3D model');
      setIsLoading(false);
    }
  };

  // Update animations when movement state changes
  useEffect(() => {
    console.log(`🔍 [Model3DViewer] Movement effect triggered:`, {
      hasController: !!animationControllerRef.current,
      currentMovement,
      controllerState: animationControllerRef.current?.getCurrentState(),
    });

    if (!currentMovement || !modelRef.current) {
      console.log(`ℹ️ [Model3DViewer] No movement set or model not loaded, skipping animation update`);
      return;
    }

    // If we have animations, use the animation controller
    if (animationControllerRef.current) {
      // Map movement string to MovementState enum
      // Handles both animation states and backend marker values
      const movementStateMap: Record<string, MovementState> = {
        // Direct animation states
        'idle': MovementState.IDLE,
        'thinking': MovementState.THINKING,
        'walking': MovementState.WALKING,
        'walk': MovementState.WALKING,
        'flying': MovementState.FLYING,
        'fly': MovementState.FLYING,
        'talking': MovementState.TALKING,
        'talk': MovementState.TALKING,
        'speak': MovementState.TALKING,
        // Backend marker values mapped to animations
        'smiling': MovementState.TALKING, // Smiling usually happens while talking
        'frown': MovementState.THINKING,  // Frowning often during thinking
        'listening': MovementState.IDLE,   // Listening = idle state
        'wave': MovementState.TALKING,     // Wave gesture during talking
        'nod': MovementState.TALKING,      // Nodding during talking
        'point': MovementState.TALKING,    // Pointing during talking
      };

      const targetState = movementStateMap[currentMovement.toLowerCase()];
      if (targetState) {
        const currentState = animationControllerRef.current.getCurrentState();
        console.log(`🎬 [Model3DViewer] Movement change: ${currentMovement} → ${targetState} (current: ${currentState})`);
        // Always transition, even if same state (to restart animation)
        // Force transition by allowing interrupt
        try {
          animationControllerRef.current.transitionTo(targetState, true); // allowInterrupt = true
          console.log(`✅ [Model3DViewer] Animation transition triggered to ${targetState}`);
        } catch (error) {
          console.error(`❌ [Model3DViewer] Animation transition failed:`, error);
          // Try again without interrupt check
          animationControllerRef.current.transitionTo(targetState, false);
        }
      } else {
        console.warn(`⚠️ [Model3DViewer] Unknown movement: ${currentMovement}, defaulting to IDLE`);
        // Default to idle if movement not recognized
        try {
          animationControllerRef.current.transitionTo(MovementState.IDLE, true);
        } catch (error) {
          console.error(`❌ [Model3DViewer] Failed to transition to IDLE:`, error);
        }
      }
    } else {
      // Fallback: Use simple visual effects when model has no animations
      // IMPORTANT: Use subtle effects that don't move the model out of view
      console.log(`🎨 [Model3DViewer] Using fallback visual effect for movement: ${currentMovement}`);

      const movement = currentMovement.toLowerCase();
      const model = modelRef.current;

      if (!model) return;

      // Store original values for reset
      // Get current scale from model (not baseScaleRef which might be stale)
      const currentScale = model.scale.x;
      const baseScale = baseScaleRef.current || currentScale; // Use base scale if available, otherwise current
      const originalRotation = {
        x: model.rotation.x,
        y: model.rotation.y,
        z: model.rotation.z,
      };

      // Apply subtle visual feedback based on movement
      // NOTE: These are temporary fallback effects. For proper animations, 
      // you need to regenerate the avatar with Meshy's rigging/animation API enabled.
      // The current model doesn't have GLTF animation clips.
      if (movement === 'talking' || movement === 'talk' || movement === 'speak') {
        // Very subtle scale pulse (1.02 multiplier = 2% increase)
        const targetScale = currentScale * 1.02;
        model.scale.setScalar(targetScale);
        console.log(`🎨 [Model3DViewer] Applied talking effect (scale: ${currentScale.toFixed(3)} → ${targetScale.toFixed(3)})`);
        console.log(`⚠️ [Model3DViewer] This is a fallback effect. For proper animations, regenerate avatar with Meshy rigging/animation.`);

        // Reset after animation
        setTimeout(() => {
          if (modelRef.current) {
            modelRef.current.scale.setScalar(currentScale);
          }
        }, 300);
      } else if (movement === 'thinking') {
        // Very subtle rotation (0.05 instead of 0.1)
        model.rotation.z = originalRotation.z + 0.05;
        console.log(`🎨 [Model3DViewer] Applied thinking effect (subtle tilt)`);

        setTimeout(() => {
          if (modelRef.current) {
            modelRef.current.rotation.z = originalRotation.z;
          }
        }, 500);
      } else if (movement === 'walking' || movement === 'walk') {
        // Very subtle forward lean
        model.rotation.x = originalRotation.x - 0.05;
        console.log(`🎨 [Model3DViewer] Applied walking effect (subtle lean)`);

        setTimeout(() => {
          if (modelRef.current) {
            modelRef.current.rotation.x = originalRotation.x;
          }
        }, 400);
      } else if (movement === 'idle') {
        // Reset to original position/scale
        // Use base scale (the original scale when model was loaded)
        model.rotation.set(originalRotation.x, originalRotation.y, originalRotation.z);
        model.scale.setScalar(baseScale);
        console.log(`🎨 [Model3DViewer] Reset to idle (neutral, scale: ${baseScale.toFixed(3)})`);
      }
    }
  }, [currentMovement]);

  // Update animations when markers change
  useEffect(() => {
    if (!modelRef.current || !markers.length) return;

    // Extract latest emotion and movement from markers
    const latestEmotion = markers.filter(m => m.type === 'emotion').pop()?.value;
    const latestMovement = markers.filter(m => m.type === 'movement').pop()?.value;

    // Apply movement to animation controller
    if (latestMovement && animationControllerRef.current) {
      const movementStateMap: Record<string, MovementState> = {
        // Direct animation states
        'idle': MovementState.IDLE,
        'thinking': MovementState.THINKING,
        'walking': MovementState.WALKING,
        'walk': MovementState.WALKING,
        'flying': MovementState.FLYING,
        'fly': MovementState.FLYING,
        'talking': MovementState.TALKING,
        'talk': MovementState.TALKING,
        'speak': MovementState.TALKING,
        // Backend marker values mapped to animations
        'smiling': MovementState.TALKING,
        'frown': MovementState.THINKING,
        'listening': MovementState.IDLE,
        'wave': MovementState.TALKING,
        'nod': MovementState.TALKING,
        'point': MovementState.TALKING,
      };

      const targetState = movementStateMap[latestMovement.toLowerCase()];
      if (targetState) {
        animationControllerRef.current.transitionTo(targetState);
      } else {
        console.warn(`⚠️ [Model3DViewer] Unknown movement from markers: ${latestMovement}`);
      }
    }

    // Apply to model (placeholder - actual implementation depends on model structure)
    if (latestEmotion || latestMovement) {
      console.log('🎭 [Model3DViewer] Applying markers:', { emotion: latestEmotion, movement: latestMovement });
      // TODO: Apply blend shapes based on emotion/movement
      // This requires knowledge of the model's blend shape structure
    }
  }, [markers, currentEmotion, currentMovement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Cleanup animation controller
      if (animationControllerRef.current) {
        animationControllerRef.current.dispose();
        animationControllerRef.current = null;
      }
      // Cleanup device motion subscription
      if (deviceMotionSubscriptionRef.current) {
        deviceMotionSubscriptionRef.current.remove();
        deviceMotionSubscriptionRef.current = null;
      }
    };
  }, []);

  // Note: Pinch to zoom is now handled in panResponder above

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF3B30" />
          <Text style={styles.errorText}>Error: {error}</Text>
          {onClose && (
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, enableAR && styles.containerTransparent]} {...panResponder.panHandlers}>
      {/* Controls Bar - Hide in AR mode */}
      {!enableAR && (
        <View style={styles.controlsBar}>
          {onClose && (
            <TouchableOpacity style={styles.controlButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          )}
          {enableAR && onARPress && (
            <TouchableOpacity style={styles.controlButton} onPress={onARPress}>
              <Ionicons name="cube" size={24} color="#007AFF" />
              <Text style={styles.controlButtonText}>AR</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3D Canvas */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading 3D model...</Text>
        </View>
      )}

      <GLView
        style={[styles.glView, enableAR && styles.glViewTransparent]}
        onContextCreate={onContextCreate}
      />

      {/* Zoom Controls */}
      {modelLoaded && !enableAR && (
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => {
              try {
                if (!cameraRef.current) {
                  console.warn('⚠️ [Model3DViewer] Camera not available for zoom in');
                  return;
                }
                const newDistance = Math.max(5, cameraDistanceRef.current - 2); // Min 5 units, step 2
                cameraDistanceRef.current = newDistance;
                cameraRef.current.position.z = newDistance;
                cameraRef.current.updateProjectionMatrix();
                console.log(`🔍 [Model3DViewer] Zoom in: ${cameraDistanceRef.current.toFixed(1)}`);
              } catch (error) {
                console.error('❌ [Model3DViewer] Zoom in error:', error);
              }
            }}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomButton}
            onPress={() => {
              try {
                if (!cameraRef.current) {
                  console.warn('⚠️ [Model3DViewer] Camera not available for zoom out');
                  return;
                }
                const newDistance = Math.min(50, cameraDistanceRef.current + 2); // Max 50 units, step 2
                cameraDistanceRef.current = newDistance;
                cameraRef.current.position.z = newDistance;
                cameraRef.current.updateProjectionMatrix();
                console.log(`🔍 [Model3DViewer] Zoom out: ${cameraDistanceRef.current.toFixed(1)}`);
              } catch (error) {
                console.error('❌ [Model3DViewer] Zoom out error:', error);
              }
            }}
          >
            <Ionicons name="remove" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Instructions - Hide in AR mode */}
      {modelLoaded && !enableAR && (
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            👆 Drag to rotate • Pinch to zoom {isAnchored ? '• 🔒 Anchored' : '• Double tap to anchor'}
          </Text>
        </View>
      )}

      {/* Anchor indicator */}
      {isAnchored && (
        <View style={styles.anchorIndicator}>
          <Ionicons name="lock-closed" size={20} color="#34C759" />
          <Text style={styles.anchorText}>Anchored</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  containerTransparent: {
    backgroundColor: 'transparent',
  },
  controlsBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  glView: {
    flex: 1,
  },
  glViewTransparent: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 5,
  },
  loadingText: {
    marginTop: 12,
    color: '#FFF',
    fontSize: 16,
  },
  instructions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  instructionText: {
    color: '#FFF',
    fontSize: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  anchorIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  anchorText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  zoomControls: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    flexDirection: 'column',
    gap: 12,
    zIndex: 10,
  },
  zoomButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});
