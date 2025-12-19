// ViroReact AR Model Viewer Component
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import {
  ViroARScene,
  ViroARPlaneSelector,
  Viro3DObject,
  ViroAmbientLight,
  ViroDirectionalLight,
  ViroNode,
  ViroText,
} from '@reactvision/react-viro';
import { Ionicons } from '@expo/vector-icons';

import { Marker } from '../../utils/markerParser';

interface ViroARModelViewerProps {
  modelUrl: string;
  onClose?: () => void;
  markers?: Marker[];
  currentEmotion?: string;
  currentMovement?: string;
}

export const ViroARModelViewer: React.FC<ViroARModelViewerProps> = ({
  modelUrl,
  onClose,
  markers = [],
  currentEmotion,
  currentMovement,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelPosition, setModelPosition] = useState<[number, number, number]>([0, 0, -1]); // 1 meter in front
  const [modelScale, setModelScale] = useState<[number, number, number]>([0.1, 0.1, 0.1]);
  const [isPlaced, setIsPlaced] = useState(false);

  useEffect(() => {
    // Reset placement when model URL changes
    setIsPlaced(false);
    setIsLoading(true);
    setError(null);
  }, [modelUrl]);

  const handleModelLoad = () => {
    setIsLoading(false);
    setError(null);
    console.log('✅ [ViroARModelViewer] Model loaded successfully');
  };

  const handleModelError = (error: any) => {
    setIsLoading(false);
    setError('Failed to load 3D model');
    console.error('❌ [ViroARModelViewer] Model load error:', error);
  };

  const handlePlaneSelected = (position: [number, number, number]) => {
    // When user taps on a detected plane, place the model there
    setModelPosition(position);
    setIsPlaced(true);
    console.log('📍 [ViroARModelViewer] Model placed at:', position);
  };

  return (
    <View style={styles.container}>
      <ViroARScene onTrackingUpdated={(state) => {
        if (state === 'TRACKING_NORMAL') {
          console.log('✅ [ViroARModelViewer] AR tracking normal');
        } else if (state === 'TRACKING_UNAVAILABLE') {
          console.warn('⚠️ [ViroARModelViewer] AR tracking unavailable');
        }
      }}>
        {/* Lighting */}
        <ViroAmbientLight color="#ffffff" intensity={0.6} />
        <ViroDirectionalLight
          direction={[0, -1, -0.5]}
          color="#ffffff"
          intensity={0.8}
          castsShadow={true}
        />

        {/* Plane selector - detects flat surfaces and allows placement */}
        <ViroARPlaneSelector
          onPlaneSelected={handlePlaneSelected}
          minHeight={0.5}
          minWidth={0.5}
        >
          {/* 3D Model */}
          {modelUrl && (
            <ViroNode position={modelPosition} scale={modelScale}>
              <Viro3DObject
                source={{ uri: modelUrl }}
                type="GLB"
                resources={[]}
                onLoadEnd={handleModelLoad}
                onError={handleModelError}
                dragType="FixedToWorld" // Keeps model anchored in world space
                onDrag={(position) => {
                  setModelPosition([position[0], position[1], position[2]]);
                }}
                animation={{
                  name: currentMovement || 'idle',
                  loop: true,
                  run: true,
                }}
              />
            </ViroNode>
          )}

          {/* Instructions text */}
          {!isPlaced && (
            <ViroText
              text="Tap on a flat surface to place the avatar"
              position={[0, 0.5, -1]}
              width={2}
              height={0.5}
              style={{
                fontSize: 24,
                color: '#FFFFFF',
                textAlign: 'center',
              }}
            />
          )}
        </ViroARPlaneSelector>
      </ViroARScene>

      {/* UI Overlay */}
      <View style={styles.overlay}>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        )}

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#5856D6" />
            <Text style={styles.loadingText}>Loading 3D model...</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={24} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isPlaced && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Avatar placed! Move your device to see it stay anchored.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -25 }],
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -25 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    padding: 15,
    borderRadius: 10,
  },
  errorText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 14,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(88, 86, 214, 0.9)',
    padding: 15,
    borderRadius: 10,
  },
  infoText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
});
