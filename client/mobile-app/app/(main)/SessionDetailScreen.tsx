import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { chatHistoryApi, messageApi } from '../../utils/api';
import { Message, useChatStore } from '../../store/chatStore';
import { MessageBubble } from '../../components/chat/MessageBubble';

export default function SessionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string | string[], returnTo?: string }>();
  // Handle both query string (?sessionId=...) and route params
  const sessionId = typeof params.sessionId === 'string' 
    ? params.sessionId 
    : Array.isArray(params.sessionId) 
      ? params.sessionId[0] 
      : undefined;
  const returnTo = params.returnTo || '/(main)/ProfileScreen';
  const [session, setSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const { setCurrentRoom, clearRoomMessages } = useChatStore();

  console.log('[SessionDetail] Component rendered, params:', params, 'sessionId:', sessionId, 'returnTo:', returnTo);

  // Clear chat state when viewing history to keep it separate from main chat
  useEffect(() => {
    setCurrentRoom(null);
    // Note: We don't clear all messages, just the current room, to avoid affecting other rooms
  }, [setCurrentRoom]);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      console.log('[SessionDetail] No sessionId provided');
      return;
    }

    console.log('[SessionDetail] Starting loadSession for sessionId:', sessionId);

    try {
      setLoading(true);
      
      // Get session info directly (simpler and more reliable)
      console.log('[SessionDetail] Step 1: Fetching session info for:', sessionId);
      let sessionInfo: any = null;
      let roomId: string | null = null;
      
      try {
        console.log('[SessionDetail] Calling chatHistoryApi.getSession...');
        const sessionResponse = await chatHistoryApi.getSession(sessionId);
        console.log('[SessionDetail] getSession response received:', sessionResponse);
        sessionInfo = sessionResponse.session;
        roomId = sessionInfo.roomId;
        setSession(sessionInfo);
        console.log('[SessionDetail] Step 1 complete: Got session info, roomId:', roomId);
      } catch (error: any) {
        console.error('[SessionDetail] Error fetching session info:', error);
        console.error('[SessionDetail] Error details:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status
        });
        // Fallback: Try to get session from user sessions list
        try {
          console.log('[SessionDetail] Fallback: Trying to get session from user sessions list');
          const userSessions = await chatHistoryApi.getUserSessions({ limit: 1000 });
          sessionInfo = userSessions.sessions.find(s => s.id === sessionId);
          if (sessionInfo) {
            roomId = sessionInfo.roomId;
            setSession(sessionInfo);
            console.log('[SessionDetail] Fallback success: Got session from user sessions list, roomId:', roomId);
          } else {
            console.log('[SessionDetail] Fallback failed: Session not found in user sessions list');
          }
        } catch (err: any) {
          console.error('[SessionDetail] Error fetching from user sessions:', err);
        }
      }

      if (!roomId) {
        console.error('[SessionDetail] Could not determine roomId for session, aborting');
        setLoading(false);
        setLoadingMessages(false);
        setRefreshing(false);
        return;
      }

      // Get session messages (messageIds)
      setLoadingMessages(true);
      console.log('[SessionDetail] Fetching messages for session:', sessionId);
      const response = await chatHistoryApi.getSessionMessages(sessionId, {
        limit: 200,
        offset: 0,
      });

      console.log('[SessionDetail] Received response:', {
        messageIdsCount: response.messageIds.length,
        total: response.pagination?.total,
        messageIds: response.messageIds.slice(0, 5) // Log first 5 for debugging
      });

      if (response.messageIds.length === 0) {
        console.log('[SessionDetail] No messages found for session');
        setLoading(false);
        setLoadingMessages(false);
        setRefreshing(false);
        return;
      }

      // Fetch all messages from the room
      const roomMessagesResponse: any = await messageApi.getMessages(roomId, 1, 500);
      const allRoomMessages = Array.isArray(roomMessagesResponse.messages) 
        ? roomMessagesResponse.messages 
        : roomMessagesResponse.messages || [];

      // Filter to only session messages and sort chronologically
      const sessionMessages = allRoomMessages
        .filter((msg: Message) => response.messageIds.includes(msg.id))
        .sort((a: Message, b: Message) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateA - dateB;
        });

      setMessages(sessionMessages);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
      setLoadingMessages(false);
      setRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSession();
  }, [loadSession]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric', 
      minute: '2-digit'
    });
  };

  const formatDuration = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) {
      return `${diffMins} minutes`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours} hours ${mins} minutes` : `${hours} hours`;
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      onReactionPress={() => {}}
      onReplyPress={() => {}}
      onQuotedMessagePress={() => {}}
      isHighlighted={false}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (returnTo.includes('ProfileScreen')) {
                router.push({
                  pathname: returnTo as any,
                  params: { activeTab: 'chatHistory' },
                });
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Navigate back to the screen we came from (usually ProfileScreen with chatHistory tab)
            if (returnTo.includes('ProfileScreen')) {
              router.push({
                pathname: returnTo as any,
                params: { activeTab: 'chatHistory' },
              });
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {session?.title || 'Chat Session'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {session && (
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionInfoText}>
            {formatDate(session.startTime)}
          </Text>
          <Text style={styles.sessionInfoText}>
            {session.messageCount} messages • {formatDuration(session.startTime, session.endTime)}
          </Text>
        </View>
      )}

      {loadingMessages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
          contentContainerStyle={styles.messagesList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Messages</Text>
              <Text style={styles.emptyText}>
                This session doesn't have any messages yet.
              </Text>
            </View>
          }
        />
      )}
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
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  sessionInfo: {
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  sessionInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: 8,
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
});

