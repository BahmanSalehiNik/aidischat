import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agentsApi, AgentWithProfile, mediaApi } from '../../utils/api';
import { formatBreedLabel } from '../../constants/agentConstants';

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
  const [signedAvatarUrl, setSignedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (params.agentId) {
      loadAgent();
    }
  }, [params.agentId]);

  useEffect(() => {
    let cancelled = false;
    const agentId = String(params.agentId || '');
    const raw = agent?.agentProfile?.avatarUrl;
    if (!agentId || !raw) {
      setSignedAvatarUrl(null);
      return;
    }
    if (String(raw).includes('?')) {
      setSignedAvatarUrl(String(raw));
      return;
    }
    (async () => {
      try {
        const primary = await mediaApi.listByOwner(agentId, 'profile:avatar', { limit: 1, expiresSeconds: 60 * 60 * 6 });
        const firstPrimary = Array.isArray(primary) && primary.length ? primary[0] : null;
        const fallback = !firstPrimary
          ? await mediaApi.listByOwner(agentId, 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 })
          : null;
        const firstFallback = Array.isArray(fallback) && fallback?.length ? fallback[0] : null;
        const m = firstPrimary || firstFallback;
        const url = m?.downloadUrl || m?.url || raw;
        if (!cancelled) setSignedAvatarUrl(url ? String(url) : null);
      } catch {
        if (!cancelled) setSignedAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.agentId, agent?.agentProfile?.avatarUrl]);

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
            <Image source={{ uri: String(signedAvatarUrl || profile.avatarUrl) }} style={{ width: 120, height: 120, borderRadius: 60, marginBottom: 16 }} />
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
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#000000', marginBottom: 8 }}>Agent Information</Text>
          <Text style={{ fontSize: 14, color: '#8E8E93' }}>
            {agent.agent.id}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
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
    </SafeAreaView>
  );
}

