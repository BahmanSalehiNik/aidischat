import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arApi, ARRoom, ARMessage, ProviderTokens } from '../../utils/arApi';
import { avatarApi } from '../../utils/avatarApi';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';
import { parseMarkers } from '../../utils/markerParser';
import { generateVisemes } from '../../utils/phonemeToViseme';
import { useAuthStore } from '../../store/authStore';

export default function ARChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string }>();
  const { ws, isConnected } = useGlobalWebSocket();
  const { user } = useAuthStore();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [room, setRoom] = useState<ARRoom | null>(null);
  const [messages, setMessages] = useState<ARMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [providerTokens, setProviderTokens] = useState<ProviderTokens | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const streamingMessageIdRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    streamingMessageIdRef.current = streamingMessageId;
  }, [streamingMessageId]);

  useEffect(() => {
    if (params.agentId) {
      initializeARChat();
    }
  }, [params.agentId]);

  // Track keyboard height
  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (ws && isConnected && room) {
      // Join AR room via WebSocket
      ws.send(JSON.stringify({
        type: 'join',
        roomId: room.id,
        isARRoom: true, // Indicate this is an AR room
      }));

      // Listen for AR stream chunks
      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'ar-stream-chunk') {
            const chunkData = data.data;
            // Use ref to get current streamingMessageId without causing re-renders
            const currentStreamingId = streamingMessageIdRef.current;
            
            console.log('📥 [ARChatScreen] Received AR stream chunk:', {
              messageId: chunkData.messageId,
              currentStreamingId,
              chunkIndex: chunkData.chunkIndex,
              isFinal: chunkData.isFinal,
            });
            
            // Chunks use the user's messageId, but we need to create/update an agent message
            // Also verify the chunk is for the current room
            if (chunkData.messageId === currentStreamingId && chunkData.roomId === room?.id) {
              setStreamingContent(prev => {
                const newContent = prev + chunkData.chunk;
                
                // Parse markers from streaming content (for real-time display)
                const { text: cleanText, markers } = parseMarkers(newContent);
                
                // Log markers if found
                if (markers.length > 0) {
                  console.log('🎭 [ARChatScreen] Markers found in stream:', markers);
                }
                
                // Update the message in the messages list with streaming content
                setMessages(prevMessages => {
                  const prevArray = Array.isArray(prevMessages) ? prevMessages : [];
                  
                  // Look for existing agent message for this user message (agent-{messageId})
                  const agentMessageId = `agent-${currentStreamingId}`;
                  const agentMessageIndex = prevArray.findIndex(msg => msg.id === agentMessageId);
                  
                  if (agentMessageIndex >= 0) {
                    // Update existing agent message with streaming content and markers
                    console.log('📝 [ARChatScreen] Updating existing agent message:', agentMessageId);
                    const updatedMessages = [...prevArray];
                    updatedMessages[agentMessageIndex] = {
                      ...updatedMessages[agentMessageIndex],
                      content: newContent, // Keep raw content with markers for final parsing
                      markers: markers, // Update markers in real-time
                      status: chunkData.isFinal ? 'completed' : 'streaming',
                    };
                    return updatedMessages;
                  } else {
                    // Check if there's a user message with this ID
                    const userMessageIndex = prevArray.findIndex(msg => msg.id === currentStreamingId);
                    const isUserMessage = userMessageIndex >= 0 && 
                      (prevArray[userMessageIndex].senderType === 'human' || 
                       (user && prevArray[userMessageIndex].senderId === user.id));
                    
                    // Create new agent message for the response
                    console.log('📝 [ARChatScreen] Creating new agent message:', {
                      agentMessageId,
                      isUserMessage,
                      chunkIndex: chunkData.chunkIndex,
                      contentLength: newContent.length,
                      markersFound: markers.length,
                    });
                    
                    const agentMessage: ARMessage = {
                      id: agentMessageId,
                      roomId: chunkData.roomId || room?.id || '',
                      senderId: params.agentId || '',
                      senderType: 'agent',
                      content: newContent, // Keep raw content with markers
                      markers: markers, // Include parsed markers
                      status: chunkData.isFinal ? 'completed' : 'streaming',
                      createdAt: new Date().toISOString(),
                    };
                    return [...prevArray, agentMessage];
                  }
                });
                
                // If final chunk, process markers and trigger TTS/animations
                if (chunkData.isFinal) {
                  console.log('✅ [ARChatScreen] Final chunk received, processing complete message');
                  console.log('🎭 [ARChatScreen] Final markers:', markers);
                  // Use setTimeout to ensure state is updated
                  setTimeout(() => {
                    processStreamComplete(newContent);
                  }, 0);
                }
                
                return newContent;
              });
            } else {
              console.warn('⚠️ [ARChatScreen] Received chunk for different message:', {
                chunkMessageId: chunkData.messageId,
                currentStreamingId,
              });
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.addEventListener('message', handleMessage);
      return () => {
        ws.removeEventListener('message', handleMessage);
      };
    }
    // Note: processStreamComplete is defined in the component but doesn't need to be in deps
    // since it's only called from within the handler closure
  }, [ws, isConnected, room]); // Removed streamingMessageId from dependencies to prevent handler recreation

  const initializeARChat = async () => {
    try {
      setLoading(true);
      
      // Clear any previous messages and streaming state when starting/rejoining
      setMessages([]);
      setStreamingMessageId(null);
      setStreamingContent('');
      streamingMessageIdRef.current = null;
      
      // 1. Create or get AR room
      const arRoom = await arApi.createOrGetARRoom(params.agentId!);
      
      console.log('📋 AR Room Response:', JSON.stringify(arRoom, null, 2));
      console.log('📋 AR Room ID:', arRoom?.id);
      console.log('📋 AR Room _id:', (arRoom as any)?._id);
      
      // Handle both 'id' and '_id' formats
      const roomId = arRoom?.id || (arRoom as any)?._id;
      
      if (!arRoom || !roomId) {
        console.error('❌ Invalid AR room response:', arRoom);
        throw new Error('Failed to create AR room: Invalid response');
      }
      
      // Normalize the room object to ensure it has 'id'
      const normalizedRoom = {
        ...arRoom,
        id: roomId,
      };
      
      setRoom(normalizedRoom);

      // 2. Get provider tokens
      const tokens = await arApi.getProviderTokens(normalizedRoom.id);
      setProviderTokens(tokens);

      // 3. For AR chat, start with empty messages - subtitle will be empty until new messages arrive
      // This ensures a clean slate when joining/rejoining a room
      setMessages([]);
      
      // Also clear any streaming state
      setStreamingMessageId(null);
      setStreamingContent('');
      streamingMessageIdRef.current = null;

      // 4. Get 3D model URL
      try {
        const avatarStatus = await avatarApi.getAvatarStatus(params.agentId!);
        if (avatarStatus.status === 'ready' && avatarStatus.modelUrl) {
          setModelUrl(avatarStatus.modelUrl);
        }
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    } catch (error: any) {
      console.error('Error initializing AR chat:', error);
      Alert.alert('Error', 'Failed to initialize AR chat. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !room || sending || !params.agentId) return;

    const messageContent = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      // Send message to backend with agentId
      const response = await arApi.sendARMessage(room.id, messageContent, params.agentId);
      
      // Ensure we have a plain object (handle Mongoose documents or wrapped responses)
      let newMessage: ARMessage;
      if (response && typeof response === 'object') {
        // If it has toJSON method (Mongoose document), call it
        if (typeof (response as any).toJSON === 'function') {
          newMessage = (response as any).toJSON();
        } else {
          // Already a plain object, but ensure it's not an array or other iterable
          newMessage = Array.isArray(response) ? response[0] : response as ARMessage;
        }
      } else {
        throw new Error('Invalid response format from server');
      }
      
      console.log('📨 New message received:', JSON.stringify(newMessage, null, 2));
      
      if (!newMessage || !newMessage.id) {
        console.error('❌ Invalid message response:', newMessage);
        throw new Error('Invalid message response from server');
      }
      
      setMessages(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return [...prevArray, newMessage];
      });
      // Note: streamingMessageId is set to user's message ID, but agent response will create a new message
      setStreamingMessageId(newMessage.id);
      setStreamingContent('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const processStreamComplete = async (fullContent: string) => {
    const currentStreamingId = streamingMessageIdRef.current;
    if (!currentStreamingId) return;

    try {
      // Parse markers from content
      const { cleanText, markers } = parseMarkers(fullContent);

      // Find and update the agent message (it should have ID starting with "agent-")
      const agentMessageId = `agent-${currentStreamingId}`;
      setMessages(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        const updated = prevArray.map(msg => {
          // Match by agent message ID or find the last streaming agent message
          if (msg.id === agentMessageId) {
            return { ...msg, content: cleanText, markers, status: 'completed' as const };
          }
          // Fallback: if no exact match, update last streaming agent message
          return msg;
        });
        
        // If we didn't find the exact match, try to find last streaming agent message
        const foundExact = updated.some(msg => msg.id === agentMessageId);
        if (!foundExact) {
          // Find last streaming agent message and update it
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].senderType === 'agent' && updated[i].status === 'streaming') {
              updated[i] = { ...updated[i], content: cleanText, markers, status: 'completed' as const };
              break;
            }
          }
        }
        
        return updated;
      });

      // TODO: Call TTS provider with cleanText
      // TODO: Generate visemes from phonemes
      // TODO: Apply markers to 3D model (emotions, gestures, poses)
      // TODO: Play audio and sync with visemes

      console.log('✅ Stream complete:', { 
        cleanText, 
        markers,
        markersCount: markers.length,
        markerTypes: markers.map(m => `${m.type}:${m.value}`).join(', '),
      });
      
      // Log if no markers were found (potential issue)
      if (markers.length === 0) {
        console.warn('⚠️ [ARChatScreen] No markers found in agent response! The AI may not be generating markers.');
        console.warn('⚠️ [ARChatScreen] Raw content (first 200 chars):', fullContent.substring(0, 200));
      }
      
      // Clear streaming state
      setStreamingMessageId(null);
      setStreamingContent('');
      streamingMessageIdRef.current = null;
    } catch (error) {
      console.error('Error processing stream complete:', error);
      // Update message status to failed
      const currentStreamingId = streamingMessageIdRef.current;
      setMessages(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return prevArray.map(msg => 
          msg.id === currentStreamingId 
            ? { ...msg, status: 'failed' as const }
            : msg
        );
      });
      // Clear streaming state even on error
      setStreamingMessageId(null);
      setStreamingContent('');
      streamingMessageIdRef.current = null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Loading AR Chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      {/* Header */}
      <View style={{
        paddingTop: Math.max(insets.top, 12),
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333333',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF', flex: 1 }}>
          AR Chat
        </Text>
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: isConnected ? '#34C759' : '#FF3B30',
          marginRight: 8,
        }} />
        <Text style={{ fontSize: 12, color: isConnected ? '#34C759' : '#FF3B30' }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* AR View Container - TODO: Replace with actual AR view */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
        {modelUrl ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="cube" size={64} color="#5856D6" />
            <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>
              3D Model Ready
            </Text>
            <Text style={{ color: '#8E8E93', marginTop: 8, fontSize: 12 }}>
              AR rendering will be implemented here
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="cube-outline" size={64} color="#8E8E93" />
            <Text style={{ color: '#8E8E93', marginTop: 16 }}>
              Loading 3D model...
            </Text>
          </View>
        )}
      </View>

      {/* Subtitle Display - Last Message Only */}
      {(() => {
        // Debug: Log current state
        console.log('📝 [Subtitle] Render check:', {
          messagesCount: messages.length,
          hasStreamingContent: !!streamingContent,
          streamingContentLength: streamingContent?.length || 0,
          streamingMessageId,
        });
        
        // Filter messages to only show messages from current room (safety check)
        const currentRoomMessages = room 
          ? messages.filter(msg => msg.roomId === room.id)
          : messages;
        
        // Always show if we have messages OR streaming content
        const hasMessages = currentRoomMessages.length > 0;
        const hasStreaming = !!streamingContent && streamingContent.trim().length > 0;
        
        let displayText = '';
        let isAgent = false;
        
        if (hasMessages) {
          // Show the last message regardless of sender (user or agent)
          const lastMessage = currentRoomMessages[currentRoomMessages.length - 1];
          isAgent = lastMessage.senderType === 'agent';
          
          console.log('📝 [Subtitle] Last message (any sender):', {
            id: lastMessage.id,
            status: lastMessage.status,
            contentLength: lastMessage.content?.length || 0,
            senderType: lastMessage.senderType,
            isAgent,
          });
          
          console.log('📝 [Subtitle] Last message:', {
            id: lastMessage.id,
            status: lastMessage.status,
            contentLength: lastMessage.content?.length || 0,
            senderType: lastMessage.senderType,
            streamingMessageId,
            isAgentMessage: lastMessage.senderType === 'agent',
            hasStreamingContent: !!streamingContent,
            streamingContentLength: streamingContent?.length || 0,
          });
          
          // Prefer streaming content if message is streaming and matches current streaming ID
          if (lastMessage.status === 'streaming' && streamingContent && 
              (lastMessage.id === streamingMessageId || lastMessage.id === `agent-${streamingMessageId}`)) {
            displayText = streamingContent;
            console.log('📝 [Subtitle] Using streaming content');
          } else if (lastMessage.content && lastMessage.content.trim()) {
            displayText = lastMessage.content;
            console.log('📝 [Subtitle] Using message content');
          } else if (lastMessage.status === 'streaming') {
            displayText = '...';
            console.log('📝 [Subtitle] Showing placeholder');
          }
        } else if (hasStreaming) {
          // Show streaming content even if message not in array yet (assume it's agent response)
          displayText = streamingContent;
          isAgent = true; // Assume agent if streaming
          console.log('📝 [Subtitle] Using streaming content (no message in array)');
        }
        
        console.log('📝 [Subtitle] Final displayText:', displayText ? `${displayText.substring(0, 50)}...` : 'EMPTY');
        
        if (!displayText || displayText.trim() === '') {
          console.log('📝 [Subtitle] Returning null - no text to display');
          return null;
        }

        // Calculate bottom position: above input area (60px) + keyboard height + some padding
        const inputAreaHeight = 60; // Approximate input area height
        const padding = 20;
        const bottomPosition = keyboardHeight > 0 
          ? keyboardHeight + inputAreaHeight + padding
          : inputAreaHeight + padding + 100; // Default position when keyboard is hidden

        return (
          <View 
            key={`subtitle-${displayText.length}-${isAgent ? 'agent' : 'user'}`}
            style={{
              position: 'absolute',
              bottom: bottomPosition,
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 32,
              zIndex: 1000,
              pointerEvents: 'none', // Allow touches to pass through
            }}>
            <View style={{
              backgroundColor: isAgent 
                ? 'rgba(88, 86, 214, 0.9)' // Purple for agent
                : 'rgba(0, 122, 255, 0.9)', // Blue for user
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: 12,
              maxWidth: '90%',
              minWidth: 100,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 10,
            }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                textAlign: 'center',
                fontWeight: '500',
                lineHeight: 22,
              }}>
                {displayText.trim() || '...'}
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: '#333333',
          backgroundColor: '#000000',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}>
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#1C1C1E',
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: '#FFFFFF',
              fontSize: 16,
            }}
            placeholder="Type a message..."
            placeholderTextColor="#8E8E93"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={{
              backgroundColor: inputText.trim() && !sending ? '#5856D6' : '#333333',
              borderRadius: 20,
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

