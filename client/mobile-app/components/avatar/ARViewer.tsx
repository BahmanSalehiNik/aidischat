// AR Viewer Component using Deep Linking to Unity AR App
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Model3DViewer } from './Model3DViewer';

interface ARViewerProps {
  agentId: string;
  modelUrl: string;
  onClose?: () => void;
}

/**
 * AR Viewer Component
 * 
 * Helper component to launch the standalone Unity AR application via Deep Linking.
 * This architecture avoids embedding Unity directly in RN (which is complex/heavy)
 * and instead uses a lightweight "launcher" approach.
 */
export const ARViewer: React.FC<ARViewerProps> = ({ agentId, modelUrl, onClose }) => {
  const [arMode, setArMode] = useState(false);
  const unityLaunchTimeRef = useRef<number | null>(null);

  // Track app state to detect if launch was successful
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (unityLaunchTimeRef.current) {
        const timeSinceLaunch = Date.now() - unityLaunchTimeRef.current;
        if (nextAppState === 'background' && timeSinceLaunch < 2000) {
          console.log('✅ [ARViewer] App went to background - Unity app likely opened');
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleLaunchUnity = async () => {
    try {
      // Construct Deep Link URL
      // aichatar://ar?agentId=...&modelUrl=...
      const queryParams = new URLSearchParams({
        agentId: agentId,
      });

      if (modelUrl) {
        queryParams.append('modelUrl', modelUrl);
      }

      const unityUrl = `aichatar://ar?${queryParams.toString()}`;
      console.log('🔗 [ARViewer] Launching Unity with:', unityUrl);

      const supported = await Linking.canOpenURL(unityUrl);

      if (supported || Platform.OS === 'android') {
        // Android often returns false for canOpenURL even if supported, so we try anyway
        unityLaunchTimeRef.current = Date.now();
        await Linking.openURL(unityUrl);
      } else {
        Alert.alert(
          'AR App Not Installed',
          'Please install the "AI Chat AR" companion app to view avatars in AR.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ [ARViewer] Error launching Unity:', error);
      Alert.alert('Error', 'Could not verify AR app installation.');
    }
  };

  const handleARPress = () => {
    setArMode(true);
  };

  return (
    <View style={styles.container}>
      {/* Background 3D Viewer (Preview) */}
      <Model3DViewer
        modelUrl={modelUrl}
        onClose={onClose}
        enableAR={true}
        onARPress={handleARPress}
      />

      {/* AR Launch Overlay */}
      {arMode && (
        <View style={styles.arOverlay}>
          <View style={styles.arInstructions}>
            <Ionicons name="cube" size={64} color="#007AFF" />
            <Text style={styles.arTitle}>Launch AR Experience</Text>
            <Text style={styles.arText}>
              This will open the high-fidelity AR Viewer app.
            </Text>

            <TouchableOpacity
              style={styles.arButton}
              onPress={handleLaunchUnity}
            >
              <Text style={styles.arButtonText}>Open AR App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setArMode(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  arInstructions: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
  },
  arTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  arText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  arButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  arButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

