// AR Viewer Component using Deep Linking to Unity AR App
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, AppState, AppStateStatus, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Marker } from '../../utils/markerParser';

interface ARViewerProps {
  agentId: string;
  modelUrl: string;
  onClose?: () => void;
  // Animation/State props are no longer needed for preview, but kept for interface compatibility if needed later
  animationUrls?: string[];
  markers?: Marker[];
  currentEmotion?: string;
  currentMovement?: string;
}

/**
 * AR Viewer Component (Launcher Mode)
 * 
 * This component acts as a bridge/launcher for the standalone Unity AR application.
 * It does NOT render any 3D content locally (Three.js removed to prevent crashes).
 * It handles the deep link construction and handoff to the Unity app.
 */
const ARViewerComponent: React.FC<ARViewerProps> = ({
  agentId,
  modelUrl,
  onClose
}) => {
  const [isReady, setIsReady] = useState(false);
  const [hasLaunched, setHasLaunched] = useState(false);
  const unityLaunchTimeRef = useRef<number | null>(null);

  // Safety delay to ensure navigation transition completes before launching external app
  // This prevents UI jank or race conditions during screen transitions
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      // Optional: Auto-launch when ready? 
      // User asked: "when the model is ready the app starts using unity"
      // we'll trigger it automatically for a seamless flow.
      handleLaunchUnity();
    }, 800); // Increased slightly to 800ms for extra safety
    return () => clearTimeout(timer);
  }, []);

  // Track app state to detect if launch was successful
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (unityLaunchTimeRef.current) {
        const timeSinceLaunch = Date.now() - unityLaunchTimeRef.current;
        if (nextAppState === 'background' && timeSinceLaunch < 2000) {
          console.log('✅ [ARViewer] App went to background - Unity app likely opened');
          setHasLaunched(true);
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
      Alert.alert('Error', 'Could not open AR app: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="cube" size={64} color="#007AFF" />
        <Text style={styles.title}>Opening AR Experience...</Text>
        <Text style={styles.subtitle}>
          Launching high-fidelity avatar viewer.
        </Text>

        {!isReady && (
          <ActivityIndicator size="large" color="#007AFF" style={styles.stats} />
        )}

        {isReady && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLaunchUnity}
            >
              <Text style={styles.primaryButtonText}>
                {hasLaunched ? "Re-open AR App" : "Launch AR App"}
              </Text>
            </TouchableOpacity>

            {onClose && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onClose}
              >
                <Text style={styles.secondaryButtonText}>Return to Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

// Memoize to prevent re-renders, although less critical now without internal 3D state
export const ARViewer = React.memo(ARViewerComponent, (prevProps, nextProps) => {
  return (
    prevProps.modelUrl === nextProps.modelUrl &&
    prevProps.agentId === nextProps.agentId
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  stats: {
    marginBottom: 30,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
