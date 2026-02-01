import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, Alert, Modal, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agentsApi, AgentWithProfile } from '../../utils/api';
import { formatBreedLabel } from '../../constants/agentConstants';
import { AvatarViewer } from '../../components/avatar/AvatarViewer';
import { avatarApi } from '../../utils/avatarApi';
import * as Linking from 'expo-linking';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active':
      return '#34C759';
    case 'Pending':
      return '#FF9500';
    case 'Failed':
      return '#FF3B30';
    default:
      return '#8E8E93';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'Active':
      return 'Active';
    case 'Pending':
      return 'Pending';
    case 'Failed':
      return 'Failed';
    default:
      return status;
  }
};

export default function AgentDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<'pending' | 'generating' | 'ready' | 'failed' | null>(null);
  const [launchingVideoChat, setLaunchingVideoChat] = useState(false);

  useEffect(() => {
    if (params.agentId) {
      loadAgent();
      checkAvatarStatus();
    }
  }, [params.agentId]);

  const checkAvatarStatus = async () => {
    if (!params.agentId) return;
    try {
      const status = await avatarApi.getAvatarStatus(params.agentId);
      setAvatarStatus(status.status);
    } catch (error) {
      // Avatar might not exist yet, that's okay
      setAvatarStatus('pending');
    }
  };

  const loadAgent = async () => {
    try {
      setLoading(true);
      const agents = await agentsApi.getAgents();
      const foundAgent = agents.find(a => a.agent.id === params.agentId);
      if (foundAgent) {
        setAgent(foundAgent);
      } else {
        Alert.alert('Error', 'Agent not found');
        router.back();
      }
    } catch (error: any) {
      console.error('Error loading agent:', error);
      Alert.alert('Error', 'Failed to load agent details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const launchUnityVideoChat = async (agentId: string) => {
    // Keep this inside the current screen (no navigation) to avoid any intermediate page flash.
    try {
      setLaunchingVideoChat(true);

      const status = await avatarApi.getAvatarStatus(agentId);
      if (status.status !== 'ready') {
        Alert.alert('Avatar not ready', 'Please wait until the avatar is ready before starting video chat.');
        return;
      }

      // IMPORTANT:
      // Always prefer the download-url endpoint to get a fresh, correct URL to *this agent's* model.
      // This avoids stale cached URLs and avoids relying on status.modelUrl which may be a stored/original URL.
      let modelUrl: string | undefined;
      try {
        const dl = await avatarApi.getDownloadUrl(agentId, 900);
        modelUrl = dl.url;
      } catch (e) {
        // Fallback to status.modelUrl (for public/external URLs, or if download-url fails unexpectedly)
        modelUrl = status.modelUrl;
      }

      const queryParams = new URLSearchParams({ agentId });
      if (modelUrl) queryParams.append('modelUrl', modelUrl);

      if (status.animationUrls && status.animationUrls.length > 0) {
        for (const url of status.animationUrls) {
          if (url) queryParams.append('animUrl', url);
        }
      }

      const unityUrl = `aichatar://ar?${queryParams.toString()}`;
      const supported = await Linking.canOpenURL(unityUrl);

      if (supported || Platform.OS === 'android') {
        await Linking.openURL(unityUrl);
      } else {
        Alert.alert(
          'AR App Not Installed',
          'Please install the "AI Chat AR" companion app to start video chat.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      console.error('[AgentDetailScreen] launchUnityVideoChat error:', e);
      Alert.alert('Error', e?.message || 'Failed to start video chat');
    } finally {
      setLaunchingVideoChat(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!agent) {
    return null;
  }

  const profile = agent.agentProfile;
  const displayName = profile?.displayName || profile?.name || 'Unnamed Agent';
  const profession = profile?.profession || 'No profession';
  const breed = profile?.breed ? formatBreedLabel(profile.breed) : null;
  const statusColor = getStatusColor(agent.agent.status);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Agent Details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Profile Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 16 }} />
          ) : (
            <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="sparkles" size={48} color="#8E8E93" />
            </View>
          )}
          
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#000000', marginBottom: 4 }}>{displayName}</Text>
          
          {breed && (
            <View style={{ backgroundColor: '#E3F2FD', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#1976D2' }}>{breed}</Text>
            </View>
          )}
          
          <Text style={{ fontSize: 16, color: '#8E8E93', marginBottom: 8 }}>{profession}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }} />
            <Text style={{ fontSize: 14, color: statusColor, fontWeight: '500' }}>
              {getStatusLabel(agent.agent.status)}
            </Text>
          </View>
        </View>

        {/* Model Info */}
        <View style={{ backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 8 }}>Model Information</Text>
          <Text style={{ fontSize: 14, color: '#8E8E93' }}>
            {agent.agent.modelProvider} • {agent.agent.modelName}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          {/* AR Avatar Button */}
          <TouchableOpacity
            style={{
              backgroundColor: avatarStatus === 'ready' ? '#34C759' : avatarStatus === 'generating' ? '#FF9500' : '#8E8E93',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => {
              if (avatarStatus === 'ready' || avatarStatus === 'generating' || avatarStatus === 'pending') {
                setShowAvatarViewer(true);
              } else {
                Alert.alert(
                  'Avatar Not Available',
                  avatarStatus === 'failed' 
                    ? 'Avatar generation failed. Please try again later.'
                    : 'Avatar is still being generated. Please wait.',
                  [{ text: 'OK' }]
                );
              }
            }}
            disabled={avatarStatus === 'failed'}
          >
            <Ionicons 
              name={avatarStatus === 'ready' ? 'cube' : avatarStatus === 'generating' ? 'hourglass' : 'cube-outline'} 
              size={20} 
              color="#FFFFFF" 
              style={{ marginRight: 8 }} 
            />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              {avatarStatus === 'ready' 
                ? 'View 3D Avatar' 
                : avatarStatus === 'generating' 
                ? 'Generating Avatar...' 
                : avatarStatus === 'failed'
                ? 'Avatar Failed'
                : 'View Avatar'}
            </Text>
          </TouchableOpacity>

          {/* Video Chat Button - Only visible when avatar is ready */}
          {avatarStatus === 'ready' && (
            <TouchableOpacity
              style={{
                backgroundColor: '#5856D6',
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: launchingVideoChat ? 0.7 : 1,
              }}
              onPress={() => {
                launchUnityVideoChat(agent.agent.id);
              }}
              disabled={launchingVideoChat}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                {launchingVideoChat ? 'Starting…' : 'Video Chat'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={{
              backgroundColor: '#007AFF',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => {
              router.push({
                pathname: '/(main)/AgentDraftsScreen',
                params: { agentId: agent.agent.id },
              });
            }}
          >
            <Ionicons name="document-text" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>Drafts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Avatar Viewer Modal */}
      <Modal
        visible={showAvatarViewer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAvatarViewer(false)}
      >
        <AvatarViewer 
          agentId={params.agentId || ''} 
          onClose={() => {
            setShowAvatarViewer(false);
            checkAvatarStatus(); // Refresh status when closing
          }} 
        />
      </Modal>
    </SafeAreaView>
  );
}

