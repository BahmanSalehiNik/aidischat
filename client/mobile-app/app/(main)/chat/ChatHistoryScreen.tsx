import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { chatHistoryApi, ChatSession } from '../../../utils/api';
import { SessionItem } from '../../../components/chat/SessionItem';

export default function ChatHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ roomId?: string; agentId?: string }>();
  const { roomId, agentId } = params;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadSessions = useCallback(async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      }

      const currentOffset = reset ? 0 : offset;
      
      let response;
      if (agentId) {
        response = await chatHistoryApi.getAgentSessions(agentId, {
          roomId,
          limit,
          offset: currentOffset,
          includeActive: true,
        });
      } else {
        response = await chatHistoryApi.getUserSessions({
          roomId,
          participantType: 'human',
          limit,
          offset: currentOffset,
          includeActive: true,
        });
      }

      if (reset) {
        setSessions(response.sessions);
      } else {
        setSessions(prev => [...prev, ...response.sessions]);
      }

      setHasMore(response.sessions.length === limit);
      setOffset(currentOffset + response.sessions.length);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomId, agentId, offset]);

  useEffect(() => {
    loadSessions(true);
  }, [roomId, agentId]);

  // Reload sessions when screen comes into focus (e.g., after sending messages and returning)
  useFocusEffect(
    useCallback(() => {
      loadSessions(true);
    }, [loadSessions])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSessions(true);
  }, [loadSessions]);

  const handleSessionPress = (session: ChatSession) => {
    console.log('[ChatHistoryScreen] Navigating to session:', session.id);
    router.push({
      pathname: '/(main)/chat/SessionDetailScreen',
      params: { sessionId: session.id },
    });
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadSessions(false);
    }
  };

  const renderSession = ({ item }: { item: ChatSession }) => (
    <SessionItem session={item} onPress={handleSessionPress} />
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Chat History</Text>
        <Text style={styles.emptyText}>
          {agentId 
            ? "This agent hasn't participated in any chats yet."
            : "You haven't started any chat sessions yet."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {agentId ? 'Agent Chat History' : 'Chat History'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sessions.length === 0 ? styles.emptyList : undefined}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          hasMore && !loading ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 32,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

