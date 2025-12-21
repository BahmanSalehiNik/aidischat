// ViroReact-based 3D Model Viewer with AR Support
import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import {
  ViroARScene,
  Viro3DObject,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroNode,
  ViroAnimations,
  ViroAnimation,
  ViroScene,
  ViroARSceneNavigator,
  ViroSceneNavigator,
} from '@reactvision/react-viro';
import { Marker } from '../../utils/markerParser';
import { MovementState } from '../../utils/animations/animationTypes';

interface ViroModelViewerProps {
  modelUrl: string;
  onClose?: () => void;
  enableAR?: boolean;
  onARPress?: () => void;
  markers?: Marker[];
  currentEmotion?: string;
  currentMovement?: string;
}

// Map movement states to Viro animation names
const MOVEMENT_TO_ANIMATION: Record<string, string> = {
  'idle': 'idle',
  'thinking': 'thinking',
  'walking': 'walking',
  'walk': 'walking',
  'flying': 'flying',
  'fly': 'flying',
  'talking': 'talking',
  'talk': 'talking',
  'speak': 'talking',
  'smiling': 'talking',
  'listening': 'idle',
  'wave': 'talking',
  'nod': 'talking',
};

// Default Viro animations configuration
// These will be used if the model doesn't have animations
const DEFAULT_ANIMATIONS = {
  idle: {
    properties: {
      rotateY: '+=360',
    },
    duration: 10000, // 10 seconds
  },
  talking: {
    properties: {
      scaleX: '+=0.1',
      scaleY: '+=0.1',
      scaleZ: '+=0.1',
    },
    duration: 500,
    easing: 'EaseInEaseOut',
  },
  thinking: {
    properties: {
      rotateZ: '+=15',
    },
    duration: 1000,
    easing: 'EaseInEaseOut',
  },
  walking: {
    properties: {
      positionY: '+=0.1',
    },
    duration: 500,
    easing: 'EaseInEaseOut',
  },
};

export const ViroModelViewer: React.FC<ViroModelViewerProps> = ({
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
  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const animationRef = useRef<any>(null);

  useEffect(() => {
    if (currentMovement) {
      const movement = currentMovement.toLowerCase();
      const animationName = MOVEMENT_TO_ANIMATION[movement] || 'idle';
      
      if (animationName !== currentAnimation) {
        console.log(`🎬 [ViroModelViewer] Changing animation: ${currentAnimation} → ${animationName}`);
        setCurrentAnimation(animationName);
      }
    } else {
      setCurrentAnimation('idle');
    }
  }, [currentMovement, currentAnimation]);

  const handleModelLoad = () => {
    console.log('✅ [ViroModelViewer] Model loaded successfully');
    setIsLoading(false);
  };

  const handleModelError = (event: any) => {
    console.error('❌ [ViroModelViewer] Model load error:', event);
    setError(event.nativeEvent?.error || 'Failed to load model');
    setIsLoading(false);
  };

  // AR Scene Component
  const ARScene = () => {
    return (
      <ViroARScene>
        <ViroAmbientLight color="#ffffff" intensity={400} />
        <ViroDirectionalLight
          direction={[0, -1, -0.2]}
          color="#ffffff"
          intensity={1000}
        />
        
        <ViroNode position={[0, 0, -1]} scale={[0.5, 0.5, 0.5]}>
          <Viro3DObject
            source={{ uri: modelUrl }}
            type="GLB"
            position={[0, 0, 0]}
            scale={[1, 1, 1]}
            rotation={[0, 0, 0]}
            animation={{
              name: currentAnimation,
              loop: currentAnimation === 'idle' || currentAnimation === 'walking',
              run: true,
            }}
            onLoadStart={() => {
              console.log('🔄 [ViroModelViewer] Model loading started');
              setIsLoading(true);
            }}
            onLoad={handleModelLoad}
            onError={handleModelError}
            materials={['default']}
          />
        </ViroNode>
      </ViroARScene>
    );
  };

  // 3D Scene Component (non-AR)
  const Scene3D = () => {
    return (
      <ViroScene>
        <ViroAmbientLight color="#ffffff" intensity={400} />
        <ViroDirectionalLight
          direction={[0, -1, -0.2]}
          color="#ffffff"
          intensity={1000}
        />
        
        <ViroNode position={[0, 0, -2]} scale={[0.5, 0.5, 0.5]}>
          <Viro3DObject
            source={{ uri: modelUrl }}
            type="GLB"
            position={[0, 0, 0]}
            scale={[1, 1, 1]}
            rotation={[0, 0, 0]}
            animation={{
              name: currentAnimation,
              loop: currentAnimation === 'idle' || currentAnimation === 'walking',
              run: true,
            }}
            onLoadStart={() => {
              console.log('🔄 [ViroModelViewer] Model loading started');
              setIsLoading(true);
            }}
            onLoad={handleModelLoad}
            onError={handleModelError}
            materials={['default']}
          />
        </ViroNode>
      </ViroScene>
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (enableAR) {
    return (
      <View style={styles.container}>
        <ViroARSceneNavigator
          initialScene={{ scene: ARScene }}
          style={styles.viroContainer}
        />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading AR Model...</Text>
          </View>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ViroSceneNavigator
        initialScene={{ scene: Scene3D }}
        style={styles.viroContainer}
      />
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading 3D Model...</Text>
        </View>
      )}
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viroContainer: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
  },
  errorText: {
    color: '#FF0000',
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

// Register default animations
ViroAnimations.registerAnimations(DEFAULT_ANIMATIONS);
