import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useChatStore } from '../../store/chatStore';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageInput } from '../../components/MessageInput';
import { messageApi, debugApi } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { messages, setMessages, addMessage, currentRoomId, setCurrentRoom } = useChatStore();
  const { sendMessage, isConnected, connectionError } = useWebSocket(roomId || null);
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [settingUp, setSettingUp] = React.useState(false);
  const [setupError, setSetupError] = React.useState(false);
  const setupStartTimeRef = useRef<number | null>(null);
  const listRef = useRef<FlashListRef<any>>(null);
  const insets = useSafeAreaInsets();

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

  const loadMessages = async (retryCount = 0) => {
    if (!roomId) return;

    try {
      // Only show loading on first attempt
      if (retryCount === 0) {
        setLoading(true);
        setSettingUp(false);
        setSetupError(false);
        setupStartTimeRef.current = null;
      }
      
      const response = await messageApi.getMessages(roomId, 1, 50);
      const messagesData = (response as any).messages || [];
      setMessages(roomId, messagesData);
      setLoading(false);
      setSettingUp(false);
      setSetupError(false);
      setupStartTimeRef.current = null;
    } catch (error: any) {
      // Always log errors to console for debugging
      console.error('Error loading messages:', error);
      console.error('Error details:', {
        message: error?.message,
        status: error?.status,
        retryCount,
        elapsedTime: setupStartTimeRef.current ? Date.now() - setupStartTimeRef.current : 0,
      });
      
      // If 403 error and we haven't retried too many times, retry after a delay
      // This handles race condition where participant hasn't been synced to chat service yet
      // Kafka event processing can take a few seconds
      const is403Error = error?.message?.includes('403') || 
                        error?.message?.includes('Not authorized');
      
      if (is403Error) {
        // Track when we started setting up
        if (!setupStartTimeRef.current) {
          setupStartTimeRef.current = Date.now();
          
          // Debug: Check if participant exists in chat service
          if (roomId && user?.id) {
            debugApi.checkParticipant(roomId, user.id)
              .then((result: any) => {
                console.log(`[DEBUG] Participant check result:`, {
                  exists: result.exists,
                  participant: result.participant,
                  allParticipants: result.allParticipantsInRoom
                });
              })
              .catch((err: any) => {
                console.error(`[DEBUG] Error checking participant:`, err);
              });
          }
        }
        
        const elapsedTime = Date.now() - setupStartTimeRef.current;
        const maxRetryTime = 20000; // 20 seconds
        
        // If we've been retrying for more than 20 seconds, show error
        if (elapsedTime >= maxRetryTime) {
          console.error('Failed to load messages after 20 seconds of retries');
          
          // Final debug check
          if (roomId && user?.id) {
            debugApi.checkParticipant(roomId, user.id)
              .then((result: any) => {
                console.error(`[DEBUG] Final participant check after timeout:`, {
                  exists: result.exists,
                  participant: result.participant,
                  allParticipants: result.allParticipantsInRoom
                });
              })
              .catch((err: any) => {
                console.error(`[DEBUG] Error in final participant check:`, err);
              });
          }
          
          setLoading(false);
          setSettingUp(false);
          setSetupError(true);
          return;
        }
        
        // Continue retrying with exponential backoff
        if (retryCount < 10) { // Allow more retries within 20 seconds
          const delay = retryCount === 0 ? 500 : Math.min(retryCount * 1000, 3000);
          console.log(`Retrying loadMessages (attempt ${retryCount + 1}) after ${delay}ms... (elapsed: ${Math.round(elapsedTime / 1000)}s)`);
          
          // Show friendly setup message
          setSettingUp(true);
          setLoading(false);
          
          setTimeout(() => {
            loadMessages(retryCount + 1);
          }, delay);
          return;
        }
      }
      
      // If still failing after retries, show error but don't block the UI
      console.error('Failed to load messages after retries');
      setLoading(false);
      setSettingUp(false);
      setSetupError(true);
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

      {settingUp && (
        <View style={styles.setupBanner}>
          <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />
          <Text style={styles.setupText}>Setting up the room...</Text>
        </View>
      )}

      {setupError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Something went wrong. Please try again later.
          </Text>
        </View>
      )}

      <View style={styles.listContainer}>
        <FlashList
          ref={listRef}
          data={roomMessages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(item) => item.id || item.tempId || Math.random().toString()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View 
          style={[
            styles.inputContainer, 
            { 
              paddingBottom: Math.max(insets.bottom, 8),
            }
          ]}
        >
          <MessageInput onSend={handleSend} disabled={!isConnected} />
        </View>
      </KeyboardAvoidingView>
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
  setupBanner: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
    paddingBottom: 16,
  },
  inputContainer: {
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
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

