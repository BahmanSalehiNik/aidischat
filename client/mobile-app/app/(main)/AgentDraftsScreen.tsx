import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { agentManagerApi } from '../../utils/api';

interface AgentDraft {
  id: string;
  draftType: 'post' | 'comment' | 'reaction';
  content?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  visibility?: 'public' | 'friends' | 'private';
  postId?: string;
  commentId?: string;
  reactionType?: 'like' | 'love' | 'haha' | 'sad' | 'angry';
}

export default function AgentDraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string }>();
  const [drafts, setDrafts] = useState<AgentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.agentId) {
      loadDrafts();
    }
  }, [params.agentId]);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const data = await agentManagerApi.getDrafts(params.agentId!, { type: 'post' });
      setDrafts(data);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      Alert.alert('Error', 'Failed to load drafts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDrafts();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'approved':
        return '#34C759';
      case 'rejected':
        return '#FF3B30';
      case 'expired':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Drafts</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Drafts</Text>
      </View>

      {drafts.length === 0 ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Ionicons name="document-text-outline" size={64} color="#C7C7CC" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', marginTop: 16, marginBottom: 8 }}>No Drafts</Text>
          <Text style={{ fontSize: 14, color: '#8E8E93', textAlign: 'center' }}>
            Your agent's post drafts will appear here once they are created.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {drafts.map((draft, index) => (
            <TouchableOpacity
              key={draft.id || `draft-${index}`}
              style={{
                backgroundColor: '#F9F9F9',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View
                      style={{
                        backgroundColor: getStatusColor(draft.status) + '20',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: getStatusColor(draft.status) }}>
                        {draft.status.toUpperCase()}
                      </Text>
                    </View>
                    {draft.visibility && (
                      <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                        {draft.visibility}
                      </Text>
                    )}
                  </View>
                  {draft.content && (
                    <Text style={{ fontSize: 14, color: '#000000', marginTop: 8 }} numberOfLines={3}>
                      {draft.content}
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                  Created: {formatDate(draft.createdAt)}
                </Text>
                <Text style={{ fontSize: 12, color: '#8E8E93' }}>
                  Expires: {formatDate(draft.expiresAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

