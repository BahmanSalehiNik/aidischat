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
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { arApi, ARRoom, ARMessage, ProviderTokens } from '../../utils/arApi';
import { avatarApi } from '../../utils/avatarApi';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';
import { parseMarkers } from '../../utils/markerParser';
import { generateVisemes, VisemeData } from '../../utils/phonemeToViseme';
import { useAuthStore } from '../../store/authStore';
import { Model3DViewer } from '../../components/avatar/Model3DViewer';
import { playTTS } from '../../utils/ttsClient';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

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
  const [animationUrls, setAnimationUrls] = useState<string[]>([]);
  const [currentMarkers, setCurrentMarkers] = useState<Array<{ type: 'emotion' | 'movement' | 'gesture' | 'pose' | 'tone'; value: string }>>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [currentMovement, setCurrentMovement] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [viewMode, setViewMode] = useState<'vr' | 'ar'>('vr'); // VR = 3D space, AR = camera background
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const streamingMessageIdRef = useRef<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [currentVisemes, setCurrentVisemes] = useState<VisemeData[]>([]);
  const [currentVisemeId, setCurrentVisemeId] = useState<number | null>(null);
  const ttsPlayingRef = useRef<boolean>(false);
  const ttsQueuedTextRef = useRef<string>('');
  const ttsStartedTextRef = useRef<string>('');
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for auto-triggering TTS if no final chunk

  // Re-check camera permission when switching to AR mode
  useEffect(() => {
    if (viewMode === 'ar' && cameraPermission && !cameraPermission.granted) {
      // Permission might have been granted outside the app, re-check
      requestCameraPermission().then((result) => {
        console.log('📷 [ARChatScreen] Camera permission re-check:', result?.granted);
      });
    }
  }, [viewMode, cameraPermission]);

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
              // Clear any existing timeout (new chunk received, reset timer)
              if (streamTimeoutRef.current) {
                clearTimeout(streamTimeoutRef.current);
                streamTimeoutRef.current = null;
              }
              
              setStreamingContent(prev => {
                const newContent = prev + chunkData.chunk;
                
                // Parse markers from streaming content (for real-time display)
                const { text: cleanText, markers } = parseMarkers(newContent);
                
                // Log markers if found
                if (markers.length > 0) {
                  console.log('🎭 [ARChatScreen] Markers found in stream:', markers);
                  
                  // Apply markers to 3D model in real-time
                  setCurrentMarkers(markers);
                  
                  // Extract latest emotion and movement for immediate application
                  const latestEmotion = markers.filter(m => m.type === 'emotion').pop()?.value;
                  const latestMovement = markers.filter(m => m.type === 'movement').pop()?.value;
                  
                  if (latestEmotion) {
                    setCurrentEmotion(latestEmotion);
                  }
                  if (latestMovement) {
                    setCurrentMovement(latestMovement);
                  }
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
                  console.log('✅✅✅ [ARChatScreen] FINAL CHUNK RECEIVED!');
                  console.log('✅ [ARChatScreen] Final chunk received, processing complete message');
                  console.log('🎭 [ARChatScreen] Final markers:', markers);
                  console.log('📝 [ARChatScreen] Full content length:', newContent.length);
                  console.log('📝 [ARChatScreen] Full content preview:', newContent.substring(0, 200));
                  
                  // Clear timeout since we got final chunk
                  if (streamTimeoutRef.current) {
                    clearTimeout(streamTimeoutRef.current);
                    streamTimeoutRef.current = null;
                  }
                  
                  // Call processStreamComplete IMMEDIATELY (no delay)
                  console.log('🔄 [ARChatScreen] Calling processStreamComplete NOW...');
                  processStreamComplete(newContent).catch((error) => {
                    console.error('❌ [ARChatScreen] processStreamComplete error:', error);
                  });
                }
                // Note: Timeout for non-final chunks is set up OUTSIDE this if/else block
                
                return newContent;
              });
              
              // Set up timeout AFTER state update (for non-final chunks only)
              // This timeout will fire 2 seconds after the last chunk if no final chunk arrives
              if (!chunkData.isFinal) {
                // Use a function to get the latest content from state when timeout fires
                console.log('⏰ [ARChatScreen] Setting timeout for 2 seconds (chunkIndex:', chunkData.chunkIndex, ')');
                streamTimeoutRef.current = setTimeout(() => {
                  console.log('⏰⏰⏰ [ARChatScreen] TIMEOUT FIRED: No final chunk received after 2 seconds');
                  
                  // Get the latest content from state
                  setStreamingContent(currentContent => {
                    if (currentContent && currentContent.trim().length > 0) {
                      console.log('⏰ [ARChatScreen] Triggering TTS with timeout fallback');
                      console.log('⏰ [ARChatScreen] Content length:', currentContent.length);
                      console.log('⏰ [ARChatScreen] Content preview:', currentContent.substring(0, 200));
                      processStreamComplete(currentContent).catch((error) => {
                        console.error('❌ [ARChatScreen] processStreamComplete error (timeout fallback):', error);
                      });
                    } else {
                      console.warn('⏰ [ARChatScreen] No content to process in timeout fallback');
                    }
                    return currentContent; // Don't modify content
                  });
                  
                  streamTimeoutRef.current = null;
                }, 2000);
              }
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

      // 4. Get 3D model URL and animations
      try {
        const avatarStatus = await avatarApi.getAvatarStatus(params.agentId!);
        if (avatarStatus.status === 'ready' && avatarStatus.modelUrl) {
          setModelUrl(avatarStatus.modelUrl);
          if (avatarStatus.animationUrls && avatarStatus.animationUrls.length > 0) {
            setAnimationUrls(avatarStatus.animationUrls);
            console.log(`✅ [ARChatScreen] Loaded ${avatarStatus.animationUrls.length} animation URLs`);
          }
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
    console.log('🔄🔄🔄 [ARChatScreen] processStreamComplete FUNCTION CALLED');
    console.log('🔄 [ARChatScreen] Full content received:', fullContent.substring(0, 200));
    console.log('🔍 [ARChatScreen] streamingMessageIdRef.current:', streamingMessageIdRef.current);
    console.log('🔍 [ARChatScreen] streamingMessageId state:', streamingMessageId);
    
    // Try both ref and state for streamingMessageId (fallback to state if ref is null)
    const currentStreamingId = streamingMessageIdRef.current || streamingMessageId;
    if (!currentStreamingId) {
      console.error('❌❌❌ [ARChatScreen] processStreamComplete called but NO streamingMessageId!');
      console.error('❌ [ARChatScreen] Ref is null, state is:', streamingMessageId);
      console.error('❌ [ARChatScreen] This means TTS will NOT run!');
      Alert.alert('TTS Error', 'Cannot play TTS: streamingMessageId is missing. Check console logs.');
      return;
    }
    
    console.log('✅ [ARChatScreen] Using streamingId:', currentStreamingId);
    console.log('✅ [ARChatScreen] processStreamComplete proceeding:', {
      contentLength: fullContent.length,
      streamingId: currentStreamingId,
      contentPreview: fullContent.substring(0, 100)
    });

    try {
      // Parse markers from content
      const parseResult = parseMarkers(fullContent);
      const cleanText = parseResult?.text || ''; // parseMarkers returns 'text', not 'cleanText'
      const markers = parseResult?.markers || [];
      
      console.log('📝 [ARChatScreen] Parsed content:', {
        parseResult,
        cleanText: cleanText || '(empty)',
        cleanTextLength: cleanText?.length || 0,
        cleanTextPreview: cleanText?.substring(0, 100) || '(empty)',
        markersCount: markers?.length || 0,
        hasCleanText: !!cleanText && cleanText.trim().length > 0,
        fullContentLength: fullContent?.length || 0,
        fullContentPreview: fullContent?.substring(0, 100) || '(empty)'
      });
      
      if (!cleanText || cleanText.trim().length === 0) {
        console.error('❌ [ARChatScreen] parseMarkers returned empty text!');
        console.error('❌ [ARChatScreen] fullContent was:', fullContent);
        console.error('❌ [ARChatScreen] parseResult was:', parseResult);
        Alert.alert('TTS Error', 'Cannot play TTS: No text content after parsing markers.');
        return;
      }

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

      // Update current markers for 3D model animation
      setCurrentMarkers(markers);
      
      // Extract latest emotion and movement for immediate application
      const latestEmotion = markers.filter(m => m.type === 'emotion').pop()?.value || null;
      const latestMovement = markers.filter(m => m.type === 'movement').pop()?.value || null;
      
      if (latestEmotion) {
        setCurrentEmotion(latestEmotion);
        console.log('😊 [ARChatScreen] Applying emotion:', latestEmotion);
      }
      if (latestMovement) {
        setCurrentMovement(latestMovement);
        console.log('🎭 [ARChatScreen] Applying movement:', latestMovement);
      }

      // Play TTS audio - EXACTLY like beep button (simple, direct call)
      console.log('🔊 [ARChatScreen] TTS check:', {
        audioEnabled,
        hasCleanText: !!cleanText && cleanText.trim().length > 0,
        cleanTextLength: cleanText?.length || 0,
        cleanTextPreview: cleanText?.substring(0, 50) || '(empty)',
        cleanTextType: typeof cleanText,
        cleanTextValue: cleanText
      });
      
      if (!audioEnabled) {
        console.log('❌ [ARChatScreen] TTS skipped - audio disabled (audioEnabled = false)');
        return;
      }
      
      if (!cleanText || cleanText.trim().length === 0) {
        console.log('❌ [ARChatScreen] TTS skipped - no text (cleanText is empty or whitespace)');
        console.log('❌ [ARChatScreen] cleanText value:', JSON.stringify(cleanText));
        return;
      }
      
      // We have text and audio is enabled - play it!
      try {
        console.log('🔊🔊🔊 [ARChatScreen] ===== STARTING TTS (EXACT like beep button) =====');
        console.log('🔊 [ARChatScreen] Text to speak:', cleanText);
        console.log('🔊 [ARChatScreen] Text length:', cleanText.length);
        console.log('🔊 [ARChatScreen] Text type:', typeof cleanText);
        
        // Stop any previous speech first
        console.log('🔊 [ARChatScreen] Stopping previous speech...');
        Speech.stop();
        
        // Wait a moment for stop to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('🔊 [ARChatScreen] Stop complete, now calling speak()...');
        
        // EXACT same call as beep button - simple and direct
        console.log('🔊🔊🔊 [ARChatScreen] Calling Speech.speak() NOW...');
        console.log('🔊 [ARChatScreen] Parameters:', {
          text: cleanText.substring(0, 50) + '...',
          language: 'en',
          pitch: 1.0,
          rate: 0.9
        });
        
        Speech.speak(cleanText.trim(), {
          language: 'en',
          pitch: 1.0,
          rate: 0.9,
          onStart: () => {
            console.log('✅✅✅✅✅ [ARChatScreen] TTS STARTED - audio playing NOW!');
            setIsPlayingAudio(true);
          },
          onDone: () => {
            console.log('✅✅✅ [ARChatScreen] TTS DONE - finished speaking');
            setIsPlayingAudio(false);
          },
          onStopped: () => {
            console.log('⚠️⚠️⚠️ [ARChatScreen] TTS STOPPED - was interrupted');
            setIsPlayingAudio(false);
          },
          onError: (error: any) => {
            console.error('❌❌❌❌❌ [ARChatScreen] TTS ERROR:', error);
            console.error('❌ [ARChatScreen] Error details:', JSON.stringify(error, null, 2));
            setIsPlayingAudio(false);
          },
        });
        
        console.log('🔊🔊🔊 [ARChatScreen] Speech.speak() CALLED - waiting for onStart callback...');
        console.log('🔊 [ARChatScreen] If you see "TTS STARTED" above, audio should be playing!');
      } catch (error) {
        console.error('❌❌❌ [ARChatScreen] TTS EXCEPTION (caught in try/catch):', error);
        console.error('❌ [ARChatScreen] Exception details:', JSON.stringify(error, null, 2));
        setIsPlayingAudio(false);
      }

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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(console.error);
      }
      // Clear timeout
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
        streamTimeoutRef.current = null;
      }
    };
  }, []);

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
        {/* View Mode Toggle */}
        <TouchableOpacity
          onPress={() => setViewMode(viewMode === 'vr' ? 'ar' : 'vr')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: viewMode === 'ar' ? '#5856D6' : '#333333',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            marginRight: 12,
          }}
        >
          <Ionicons 
            name={viewMode === 'ar' ? 'camera' : 'cube'} 
            size={16} 
            color="#FFFFFF" 
            style={{ marginRight: 4 }}
          />
          <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>
            {viewMode === 'ar' ? 'AR' : 'VR'}
          </Text>
        </TouchableOpacity>
        
        {/* Audio Toggle Button */}
        <TouchableOpacity
          onPress={() => {
            if (isPlayingAudio) {
              Speech.stop();
              setIsPlayingAudio(false);
            } else {
              setAudioEnabled(!audioEnabled);
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: audioEnabled ? '#34C759' : '#FF3B30',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            marginRight: 12,
          }}
        >
          <Ionicons 
            name={isPlayingAudio ? 'stop' : audioEnabled ? 'volume-high' : 'volume-mute'} 
            size={16} 
            color="#FFFFFF" 
            style={{ marginRight: 4 }}
          />
          <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>
            {isPlayingAudio ? 'Stop' : audioEnabled ? 'Sound' : 'Muted'}
          </Text>
        </TouchableOpacity>
        
        {/* Beep Test Button */}
        <TouchableOpacity
          onPress={async () => {
            try {
              console.log('🔊 [ARChatScreen] Beep button pressed');
              // Play a beep sound using expo-speech
              Speech.speak('beep beep beep', {
                language: 'en',
                pitch: 2.0,
                rate: 2.0,
                onStart: () => console.log('✅✅✅ Beep STARTED'),
                onDone: () => console.log('✅ Beep DONE'),
                onError: (e) => console.error('❌ Beep ERROR:', e),
              });
            } catch (error) {
              console.error('Error playing beep:', error);
              Alert.alert('Beep', 'Beep sound played');
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FF9500',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            marginRight: 12,
          }}
        >
          <Ionicons 
            name="musical-notes" 
            size={16} 
            color="#FFFFFF" 
            style={{ marginRight: 4 }}
          />
          <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>
            Beep
          </Text>
        </TouchableOpacity>
        
        {/* Test TTS Button - Direct test */}
        <TouchableOpacity
          onPress={async () => {
            try {
              console.log('🔊 [ARChatScreen] Test TTS button pressed');
              const testText = 'Hello, this is a test message. Can you hear me?';
              console.log('🔊 [ARChatScreen] Speaking test text:', testText);
              Speech.speak(testText, {
                language: 'en',
                pitch: 1.0,
                rate: 0.9,
                onStart: () => {
                  console.log('✅✅✅ Test TTS STARTED - should hear audio NOW!');
                  setIsPlayingAudio(true);
                },
                onDone: () => {
                  console.log('✅ Test TTS DONE');
                  setIsPlayingAudio(false);
                },
                onError: (e) => {
                  console.error('❌ Test TTS ERROR:', e);
                  setIsPlayingAudio(false);
                },
              });
              console.log('🔊 [ARChatScreen] Test Speech.speak() called');
            } catch (error) {
              console.error('❌ Test TTS exception:', error);
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#007AFF',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            marginRight: 12,
          }}
        >
          <Ionicons 
            name="volume-high" 
            size={16} 
            color="#FFFFFF" 
            style={{ marginRight: 4 }}
          />
          <Text style={{ fontSize: 12, color: '#FFFFFF', fontWeight: '600' }}>
            Test TTS
          </Text>
        </TouchableOpacity>
        
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

      {/* Animation Test Buttons - Temporary for testing */}
      {modelUrl && (
        <View style={{
          position: 'absolute',
          top: 100,
          right: 10,
          zIndex: 1000,
          gap: 8,
        }}>
          <TouchableOpacity
            onPress={() => {
              console.log('🎬 [Test] Setting movement to: idle');
              setCurrentMovement('idle');
            }}
            style={{ 
              backgroundColor: '#007AFF', 
              padding: 8, 
              borderRadius: 8,
              minWidth: 80,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>Idle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('🎬 [Test] Setting movement to: talking');
              setCurrentMovement('talking');
            }}
            style={{ 
              backgroundColor: '#34C759', 
              padding: 8, 
              borderRadius: 8,
              minWidth: 80,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>Talking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('🎬 [Test] Setting movement to: thinking');
              setCurrentMovement('thinking');
            }}
            style={{ 
              backgroundColor: '#FF9500', 
              padding: 8, 
              borderRadius: 8,
              minWidth: 80,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>Thinking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              console.log('🎬 [Test] Setting movement to: walking');
              setCurrentMovement('walking');
            }}
            style={{ 
              backgroundColor: '#5856D6', 
              padding: 8, 
              borderRadius: 8,
              minWidth: 80,
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>Walking</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AR/VR View Container */}
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {viewMode === 'ar' ? (
          // AR Mode: Camera background with 3D model overlay
          <View style={{ flex: 1 }}>
            {cameraPermission?.granted ? (
              // AR Mode: Use Model3DViewer with transparent background and camera overlay
              modelUrl ? (
                <View style={{ flex: 1 }}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                  />
                  <Model3DViewer
                    modelUrl={modelUrl}
                    animationUrls={animationUrls}
                    enableAR={true}
                    markers={currentMarkers}
                    currentEmotion={currentEmotion || undefined}
                    currentMovement={currentMovement || undefined}
                  />
                </View>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
                  <ActivityIndicator size="large" color="#5856D6" />
                  <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Loading 3D model...</Text>
                </View>
              )
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
                <Ionicons name="camera-outline" size={64} color="#8E8E93" />
                <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16, textAlign: 'center', marginHorizontal: 32 }}>
                  Camera permission required for AR mode
                </Text>
                <TouchableOpacity
                  onPress={requestCameraPermission}
                  style={{
                    marginTop: 24,
                    backgroundColor: '#5856D6',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Grant Camera Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode('vr')}
                  style={{
                    marginTop: 16,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: '#8E8E93' }}>Switch to VR Mode</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          // VR Mode: 3D white space (current implementation)
          <View style={{ flex: 1, backgroundColor: '#000000' }}>
            {modelUrl ? (
              <Model3DViewer
                modelUrl={modelUrl}
                animationUrls={animationUrls}
                enableAR={false}
                markers={currentMarkers}
                currentEmotion={currentEmotion || undefined}
                currentMovement={currentMovement || undefined}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1C1C1E' }}>
                <Ionicons name="cube-outline" size={64} color="#8E8E93" />
                <Text style={{ color: '#8E8E93', marginTop: 16 }}>
                  Loading 3D model...
                </Text>
              </View>
            )}
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
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

