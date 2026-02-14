import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Image, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agentsApi, AgentWithProfile, mediaApi, roomApi, usageApi, type UsageBreakdownItem } from '../../utils/api';
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
  const [usageLoading, setUsageLoading] = useState(false);
  const [agentUsage, setAgentUsage] = useState<{
    from: string;
    to: string;
    totalCostMicros: number;
    totalTokens: number;
    calls: number;
  } | null>(null);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (params.agentId) {
      loadAgent();
    }
  }, [params.agentId]);

  useEffect(() => {
    if (params.agentId) {
      loadAgentUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const usdFromMicros = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

  const loadAgentUsage = async () => {
    const agentId = String(params.agentId || '');
    if (!agentId) return;
    try {
      setUsageLoading(true);
      const to = new Date();
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const res = await usageApi.getBreakdown({ from: from.toISOString(), to: to.toISOString(), limit: 200 });
      const items: UsageBreakdownItem[] = Array.isArray(res.items) ? res.items : [];
      const mine = items.filter((i) => String(i.agentId || '') === agentId);

      const totalCostMicros = mine.reduce((sum, i) => sum + Number(i.totalCostMicros || 0), 0);
      const totalTokens = mine.reduce((sum, i) => sum + Number(i.totalTokens || 0), 0);
      const calls = mine.reduce((sum, i) => sum + Number(i.calls || 0), 0);

      setAgentUsage({
        from: res.from,
        to: res.to,
        totalCostMicros,
        totalTokens,
        calls,
      });
    } catch (e: any) {
      console.warn('[AgentDetailScreen] Failed to load agent usage:', e?.message || e);
      setAgentUsage(null);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleStartPrivateChat = async () => {
    const agentId = String(params.agentId || '');
    if (!agentId) return;
    if (!agent?.agent) return;

    try {
      setStartingChat(true);

      const profile = agent.agentProfile;
      const displayName = profile?.displayName || profile?.name || 'Agent';
      const roomName = `Chat with ${displayName}`;

      // Create a DM room for the user (owner participant is auto-added by backend).
      // NOTE: Room service uses `type: 'dm'` (not 'direct').
      const room: any = await roomApi.createRoom({
        type: 'dm',
        name: roomName,
        visibility: 'private',
      });

      const roomId = String(room?.id || '');
      if (!roomId) {
        throw new Error('Room creation did not return a room id');
      }

      // Add the agent to the room (no invite UX; we do it automatically).
      await roomApi.addParticipant(roomId, {
        participantId: agentId,
        participantType: 'agent',
        role: 'member',
      });

      router.push({
        pathname: '/(main)/chat/ChatScreen',
        params: { roomId },
      });
    } catch (e: any) {
      console.error('[AgentDetailScreen] Failed to start private chat:', e);
      Alert.alert('Error', e?.message || 'Failed to start chat. Please try again.');
    } finally {
      setStartingChat(false);
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
          <Text style={{ fontSize: 13, color: '#8E8E93' }}>
            Provider: {agent.agent.modelProvider}
          </Text>
          <Text style={{ fontSize: 13, color: '#8E8E93', marginTop: 4 }}>
            Model: {agent.agent.modelName}
          </Text>
        </View>

        {/* Usage */}
        <View style={{ backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#000000' }}>Usage (last 30 days)</Text>
            {usageLoading ? <ActivityIndicator size="small" color="#007AFF" /> : null}
          </View>
          {agentUsage ? (
            <>
              <Text style={{ fontSize: 12, color: '#8E8E93' }}>Estimated cost: {usdFromMicros(agentUsage.totalCostMicros)}</Text>
              <Text style={{ fontSize: 12, color: '#8E8E93', marginTop: 4 }}>
                Calls: {agentUsage.calls} • Tokens: {agentUsage.totalTokens.toLocaleString()}
              </Text>
            </>
          ) : (
            <Text style={{ fontSize: 12, color: '#8E8E93' }}>No usage data yet.</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#34C759',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: startingChat ? 0.7 : 1,
            }}
            disabled={startingChat}
            onPress={handleStartPrivateChat}
          >
            {startingChat ? (
              <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="chatbubbles" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            )}
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Chat
            </Text>
          </TouchableOpacity>

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

