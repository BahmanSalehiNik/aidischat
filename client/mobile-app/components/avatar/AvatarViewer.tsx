// Avatar 3D Viewer Component for React Native
// Supports GLB/GLTF models using Three.js and react-three-fiber
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarApi } from '../../utils/avatarApi';
import { Model3DViewer } from './Model3DViewer';
import { ARViewer } from './ARViewer';

interface AvatarViewerProps {
  agentId: string;
  onClose?: () => void;
}

/**
 * Avatar Viewer Component
 * 
 * This component handles:
 * 1. Checking avatar status
 * 2. Polling for generation progress
 * 3. Downloading the model when ready
 * 4. Rendering the 3D model
 * 
 * For React Native, you have several options:
 * 
 * Option 1: react-native-3d-model-view (recommended for simple GLB viewing)
 * Option 2: expo-three + react-three-fiber (for advanced 3D scenes)
 * Option 3: WebView with Three.js (fallback, less performant)
 * Option 4: Native AR (ARKit/ARCore) for AR viewing
 */
export const AvatarViewer: React.FC<AvatarViewerProps> = ({ agentId, onClose }) => {
  const [status, setStatus] = useState<'loading' | 'generating' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'ar'>('3d');

  useEffect(() => {
    checkAvatarStatus();
    
    // Poll for status updates if generating
    let pollInterval: NodeJS.Timeout | null = null;
    if (status === 'generating') {
      pollInterval = setInterval(() => {
        checkAvatarStatus();
      }, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [agentId, status]);

  const checkAvatarStatus = async () => {
    try {
      const avatarStatus = await avatarApi.getAvatarStatus(agentId);
      
      if (avatarStatus.status === 'ready' && avatarStatus.modelUrl) {
        // Get download URL
        const downloadData = await avatarApi.getDownloadUrl(agentId);
        setDownloadUrl(downloadData.url);
        setStatus('ready');
        setProgress(100);
      } else if (avatarStatus.status === 'generating') {
        setStatus('generating');
        setProgress(avatarStatus.progress || 0);
        setEstimatedTime(avatarStatus.estimatedTimeRemaining || null);
      } else if (avatarStatus.status === 'failed') {
        setStatus('error');
        setError(avatarStatus.error || 'Avatar generation failed');
      } else {
        setStatus('generating');
        setProgress(0);
      }
    } catch (err: any) {
      console.error('Error checking avatar status:', err);
      setStatus('error');
      setError(err.message || 'Failed to check avatar status');
    }
  };

  const renderModel = () => {
    if (!downloadUrl) return null;

    // Render 3D model using Three.js
    if (viewMode === 'ar') {
      return (
        <ARViewer
          modelUrl={downloadUrl}
          onClose={onClose}
        />
      );
    }

    return (
      <Model3DViewer
        modelUrl={downloadUrl}
        onClose={onClose}
        enableAR={true}
        onARPress={() => setViewMode('ar')}
      />
    );
  };

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.statusText}>Checking avatar status...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Ionicons name="alert-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>{error || 'An error occurred'}</Text>
        <TouchableOpacity style={styles.button} onPress={checkAvatarStatus}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (status === 'generating') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.statusText}>Generating avatar...</Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{progress}%</Text>
        {estimatedTime !== null && estimatedTime > 0 && (
          <Text style={styles.timeText}>
            Estimated time remaining: {estimatedTime}s
          </Text>
        )}
        {onClose && (
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={onClose}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with back button - Always visible */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          console.log('🔙 [AvatarViewer] Back button pressed, calling onClose');
          if (onClose) {
            onClose();
          } else {
            console.warn('⚠️ [AvatarViewer] onClose is not defined');
          }
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Avatar Viewer</Text>
        <View style={styles.spacer} />
      </View>
      
      {status === 'ready' ? (
        renderModel()
      ) : (
        <>
          {status === 'generating' && (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.statusText}>Generating avatar...</Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}%</Text>
              {estimatedTime !== null && estimatedTime > 0 && (
                <Text style={styles.timeText}>
                  Estimated time remaining: {estimatedTime}s
                </Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    zIndex: 1000,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: 80,
  },
  generatingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  progressContainer: {
    width: '80%',
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    marginTop: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  timeText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8E8E93',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonSecondary: {
    backgroundColor: '#E5E5EA',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modelContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  urlText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

