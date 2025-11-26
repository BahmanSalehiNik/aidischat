import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { View, Text, ActivityIndicator, Platform, Keyboard, TouchableOpacity } from 'react-native';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useChatStore, Message } from '../../../store/chatStore';
import { MessageBubble } from '../../../components/chat/MessageBubble';
import { MessageInput } from '../../../components/chat/MessageInput';
import { messageApi, debugApi } from '../../../utils/api';
import { useAuthStore } from '../../../store/authStore';
import { ErrorBanner } from '../../../components/chat/ErrorBanner';
import { SetupBanner } from '../../../components/chat/SetupBanner';
import { chatScreenStyles as styles } from '../../../styles/chat/chatScreenStyles';
import { InviteParticipantsModal } from '../../../components/chat/InviteParticipantsModal';
import { ParticipantsModal } from '../../../components/chat/ParticipantsModal';

export default function ChatScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  // Use Zustand selector to subscribe only to messages for this room - this ensures re-renders when messages change
  // Zustand will automatically detect when state.messages[roomId] changes (new array reference)
  const roomMessages = useChatStore((state) => {
    const messages = roomId ? (state.messages[roomId] || []) : [];
    // Log when selector runs to debug re-render issues
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      console.log(`[ChatScreen] Selector ran for room ${roomId}, messages: ${messages.length}, last msg reactions:`, lastMsg.reactionsSummary);
    }
    return messages;
  });
  const { setMessages, addMessage, currentRoomId, setCurrentRoom, rooms, roomMembers, updateMessage } = useChatStore();
  const { sendMessage, sendReaction, isConnected, connectionError } = useWebSocket(roomId || null);
  const { user } = useAuthStore();
  const [loading, setLoading] = React.useState(true);
  const [settingUp, setSettingUp] = React.useState(false);
  const [setupError, setSetupError] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [inviteModalVisible, setInviteModalVisible] = React.useState(false);
  const [participantsModalVisible, setParticipantsModalVisible] = React.useState(false);
  const [replyingTo, setReplyingTo] = React.useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null);
  const setupStartTimeRef = useRef<number | null>(null);
  const listRef = useRef<FlashListRef<any>>(null);
  const insets = useSafeAreaInsets();
  const memberIds = roomId ? roomMembers[roomId] || [] : [];
  const room = rooms.find((r) => r.id === roomId);
  const router = useRouter();
  const navigation = useNavigation();
  
  // Set header dynamically with room name and invite button
  useLayoutEffect(() => {
    const participantCount = memberIds.length;
    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          onPress={() => setParticipantsModalVisible(true)}
          style={{ alignItems: 'center' }}
        >
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#000' }}>
            {room?.name || 'Conversation'}
          </Text>
          {participantCount > 0 && (
            <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
            </Text>
          )}
        </TouchableOpacity>
      ),
      headerTitleAlign: 'center', // Center the title on both platforms
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setInviteModalVisible(true)}
          disabled={!roomId}
          style={{ marginRight: Platform.OS === 'ios' ? 0 : 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="person-add" size={20} color="#007AFF" />
          <Text style={{ color: '#007AFF', fontSize: 16 }}>Invite</Text>
        </TouchableOpacity>
      ),
      headerBackTitle: '', // Remove back button text on iOS
      // On Android, replace the default back button with iOS-style chevron and "Rooms" label
      // On iOS, let the default back button work (don't override)
      ...(Platform.OS === 'android' && {
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
            <Text style={{ color: '#007AFF', fontSize: 17 }}>Rooms</Text>
          </TouchableOpacity>
        ),
      }),
    });
  }, [navigation, room?.name, roomId, router, memberIds.length]);
  
  // Compute extraData for FlashList - this helps FlashList detect when items need to re-render
  const extraData = React.useMemo(() => {
    return roomMessages.map(m => `${m.id}-${JSON.stringify(m.reactionsSummary || [])}-${m.currentUserReaction || 'null'}`).join('|');
  }, [roomMessages]);

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

  const handleSend = (content: string, replyToMessageId?: string) => {
    if (!roomId) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    sendMessage(content, tempId, replyToMessageId);
    setReplyingTo(null);
    
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollToEnd({ animated: true });
      }
    }, 400);
  };

  const handleReactionPress = (messageId: string, emoji: string | null) => {
    if (!roomId) return;
    sendReaction(messageId, emoji);
  };

  const handleReplyPress = (message: Message) => {
    setReplyingTo(message);
  };

  const handleQuotedMessagePress = (messageId: string) => {
    // Scroll to the original message
    const messageIndex = roomMessages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1 && listRef.current) {
      // Highlight the message briefly
      setHighlightedMessageId(messageId);
      
      // Use viewPosition to center the message in the viewport
      // viewPosition 0.5 = center, 0 = top, 1 = bottom
      listRef.current.scrollToIndex({ 
        index: messageIndex, 
        animated: true,
        viewPosition: 0.4, // Slightly above center for better visibility
      });
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    } else {
      console.warn(`[ChatScreen] Message ${messageId} not found in current messages. It may not be loaded yet.`);
      // TODO: Could implement pagination loading here if message is not in current view
    }
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
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onReactionPress={handleReactionPress}
              onReplyPress={handleReplyPress}
              onQuotedMessagePress={handleQuotedMessagePress}
              isHighlighted={highlightedMessageId === item.id}
            />
          )}
          keyExtractor={(item) => {
            // Include reactions in key to force re-render when reactions change
            const reactionKey = JSON.stringify(item.reactionsSummary || []) + (item.currentUserReaction || '');
            return `${item.id || item.tempId || Math.random().toString()}-${reactionKey}`;
          }}
          extraData={extraData}
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
          <MessageInput
            onSend={handleSend}
            disabled={!isConnected}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
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
          <MessageInput
            onSend={handleSend}
            disabled={!isConnected}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </View>
      )}

      {roomId && (
        <InviteParticipantsModal
          visible={inviteModalVisible}
          roomId={roomId}
          roomName={room?.name}
          existingMemberIds={memberIds}
          onClose={() => setInviteModalVisible(false)}
        />
      )}
      
      <ParticipantsModal
        visible={participantsModalVisible}
        roomId={roomId}
        roomName={room?.name}
        participantIds={memberIds}
        messages={roomMessages.map(m => ({
          senderId: m.senderId,
          senderName: m.senderName,
          senderType: m.senderType,
          sender: m.sender, // Include full sender object for name/email extraction
        }))}
        onClose={() => setParticipantsModalVisible(false)}
      />
    </View>
  );
}
