// AR Viewer Component using expo-ar (when available) or fallback to 3D viewer
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Model3DViewer } from './Model3DViewer';

interface ARViewerProps {
  modelUrl: string;
  onClose?: () => void;
}

/**
 * AR Viewer Component
 * 
 * Note: expo-ar is not available in Expo SDK 54 by default.
 * For full AR support, you may need to:
 * 1. Use expo-gl with custom AR implementation
 * 2. Eject to bare workflow and use react-native-arkit/react-native-ar
 * 3. Use a WebView with WebXR (experimental)
 * 
 * For now, this provides a placeholder that can be enhanced later.
 */
export const ARViewer: React.FC<ARViewerProps> = ({ modelUrl, onClose }) => {
  const [arSupported, setArSupported] = useState(false);
  const [arMode, setArMode] = useState(false);

  useEffect(() => {
    // Check if AR is supported
    // In a real implementation, you would check device capabilities
    const checkARSupport = async () => {
      // For iOS, check ARKit support
      if (Platform.OS === 'ios') {
        // ARKit is available on iOS 11+ devices with A9 chip or later
        setArSupported(true);
      } else if (Platform.OS === 'android') {
        // ARCore support check would go here
        setArSupported(true); // Assume supported for now
      }
    };

    checkARSupport();
  }, []);

  const handleARPress = () => {
    if (!arSupported) {
      Alert.alert(
        'AR Not Available',
        'AR features require a device with AR support. Using 3D viewer instead.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Toggle AR mode
    setArMode(!arMode);
    
    if (!arMode) {
      Alert.alert(
        'AR Mode',
        'AR mode will place the avatar in your real-world environment. This feature requires additional setup.',
        [
          { text: 'Cancel', onPress: () => setArMode(false) },
          { text: 'Continue', onPress: () => {
            // In a full implementation, this would switch to AR view
            Alert.alert('Info', 'Full AR implementation requires expo-ar or native AR modules.');
          }}
        ]
      );
    }
  };

  // For now, show 3D viewer with AR button
  // In full implementation, this would switch between 3D and AR views
  return (
    <View style={styles.container}>
      <Model3DViewer
        modelUrl={modelUrl}
        onClose={onClose}
        enableAR={arSupported}
        onARPress={handleARPress}
      />
      
      {arMode && (
        <View style={styles.arOverlay}>
          <View style={styles.arInstructions}>
            <Ionicons name="cube" size={48} color="#007AFF" />
            <Text style={styles.arTitle}>AR Mode</Text>
            <Text style={styles.arText}>
              Point your camera at a flat surface to place the avatar.
            </Text>
            <TouchableOpacity
              style={styles.arButton}
              onPress={() => setArMode(false)}
            >
              <Text style={styles.arButtonText}>Exit AR</Text>
            </TouchableOpacity>
          </View>
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
  arOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  arInstructions: {
    alignItems: 'center',
    padding: 20,
  },
  arTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  arText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  arButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  arButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

