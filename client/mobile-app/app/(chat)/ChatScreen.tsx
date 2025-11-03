import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useChatStore } from '../../store/chatStore';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageInput } from '../../components/MessageInput';
import { messageApi } from '../../utils/api';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { messages, setMessages, addMessage, currentRoomId, setCurrentRoom } = useChatStore();
  const { sendMessage, isConnected, connectionError } = useWebSocket(roomId || null);
  const [loading, setLoading] = React.useState(true);
  const listRef = useRef<FlashList<any>>(null);

  const roomMessages = roomId ? messages[roomId] || [] : [];

  useEffect(() => {
    if (roomId) {
      setCurrentRoom(roomId);
      loadMessages();
    }
  }, [roomId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (roomMessages.length > 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [roomMessages.length]);

  const loadMessages = async () => {
    if (!roomId) return;

    try {
      setLoading(true);
      const response = await messageApi.getMessages(roomId, 1, 50);
      const messagesData = (response as any).messages || [];
      setMessages(roomId, messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (content: string) => {
    if (!roomId) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    sendMessage(content, tempId);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {connectionError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            {isConnected ? 'Connected' : `Connection Error: ${connectionError}`}
          </Text>
        </View>
      )}

      <FlashList
        ref={listRef}
        data={roomMessages}
        estimatedItemSize={80}
        renderItem={({ item }) => <MessageBubble message={item} />}
        keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <MessageInput onSend={handleSend} disabled={!isConnected} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 12,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

