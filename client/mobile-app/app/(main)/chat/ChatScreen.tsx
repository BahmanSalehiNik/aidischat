import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Platform, Keyboard } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useChatStore } from '../../../store/chatStore';
import { MessageBubble } from '../../../components/chat/MessageBubble';
import { MessageInput } from '../../../components/chat/MessageInput';
import { messageApi, debugApi } from '../../../utils/api';
import { useAuthStore } from '../../../store/authStore';
import { ErrorBanner } from '../../../components/chat/ErrorBanner';
import { SetupBanner } from '../../../components/chat/SetupBanner';
import { chatScreenStyles as styles } from '../../../styles/chat/chatScreenStyles';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { messages, setMessages, addMessage, currentRoomId, setCurrentRoom } = useChatStore();
  const { sendMessage, isConnected, connectionError } = useWebSocket(roomId || null);
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [settingUp, setSettingUp] = React.useState(false);
  const [setupError, setSetupError] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
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

  // Listen to keyboard show/hide events
  useEffect(() => {
    let keyboardTimeout: NodeJS.Timeout;
    
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        
        if (Platform.OS === 'android') {
          if (keyboardTimeout) clearTimeout(keyboardTimeout);
          keyboardTimeout = setTimeout(() => {
            setKeyboardHeight(height);
          }, 100);
        } else {
          setKeyboardHeight(height);
        }
        
        setTimeout(() => {
          if (listRef.current && roomMessages.length > 0) {
            listRef.current.scrollToEnd({ animated: true });
          }
        }, 150);
      }
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        if (keyboardTimeout) clearTimeout(keyboardTimeout);
        setKeyboardHeight(0);
      }
    );

    return () => {
      if (keyboardTimeout) clearTimeout(keyboardTimeout);
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [roomMessages.length]);

  useEffect(() => {
    if (roomMessages.length > 0 && listRef.current) {
      const delay = keyboardHeight > 0 ? 400 : 150;
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, delay);
    }
  }, [roomMessages.length, keyboardHeight]);

  const loadMessages = async (retryCount = 0) => {
    if (!roomId) return;

    try {
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
      
      if (messagesData.length > 0 && listRef.current) {
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      console.error('Error details:', {
        message: error?.message,
        status: error?.status,
        retryCount,
        elapsedTime: setupStartTimeRef.current ? Date.now() - setupStartTimeRef.current : 0,
      });
      
      const is403Error = error?.message?.includes('403') || 
                        error?.message?.includes('Not authorized');
      
      if (is403Error) {
        if (!setupStartTimeRef.current) {
          setupStartTimeRef.current = Date.now();
          
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
        const maxRetryTime = 20000;
        
        if (elapsedTime >= maxRetryTime) {
          console.error('Failed to load messages after 20 seconds of retries');
          
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
        
        if (retryCount < 10) {
          const delay = retryCount === 0 ? 500 : Math.min(retryCount * 1000, 3000);
          console.log(`Retrying loadMessages (attempt ${retryCount + 1}) after ${delay}ms... (elapsed: ${Math.round(elapsedTime / 1000)}s)`);
          
          setSettingUp(true);
          setLoading(false);
          
          setTimeout(() => {
            loadMessages(retryCount + 1);
          }, delay);
          return;
        }
      }
      
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
    
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollToEnd({ animated: true });
      }
    }, 400);
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
        <ErrorBanner
          message={isConnected ? 'Connected' : `Connection Error: ${connectionError}`}
          isConnected={isConnected}
        />
      )}

      {settingUp && <SetupBanner />}

      {setupError && (
        <ErrorBanner message="Something went wrong. Please try again later." />
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
          contentContainerStyle={[
            styles.listContent,
            keyboardHeight > 0 && { paddingBottom: 20 }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
      </View>

      {Platform.OS === 'ios' ? (
        <View 
          style={[
            styles.inputContainer, 
            { 
              paddingBottom: Math.max(insets.bottom, 0),
              marginBottom: keyboardHeight > 0 ? keyboardHeight - 35 : 0,
            }
          ]}
        >
          <MessageInput onSend={handleSend} disabled={!isConnected} />
        </View>
      ) : (
        <View 
          style={[
            styles.inputContainer, 
            { 
              paddingBottom: Math.max(insets.bottom, 0),
              marginBottom: keyboardHeight,
            }
          ]}
        >
          <MessageInput onSend={handleSend} disabled={!isConnected} />
        </View>
      )}
    </View>
  );
}
