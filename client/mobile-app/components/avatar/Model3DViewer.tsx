// 3D Model Viewer Component using Three.js and expo-gl
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, PanResponder, GestureResponderEvent } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Ionicons } from '@expo/vector-icons';
import { DeviceMotion } from 'expo-sensors';

import { Marker } from '../../utils/markerParser';

interface Model3DViewerProps {
  modelUrl: string;
  onClose?: () => void;
  enableAR?: boolean;
  onARPress?: () => void;
  markers?: Marker[]; // Emotion and movement markers for animations
  currentEmotion?: string; // Current emotion state
  currentMovement?: string; // Current movement state
  visemes?: Array<{ id: number; offset: number; duration: number }>; // Viseme data for lip sync
  audioUrl?: string; // TTS audio URL for playback
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({
  modelUrl,
  onClose,
  enableAR = false,
  onARPress,
  markers = [],
  currentEmotion,
  currentMovement,
  visemes = [],
  audioUrl,
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
  const [isAnchored, setIsAnchored] = useState(false);
  const anchorPositionRef = useRef<THREE.Vector3 | null>(null);
  const anchorRotationRef = useRef<{ alpha: number; beta: number; gamma: number } | null>(null);
  const deviceMotionSubscriptionRef = useRef<any>(null);
  const initialCameraRotationRef = useRef<THREE.Euler | null>(null);
  const initialModelRotationRef = useRef<THREE.Euler | null>(null);
  const currentVisemeIdRef = useRef<number | null>(null);
  const visemeStartTimeRef = useRef<number | null>(null);
  const visemeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const morphTargetDictionaryRef = useRef<Map<string, number>>(new Map());

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
      initialCameraRotationRef.current = null;
      if (deviceMotionSubscriptionRef.current) {
        deviceMotionSubscriptionRef.current.remove();
        deviceMotionSubscriptionRef.current = null;
      }
      // Reset camera rotation to initial state
      if (cameraRef.current && initialCameraRotationRef.current) {
        cameraRef.current.rotation.copy(initialCameraRotationRef.current);
      }
      // Reset model rotation to initial state
      if (modelRef.current && initialModelRotationRef.current) {
        modelRef.current.rotation.copy(initialModelRotationRef.current);
      }
      initialModelRotationRef.current = null;
      console.log('🔓 [Model3DViewer] Model unanchored');
    } else {
      // Anchor: lock model position and start tracking device motion
      setIsAnchored(true);
      // Store current model position in world space
      anchorPositionRef.current = modelRef.current.position.clone();
      // Store initial model rotation
      if (modelRef.current) {
        initialModelRotationRef.current = modelRef.current.rotation.clone();
      }
      // Store initial camera rotation as Euler (will convert to quaternion when needed)
      if (cameraRef.current) {
        initialCameraRotationRef.current = cameraRef.current.rotation.clone();
      }
      
      // Check if device motion is available, request permissions, and start tracking
      DeviceMotion.isAvailableAsync().then(async (available) => {
        if (!available) {
          console.warn('⚠️ [Model3DViewer] Device motion not available on this device');
          setIsAnchored(false);
          return;
        }
        
        // Request permissions (required on iOS)
        try {
          const permissionResult = await DeviceMotion.requestPermissionsAsync();
          console.log('📱 [Model3DViewer] Permission result:', permissionResult);
          
          if (permissionResult.status !== 'granted') {
            // Check if we can ask again (Android) or if it's permanently denied
            if (permissionResult.canAskAgain === false) {
              console.warn('⚠️ [Model3DViewer] Device motion permission permanently denied. User must enable in settings.');
            } else {
              console.warn('⚠️ [Model3DViewer] Device motion permission denied, status:', permissionResult.status);
            }
            
            // On some platforms (like Android), motion sensors might work without explicit permission
            // Try to proceed anyway - if it fails, the listener won't receive data
            console.log('ℹ️ [Model3DViewer] Attempting to use device motion anyway (may work on some platforms)');
          } else {
            console.log('✅ [Model3DViewer] Device motion permission granted');
          }
        } catch (error) {
          // Some platforms might not require explicit permissions
          console.log('ℹ️ [Model3DViewer] Permission request error (may not be required):', error);
          // Continue anyway - some platforms don't need explicit permission
        }
        
        // Set update interval for smooth tracking
        DeviceMotion.setUpdateInterval(50); // Update every 50ms
        
        let initialRotation: { alpha: number; beta: number; gamma: number } | null = null;
        
        // Create subscription to device motion
        const subscription = DeviceMotion.addListener((motion) => {
          if (!motion || !motion.rotation) {
            console.warn('⚠️ [Model3DViewer] No rotation data in motion event');
            return;
          }
          
          if (modelRef.current && anchorPositionRef.current && cameraRef.current) {
            const rotation = motion.rotation;
            
            // Store initial rotation on first reading
            if (!initialRotation) {
              initialRotation = {
                alpha: rotation.alpha || 0,
                beta: rotation.beta || 0,
                gamma: rotation.gamma || 0,
              };
              anchorRotationRef.current = initialRotation;
              console.log('📐 [Model3DViewer] Initial rotation captured:', initialRotation);
              return;
            }
            
            // Device orientation deltas (in radians)
            const alphaRad = ((rotation.alpha || 0) - initialRotation.alpha) * (Math.PI / 180);
            const betaRad = ((rotation.beta || 0) - initialRotation.beta) * (Math.PI / 180);
            const gammaRad = ((rotation.gamma || 0) - initialRotation.gamma) * (Math.PI / 180);
            
            // NEW APPROACH: Don't rotate camera, rotate the MODEL instead
            // When device rotates, rotate model in OPPOSITE direction
            // This keeps model appearing in same screen position
            
            if (modelRef.current && anchorPositionRef.current && cameraRef.current) {
              // Create quaternions for INVERSE device rotation (to compensate)
              const quatZ = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 0, 1), // Z-axis for yaw
                -alphaRad // INVERTED - rotate model opposite to device
              );
              
              const quatX = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0), // X-axis for pitch
                -betaRad // INVERTED
              );
              
              const quatY = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0), // Y-axis for roll
                gammaRad // Keep original sign
              );
              
              // Combine: Z * X * Y
              const compensationQuat = new THREE.Quaternion();
              compensationQuat.multiplyQuaternions(quatZ, quatX);
              compensationQuat.multiply(quatY);
              
              // Get initial model rotation
              if (initialModelRotationRef.current) {
                const initialModelQuat = new THREE.Quaternion().setFromEuler(
                  initialModelRotationRef.current
                );
                
                // Apply compensation rotation to model (rotate opposite to device)
                const finalModelQuat = initialModelQuat.clone().multiply(compensationQuat);
                modelRef.current.quaternion.copy(finalModelQuat);
              }
              
              // Transform model position to compensate for device rotation
              // Start with anchor position
              const anchorWorldPos = anchorPositionRef.current.clone();
              
              // Apply inverse device rotation to position (compensate for device movement)
              anchorWorldPos.applyQuaternion(compensationQuat);
              
              // Set model position
              modelRef.current.position.copy(anchorWorldPos);
            }
            
            // Debug logging (reduced frequency)
            if (Math.abs(alphaRad) > 0.05 || Math.abs(betaRad) > 0.05 || Math.abs(gammaRad) > 0.05) {
              if (modelRef.current) {
                const modelEuler = new THREE.Euler().setFromQuaternion(modelRef.current.quaternion);
                console.log('🔄 [Model3DViewer] Model compensated:', { 
                  device: {
                    alpha: ((rotation.alpha || 0) - initialRotation.alpha).toFixed(1) + '°', 
                    beta: ((rotation.beta || 0) - initialRotation.beta).toFixed(1) + '°', 
                    gamma: ((rotation.gamma || 0) - initialRotation.gamma).toFixed(1) + '°'
                  },
                  modelRot: `(${(modelEuler.x * 180 / Math.PI).toFixed(1)}°, ${(modelEuler.y * 180 / Math.PI).toFixed(1)}°, ${(modelEuler.z * 180 / Math.PI).toFixed(1)}°)`,
                  modelPos: `(${modelRef.current.position.x.toFixed(2)}, ${modelRef.current.position.y.toFixed(2)}, ${modelRef.current.position.z.toFixed(2)})`
                });
              }
            }
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
        1000
      );
      camera.position.set(0, 0, 5);
      cameraRef.current = camera;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight1.position.set(5, 5, 5);
      directionalLight1.castShadow = true;
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight2.position.set(-5, -5, -5);
      scene.add(directionalLight2);

      const pointLight = new THREE.PointLight(0xffffff, 0.5);
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

      // Load GLB/GLTF model with caching for performance
      const loader = new GLTFLoader();
      // Use cache to avoid reloading when switching modes
      const cacheKey = `model_${modelUrl}`;
      let gltf;
      
      // Check if model is already loaded (simple in-memory cache)
      if ((global as any).__modelCache?.[cacheKey]) {
        console.log('📦 [Model3DViewer] Using cached model');
        gltf = (global as any).__modelCache[cacheKey];
        // Clone the scene to avoid sharing references
        gltf = { scene: gltf.scene.clone() };
      } else {
        console.log('📥 [Model3DViewer] Loading model from URL');
        gltf = await loader.loadAsync(modelUrl);
        // Cache the loaded model
        if (!(global as any).__modelCache) {
          (global as any).__modelCache = {};
        }
        (global as any).__modelCache[cacheKey] = gltf;
      }
      
      const model = gltf.scene;
      modelRef.current = model;
      
      // Enable shadows and build morph target dictionary
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Build morph target dictionary for viseme/blend shape mapping
          if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
            // Store morph target indices for viseme mapping
            Object.entries(child.morphTargetDictionary).forEach(([name, index]) => {
              morphTargetDictionaryRef.current.set(name.toLowerCase(), index);
            });
            console.log('📋 [Model3DViewer] Morph targets found:', Array.from(morphTargetDictionaryRef.current.keys()));
          }
        }
      });

      // Center and scale model
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim; // Scale to fit nicely

      model.position.x = -center.x * scale;
      model.position.y = -center.y * scale;
      model.position.z = -center.z * scale;
      model.scale.setScalar(scale);
      
      // Store initial scale for pinch zoom
      baseScaleRef.current = scale;

      scene.add(model);
      setModelLoaded(true);
      setIsLoading(false);

      // Animation loop
      const animate = () => {
        if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !modelRef.current) {
          return;
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

        // Apply emotion, movement, and viseme markers to blend shapes
        if (modelRef.current) {
          modelRef.current.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences) {
              const mesh = child as THREE.SkinnedMesh;
              const influences = mesh.morphTargetInfluences;
              
              // Reset all morph targets first
              if (influences) {
                for (let i = 0; i < influences.length; i++) {
                  influences[i] = 0;
                }
              }
              
              // Apply viseme (lip sync)
              if (currentVisemeIdRef.current !== null && influences) {
                const visemeMapping = getVisemeBlendShape(currentVisemeIdRef.current);
                if (visemeMapping.mouthOpen > 0) {
                  // Try common mouth blend shape names
                  const mouthOpenIndex = findMorphTargetIndex('mouthopen', 'jawopen', 'ah', 'aa', 'mouth_open');
                  if (mouthOpenIndex !== -1 && mouthOpenIndex < influences.length) {
                    influences[mouthOpenIndex] = visemeMapping.mouthOpen;
                  }
                }
              }
              
              // Apply emotion blend shapes
              if (currentEmotion && influences) {
                const emotionIndex = findMorphTargetIndex(
                  currentEmotion.toLowerCase(),
                  `emotion_${currentEmotion.toLowerCase()}`,
                  `exp_${currentEmotion.toLowerCase()}`,
                  `happy`,
                  `sad`,
                  `angry`,
                  `surprised`
                );
                if (emotionIndex !== -1 && emotionIndex < influences.length) {
                  influences[emotionIndex] = 1.0;
                }
              }
              
              // Apply movement/gesture blend shapes
              if (currentMovement && influences) {
                const movementIndex = findMorphTargetIndex(
                  currentMovement.toLowerCase(),
                  `gesture_${currentMovement.toLowerCase()}`,
                  `pose_${currentMovement.toLowerCase()}`,
                  `idle`,
                  `thinking`,
                  `talking`
                );
                if (movementIndex !== -1 && movementIndex < influences.length) {
                  influences[movementIndex] = 1.0;
                }
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

  // Helper function to find morph target index by name
  const findMorphTargetIndex = React.useCallback((...names: string[]): number => {
    for (const name of names) {
      const index = morphTargetDictionaryRef.current.get(name.toLowerCase());
      if (index !== undefined) {
        return index;
      }
    }
    return -1;
  }, []);

  // Helper function to get viseme blend shape mapping
  const getVisemeBlendShape = React.useCallback((visemeId: number): { mouthOpen: number; mouthShape: string } => {
    // Import viseme mapping (simplified - use actual mapping from phonemeToViseme)
    const mapping: Record<number, { mouthOpen: number; mouthShape: string }> = {
      0: { mouthOpen: 0, mouthShape: 'neutral' }, // SILENCE
      1: { mouthOpen: 0.8, mouthShape: 'aa' }, // AA_AO_AW
      2: { mouthOpen: 0.6, mouthShape: 'aa' }, // AA
      3: { mouthOpen: 0.7, mouthShape: 'ao' }, // AA_AO
      4: { mouthOpen: 0.5, mouthShape: 'eh' }, // EH_ER
      5: { mouthOpen: 0.4, mouthShape: 'ih' }, // IH_IY
      6: { mouthOpen: 0.6, mouthShape: 'ow' }, // OW_OY
      7: { mouthOpen: 0.3, mouthShape: 'uw' }, // UW
      8: { mouthOpen: 0, mouthShape: 'closed' }, // M_B_P
      9: { mouthOpen: 0.1, mouthShape: 'f' }, // F_V
      10: { mouthOpen: 0.2, mouthShape: 'th' }, // TH_DH
      11: { mouthOpen: 0.1, mouthShape: 't' }, // T_D_N_L
      12: { mouthOpen: 0.2, mouthShape: 's' }, // S_Z
      13: { mouthOpen: 0.3, mouthShape: 'sh' }, // SH_CH_JH_ZH
      14: { mouthOpen: 0.1, mouthShape: 'k' }, // K_G_NG
      15: { mouthOpen: 0.3, mouthShape: 'y' }, // Y
      16: { mouthOpen: 0.2, mouthShape: 'w' }, // W
      17: { mouthOpen: 0.3, mouthShape: 'r' }, // R
      18: { mouthOpen: 0.2, mouthShape: 'l' }, // L
      19: { mouthOpen: 0.2, mouthShape: 'th' }, // TH
      20: { mouthOpen: 0.2, mouthShape: 'th' }, // TH_ALT
      21: { mouthOpen: 0, mouthShape: 'neutral' }, // SILENCE_END
    };
    return mapping[visemeId] || { mouthOpen: 0, mouthShape: 'neutral' };
  }, []);

  // Update visemes in real-time
  useEffect(() => {
    if (!visemes || visemes.length === 0) {
      currentVisemeIdRef.current = null;
      visemeStartTimeRef.current = null;
      if (visemeUpdateIntervalRef.current) {
        clearInterval(visemeUpdateIntervalRef.current);
        visemeUpdateIntervalRef.current = null;
      }
      return;
    }

    // Start viseme animation
    visemeStartTimeRef.current = Date.now();
    let visemeIndex = 0;

    const updateViseme = () => {
      if (visemeIndex < visemes.length && visemeStartTimeRef.current) {
        const elapsed = Date.now() - visemeStartTimeRef.current;
        const currentViseme = visemes[visemeIndex];

        if (elapsed >= currentViseme.offset) {
          currentVisemeIdRef.current = currentViseme.id;
          visemeIndex++;
        }

        if (visemeIndex < visemes.length) {
          visemeUpdateIntervalRef.current = setTimeout(updateViseme, 50); // Update every 50ms
        } else {
          // All visemes played, reset
          currentVisemeIdRef.current = null;
          visemeStartTimeRef.current = null;
        }
      }
    };

    updateViseme();

    return () => {
      if (visemeUpdateIntervalRef.current) {
        clearTimeout(visemeUpdateIntervalRef.current);
        visemeUpdateIntervalRef.current = null;
      }
    };
  }, [visemes]);

  // Update animations when markers change
  useEffect(() => {
    if (!modelRef.current || !markers.length) return;

    // Extract latest emotion and movement from markers
    const latestEmotion = markers.filter(m => m.type === 'emotion').pop()?.value;
    const latestMovement = markers.filter(m => m.type === 'movement').pop()?.value;

    // Apply to model
    if (latestEmotion || latestMovement) {
      console.log('🎭 [Model3DViewer] Applying markers:', { emotion: latestEmotion, movement: latestMovement });
    }
  }, [markers, currentEmotion, currentMovement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
      {/* Header with back button - Always visible */}
      <View style={[styles.header, enableAR && styles.headerTransparent]}>
        {onClose && (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              console.log('🔙 [Model3DViewer] Back button pressed, calling onClose');
              if (onClose) {
                onClose();
              } else {
                console.warn('⚠️ [Model3DViewer] onClose is not defined');
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={enableAR ? "#FFFFFF" : "#000000"} />
            <Text style={[styles.backButtonText, enableAR && styles.backButtonTextWhite]}>Back</Text>
          </TouchableOpacity>
        )}
        {enableAR && onARPress && (
          <TouchableOpacity style={styles.arButton} onPress={onARPress}>
            <Ionicons name="cube" size={20} color="#007AFF" />
            <Text style={styles.arButtonText}>AR Mode</Text>
          </TouchableOpacity>
        )}
      </View>

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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50, // Account for safe area
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    zIndex: 1000, // Higher z-index to ensure it's clickable
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTransparent: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  backButtonTextWhite: {
    color: '#FFFFFF',
  },
  arButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.9)',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  arButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
});
