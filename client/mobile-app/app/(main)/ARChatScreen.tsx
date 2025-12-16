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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { arApi, ARRoom, ARMessage, ProviderTokens } from '../../utils/arApi';
import { avatarApi } from '../../utils/avatarApi';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';
import { parseMarkers } from '../../utils/markerParser';
import { generateVisemes } from '../../utils/phonemeToViseme';

export default function ARChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string }>();
  const { ws, isConnected } = useGlobalWebSocket();

  const [room, setRoom] = useState<ARRoom | null>(null);
  const [messages, setMessages] = useState<ARMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [providerTokens, setProviderTokens] = useState<ProviderTokens | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    if (params.agentId) {
      initializeARChat();
    }
  }, [params.agentId]);

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
            if (chunkData.messageId === streamingMessageId) {
              setStreamingContent(prev => {
                const newContent = prev + chunkData.chunk;
                
                // If final chunk, process markers and trigger TTS/animations
                if (chunkData.isFinal) {
                  // Use setTimeout to ensure state is updated
                  setTimeout(() => {
                    processStreamComplete(newContent);
                  }, 0);
                }
                
                return newContent;
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
  }, [ws, isConnected, room, streamingMessageId]);

  const initializeARChat = async () => {
    try {
      setLoading(true);
      
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

      // 3. Load message history
      const history = await arApi.getARMessages(normalizedRoom.id);
      setMessages(history);

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
      
      setMessages(prev => [...prev, newMessage]);
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
    if (!streamingMessageId) return;

    try {
      // Parse markers from content
      const { cleanText, markers } = parseMarkers(fullContent);

      // Update message in state
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, content: cleanText, markers, status: 'completed' as const }
          : msg
      ));

      // TODO: Call TTS provider with cleanText
      // TODO: Generate visemes from phonemes
      // TODO: Apply markers to 3D model (emotions, gestures, poses)
      // TODO: Play audio and sync with visemes

      console.log('✅ Stream complete:', { cleanText, markers });
    } catch (error) {
      console.error('Error processing stream complete:', error);
      // Update message status to failed
      setMessages(prev => prev.map(msg => 
        msg.id === streamingMessageId 
          ? { ...msg, status: 'failed' as const }
          : msg
      ));
    } finally {
      setStreamingMessageId(null);
      setStreamingContent('');
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

        {/* Streaming indicator */}
        {streamingMessageId && (
          <View style={{
            position: 'absolute',
            bottom: 100,
            backgroundColor: 'rgba(88, 86, 214, 0.9)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
              {streamingContent || 'Agent is thinking...'}
            </Text>
          </View>
        )}
      </View>

      {/* Messages List */}
      {messages.length > 0 && (
        <View style={{
          maxHeight: 200,
          backgroundColor: '#1C1C1E',
          borderTopWidth: 1,
          borderTopColor: '#333333',
          paddingVertical: 8,
        }}>
          {messages.slice(-5).map((msg) => (
            <View
              key={msg.id}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: msg.senderType === 'agent' ? '#5856D6' : '#007AFF',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
              }}>
                <Ionicons
                  name={msg.senderType === 'agent' ? 'sparkles' : 'person'}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#8E8E93', fontSize: 12, marginBottom: 4 }}>
                  {msg.senderType === 'agent' ? 'Agent' : 'You'}
                </Text>
                <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                  {msg.content || (msg.status === 'streaming' ? 'Streaming...' : '')}
                </Text>
                {msg.markers && msg.markers.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 }}>
                    {msg.markers.map((marker, idx) => (
                      <View
                        key={idx}
                        style={{
                          backgroundColor: '#333333',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: '#8E8E93', fontSize: 10 }}>
                          {marker.type}:{marker.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                {msg.status === 'streaming' && (
                  <View style={{ marginTop: 4 }}>
                    <ActivityIndicator size="small" color="#5856D6" />
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

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

