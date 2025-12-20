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

interface Model3DViewerProps {
  modelUrl: string;
  onClose?: () => void;
  enableAR?: boolean;
  onARPress?: () => void;
  markers?: Marker[]; // Emotion and movement markers for animations
  currentEmotion?: string; // Current emotion state
  currentMovement?: string; // Current movement state
}

export const Model3DViewer: React.FC<Model3DViewerProps> = ({
  modelUrl,
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
        
        // Request permissions (required on iOS)
        try {
          const { status } = await DeviceMotion.requestPermissionsAsync();
          if (status !== 'granted') {
            console.warn('⚠️ [Model3DViewer] Device motion permission denied');
            setIsAnchored(false);
            return;
          }
        } catch (error) {
          // Some platforms might not require explicit permissions
          console.log('ℹ️ [Model3DViewer] Permission request not needed or failed:', error);
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

      // Load GLB/GLTF model
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl);
      
      const model = gltf.scene;
      modelRef.current = model;
      
      // Enable shadows
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Initialize animation controller if animations are available
      if (gltf.animations && gltf.animations.length > 0) {
        console.log(`🎬 [Model3DViewer] Found ${gltf.animations.length} animations:`, 
          gltf.animations.map(a => a.name));
        animationControllerRef.current = new AnimationController(model, gltf.animations);
      } else {
        console.warn('⚠️ [Model3DViewer] No animations found in GLTF model');
      }

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
    if (!animationControllerRef.current || !currentMovement) return;

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
      if (currentState !== targetState) {
        console.log(`🎬 [Model3DViewer] Movement change: ${currentMovement} → ${targetState}`);
        animationControllerRef.current.transitionTo(targetState);
      }
    } else {
      console.warn(`⚠️ [Model3DViewer] Unknown movement: ${currentMovement}, defaulting to IDLE`);
      // Default to idle if movement not recognized
      const currentState = animationControllerRef.current.getCurrentState();
      if (currentState !== MovementState.IDLE) {
        animationControllerRef.current.transitionTo(MovementState.IDLE);
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
});
