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
import { Audio, Sound } from 'expo-av';

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
  const [currentMarkers, setCurrentMarkers] = useState<Array<{ type: 'emotion' | 'movement' | 'gesture' | 'pose' | 'tone'; value: string }>>([]);
  const [currentEmotion, setCurrentEmotion] = useState<string | null>(null);
  const [currentMovement, setCurrentMovement] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [viewMode, setViewMode] = useState<'vr' | 'ar'>('vr'); // VR = 3D space, AR = camera background
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const streamingMessageIdRef = useRef<string | null>(null);
  const [currentVisemes, setCurrentVisemes] = useState<VisemeData[]>([]);
  const [currentVisemeId, setCurrentVisemeId] = useState<number | null>(null);
  const visemeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for auto-triggering TTS if no final chunk
  const ttsPlayingRef = useRef<boolean>(false); // Track if TTS is currently playing
  const ttsQueuedTextRef = useRef<string>(''); // Queue for text that arrives while TTS is playing
  const ttsStartedTextRef = useRef<string>(''); // Track what text we've already started speaking

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
              chunkLength: chunkData.chunk?.length || 0,
            });
            
            // Log if this is the final chunk
            if (chunkData.isFinal) {
              console.log('🎯🎯🎯 [ARChatScreen] FINAL CHUNK DETECTED! isFinal=true');
            }
            
            // Chunks use the user's messageId, but we need to create/update an agent message
            // Also verify the chunk is for the current room
            if (chunkData.messageId === currentStreamingId && chunkData.roomId === room?.id) {
              console.log('✅ [ARChatScreen] Chunk matches current stream and room');
              
              // Clear any existing timeout (new chunk received, reset timer)
              if (streamTimeoutRef.current) {
                clearTimeout(streamTimeoutRef.current);
                streamTimeoutRef.current = null;
              }
              
              // If this is the first chunk (chunkIndex 0), reset TTS state for new message
              if (chunkData.chunkIndex === 0) {
                console.log('🔄 [ARChatScreen] First chunk of new message - resetting TTS state');
                ttsPlayingRef.current = false;
                ttsQueuedTextRef.current = '';
                ttsStartedTextRef.current = '';
                (ttsQueuedTextRef as any).cleanText = '';
                Speech.stop(); // Stop any ongoing TTS from previous message
              }
              
              setStreamingContent(prev => {
                const newContent = prev + chunkData.chunk;
                
                // Parse markers from streaming content (for real-time display)
                const { text: cleanText, markers } = parseMarkers(newContent);
                
                // Store latest content for TTS queue checking
                const currentStreamingId = streamingMessageIdRef.current;
                
                // REAL-TIME TTS: Start speaking early if we have enough text
                // Simplified approach: Start early, but let timeout fallback handle continuation
                // This is more reliable than trying to queue mid-speech
                const hasCompleteSentence = /[.!?]\s/.test(cleanText);
                const shouldStartTTS = !ttsPlayingRef.current && 
                                      ttsStartedTextRef.current.length === 0 &&
                                      ((hasCompleteSentence && cleanText.length >= 80) || 
                                       cleanText.length >= 150);
                
                if (shouldStartTTS) {
                  console.log('🎤 [ARChatScreen] Starting REAL-TIME TTS (early start)');
                  console.log('🎤 [ARChatScreen] Text so far:', cleanText.substring(0, 200));
                  console.log('🎤 [ARChatScreen] Will play full message via timeout fallback if needed');
                  
                  // Store the raw content (with markers) for later full playback
                  ttsQueuedTextRef.current = newContent; // Store raw content
                  
                  // Start TTS with current text - this will play the first part
                  const currentStreamingId = streamingMessageIdRef.current;
                  if (currentStreamingId) {
                    ttsPlayingRef.current = true;
                    ttsStartedTextRef.current = cleanText;
                    
                    // Play the current text - when it finishes, check for remaining text
                    playTTS(cleanText, (visemeId) => {
                      setCurrentVisemeId(visemeId);
                    }, true).then(async () => {
                      console.log('✅ [ARChatScreen] Early TTS segment completed');
                      ttsPlayingRef.current = false;
                      
                      // Wait a moment for processStreamComplete to finish setting the queue
                      await new Promise(resolve => setTimeout(resolve, 100));
                      
                      // Check if there's queued text to play (from processStreamComplete)
                      // Try multiple sources: queue ref, stored cleanText, or streamingContent state
                      const queuedContent = ttsQueuedTextRef.current;
                      const storedCleanText = (ttsQueuedTextRef as any).cleanText;
                      const currentStreamingContent = streamingContent; // Get from state as fallback
                      
                      // Use stored cleanText if available (most reliable), otherwise parse queue or use streamingContent
                      let contentToUse: string | null = null;
                      let queuedCleanText: string | null = null;
                      
                      if (storedCleanText && storedCleanText.length > 0) {
                        // Use stored clean text directly (most reliable)
                        queuedCleanText = storedCleanText;
                        contentToUse = queuedContent || currentStreamingContent; // For reference
                        console.log('🔍 [ARChatScreen] Using stored cleanText from queue');
                      } else if (queuedContent && queuedContent.length > 0) {
                        // Parse queued content
                        const queuedParsed = parseMarkers(queuedContent);
                        queuedCleanText = queuedParsed.text;
                        contentToUse = queuedContent;
                        console.log('🔍 [ARChatScreen] Parsed queued content');
                      } else if (currentStreamingContent && currentStreamingContent.length > 0) {
                        // Use streamingContent as fallback
                        const streamParsed = parseMarkers(currentStreamingContent);
                        queuedCleanText = streamParsed.text;
                        contentToUse = currentStreamingContent;
                        console.log('🔍 [ARChatScreen] Using streamingContent as fallback');
                      }
                      
                      console.log('🔍 [ARChatScreen] Checking queued content after early TTS completed:', {
                        hasQueuedContent: !!queuedContent,
                        queuedContentLength: queuedContent?.length || 0,
                        hasStoredCleanText: !!storedCleanText,
                        storedCleanTextLength: storedCleanText?.length || 0,
                        hasStreamingContent: !!currentStreamingContent,
                        streamingContentLength: currentStreamingContent?.length || 0,
                        queuedCleanTextLength: queuedCleanText?.length || 0,
                        alreadySpokenLength: cleanText.length,
                        alreadySpokenPreview: cleanText.substring(0, 50)
                      });
                      
                      if (queuedCleanText && queuedCleanText.length > 0) {
                        // Use the text we actually just finished speaking (cleanText from closure)
                        const alreadySpoken = cleanText; // This is what we just finished speaking
                        
                        console.log('🔍 [ARChatScreen] Parsed queued content:', {
                          queuedCleanTextLength: queuedCleanText.length,
                          queuedCleanTextPreview: queuedCleanText.substring(0, 50),
                          alreadySpokenLength: alreadySpoken.length,
                          alreadySpokenPreview: alreadySpoken.substring(0, 50),
                          hasMore: queuedCleanText.length > alreadySpoken.length
                        });
                        
                        if (queuedCleanText.length > alreadySpoken.length) {
                          // Calculate remaining text from what we actually spoke
                          const remainingText = queuedCleanText.substring(alreadySpoken.length).trim();
                          console.log('🔍 [ARChatScreen] Remaining text calculation:', {
                            remainingTextLength: remainingText.length,
                            remainingTextPreview: remainingText.substring(0, 100)
                          });
                          
                          if (remainingText.length > 0) {
                            console.log('🎤 [ARChatScreen] ===== FOUND REMAINING TEXT IN QUEUE, PLAYING NOW =====');
                            console.log('🎤 [ARChatScreen] Remaining text:', remainingText.substring(0, 150));
                            ttsPlayingRef.current = true;
                            ttsStartedTextRef.current = queuedCleanText;
                            ttsQueuedTextRef.current = ''; // Clear queue
                            (ttsQueuedTextRef as any).cleanText = ''; // Clear stored cleanText
                            
                            // Generate visemes for remaining text
                            const wordCount = remainingText.split(/\s+/).length;
                            const estimatedDurationMs = wordCount * 400;
                            const visemes = generateVisemes(remainingText, estimatedDurationMs);
                            setCurrentVisemes(visemes);
                            
                            playTTS(remainingText, (visemeId) => {
                              setCurrentVisemeId(visemeId);
                            }, false).then(() => {
                              console.log('✅ [ARChatScreen] Remaining text TTS completed - FULL MESSAGE DONE');
                              ttsPlayingRef.current = false;
                            }).catch((error) => {
                              console.error('❌ [ARChatScreen] Remaining text TTS error:', error);
                              ttsPlayingRef.current = false;
                            });
                            return; // Exit early since we're playing remaining text
                          } else {
                            console.log('⚠️ [ARChatScreen] Remaining text is empty after trim');
                          }
                        } else {
                          console.log('⚠️ [ARChatScreen] Queued text is not longer than already spoken text');
                        }
                      } else {
                        console.log('⚠️ [ARChatScreen] No queued content found in ttsQueuedTextRef');
                      }
                      
                      // If no queued text, the timeout fallback will handle it
                      console.log('⏳ [ARChatScreen] No queued text found or no remaining text. Timeout fallback will handle remaining text if any.');
                    }).catch((error) => {
                      console.error('❌ [ARChatScreen] Early TTS error:', error);
                      ttsPlayingRef.current = false;
                    });
                  }
                } else if (ttsPlayingRef.current) {
                  // TTS is already playing - update queue with latest text (for timeout fallback)
                  if (newContent.length > (ttsQueuedTextRef.current?.length || 0)) {
                    ttsQueuedTextRef.current = newContent; // Store raw content with markers
                    console.log('📝 [ARChatScreen] TTS playing, updated queue for timeout fallback (total:', newContent.length, 'chars)');
                  }
                }
                
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
                  console.log('✅✅✅ [ARChatScreen] FINAL CHUNK RECEIVED - Processing complete message');
                  
                  // Clear timeout since we got the final chunk
                  if (streamTimeoutRef.current) {
                    clearTimeout(streamTimeoutRef.current);
                    streamTimeoutRef.current = null;
                  }
                  
                  console.log('🎭 [ARChatScreen] Final markers:', markers);
                  console.log('📝 [ARChatScreen] Full content length:', newContent.length);
                  console.log('📝 [ARChatScreen] Full content preview:', newContent.substring(0, 200));
                  console.log('🔍 [ARChatScreen] streamingMessageIdRef.current:', streamingMessageIdRef.current);
                  console.log('🔍 [ARChatScreen] streamingMessageId state:', streamingMessageId);
                  
                  // Use setTimeout to ensure state is updated, then call processStreamComplete
                  setTimeout(() => {
                    console.log('🔄 [ARChatScreen] About to call processStreamComplete...');
                    console.log('🔍 [ARChatScreen] streamingMessageIdRef.current at call time:', streamingMessageIdRef.current);
                    processStreamComplete(newContent).catch((error) => {
                      console.error('❌ [ARChatScreen] processStreamComplete error:', error);
                    });
                  }, 100); // Small delay to ensure state updates
                } else {
                  // Not final chunk - set up timeout to auto-trigger TTS if no final chunk arrives
                  // This is a fallback in case backend doesn't send final chunk
                  if (streamTimeoutRef.current) {
                    clearTimeout(streamTimeoutRef.current);
                  }
                  
                  streamTimeoutRef.current = setTimeout(() => {
                    console.log('⏰ [ARChatScreen] TIMEOUT: No final chunk received after 2 seconds, triggering TTS anyway');
                    console.log('⏰ [ARChatScreen] This is a fallback mechanism in case backend doesn\'t send final chunk');
                    
                    // Get the latest content from state
                    setStreamingContent(currentContent => {
                      if (currentContent && currentContent.trim().length > 0) {
                        console.log('⏰ [ARChatScreen] Triggering processStreamComplete with timeout fallback');
                        processStreamComplete(currentContent).catch((error) => {
                          console.error('❌ [ARChatScreen] processStreamComplete error (timeout fallback):', error);
                        });
                      }
                      return currentContent; // Don't modify content
                    });
                    
                    streamTimeoutRef.current = null;
                  }, 2000); // 2 seconds after last chunk
                }
                
                return newContent;
              });
            } else {
              console.warn('⚠️ [ARChatScreen] Received chunk for different message or room:', {
                chunkMessageId: chunkData.messageId,
                chunkRoomId: chunkData.roomId,
                currentStreamingId,
                currentRoomId: room?.id,
                isFinal: chunkData.isFinal,
              });
              
              // If this is a final chunk but for wrong message, still log it
              if (chunkData.isFinal) {
                console.error('❌❌❌ [ARChatScreen] FINAL CHUNK RECEIVED BUT FOR WRONG MESSAGE/ROOM!');
                console.error('❌ [ARChatScreen] This means TTS will NOT trigger!');
              }
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.addEventListener('message', handleMessage);
      return () => {
        ws.removeEventListener('message', handleMessage);
        // Cleanup timeout on unmount
        if (streamTimeoutRef.current) {
          clearTimeout(streamTimeoutRef.current);
          streamTimeoutRef.current = null;
        }
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
      // Reset TTS state
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      Speech.stop(); // Stop any ongoing TTS
      // Reset TTS state
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      Speech.stop(); // Stop any ongoing TTS
      
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
      // Reset TTS state
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      Speech.stop(); // Stop any ongoing TTS

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

  const handleBeepTest = async () => {
    try {
      console.log('🔊 [ARChatScreen] Testing audio with beep...');
      
      // Configure audio session FIRST - this is critical
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true, // Critical: allows audio in silent mode
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('✅ [ARChatScreen] Audio mode configured');
      } catch (audioError) {
        console.error('❌ [ARChatScreen] Audio mode configuration failed:', audioError);
        Alert.alert('Audio Config Error', `Failed to configure audio: ${audioError}`);
        return;
      }
      
      // Stop any previous speech/audio
      Speech.stop();
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Try expo-speech
      console.log('🔊 [ARChatScreen] Attempting beep with expo-speech...');
      
      let speechStarted = false;
      let speechError: any = null;
      
      Speech.speak('beep beep beep', {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.8,
        volume: 1.0,
        onStart: () => {
          speechStarted = true;
          console.log('✅✅✅ [ARChatScreen] Beep onStart fired - audio should be playing NOW!');
        },
        onDone: () => {
          console.log('✅ [ARChatScreen] Beep onDone fired');
        },
        onError: (error: any) => {
          speechError = error;
          console.error('❌❌❌ [ARChatScreen] Beep error:', error);
        },
      });
      
      // Wait to see if it works
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (speechError) {
        Alert.alert('Beep Error', `Error: ${speechError?.message || speechError}\n\nCheck console for details.`);
      } else if (speechStarted) {
        Alert.alert('Beep Test', 'Beep should be playing!\n\nIf no sound:\n- Check device volume\n- Toggle silent mode (iOS)\n- Check if other apps play sound');
      } else {
        Alert.alert('Beep Test', 'Beep callbacks not firing.\n\nThis suggests expo-speech is not working.\nCheck console for errors.');
      }
      
    } catch (error: any) {
      console.error('❌ [ARChatScreen] Beep test error:', error);
      Alert.alert(
        'Audio Test Failed', 
        `Error: ${error?.message || 'Unknown'}\n\nCheck console logs.`
      );
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
      // Reset TTS state for new message
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      (ttsQueuedTextRef as any).cleanText = '';
      Speech.stop(); // Stop any ongoing TTS from previous message
      console.log('🔄 [ARChatScreen] Reset TTS state for new message');
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

      // Generate TTS and visemes
      // If TTS already started in real-time, play only the remaining text
      if (cleanText && cleanText.trim().length > 0) {
        if (ttsPlayingRef.current) {
          // TTS is currently playing - queue the full text for later
          console.log('📝 [ARChatScreen] TTS already playing, will play remaining text after current segment');
          console.log('📝 [ARChatScreen] Setting queue with fullContent:', {
            fullContentLength: fullContent.length,
            fullContentPreview: fullContent.substring(0, 100),
            cleanTextLength: cleanText.length,
            cleanTextPreview: cleanText.substring(0, 100)
          });
          // Store BOTH raw content and clean text to ensure we have it
          ttsQueuedTextRef.current = fullContent; // Store full raw content
          // Also store the clean text separately in a way that won't be cleared
          (ttsQueuedTextRef as any).cleanText = cleanText; // Store clean text as well
          console.log('📝 [ARChatScreen] Queue set! ttsQueuedTextRef.current length:', ttsQueuedTextRef.current.length);
          console.log('📝 [ARChatScreen] Also stored cleanText length:', cleanText.length);
        } else if (ttsStartedTextRef.current.length > 0) {
          // TTS was playing but finished - play remaining text now
          const alreadySpoken = ttsStartedTextRef.current;
          const alreadySpokenLength = alreadySpoken.length;
          const remainingText = cleanText.substring(alreadySpokenLength).trim();
          
          console.log('🔊 [ARChatScreen] TTS check in processStreamComplete:', {
            cleanTextLength: cleanText.length,
            alreadySpokenLength: alreadySpokenLength,
            hasRemaining: cleanText.length > alreadySpokenLength,
            alreadySpokenPreview: alreadySpoken.substring(0, 50),
            cleanTextPreview: cleanText.substring(0, 50),
            remainingTextLength: remainingText.length
          });
          
          if (remainingText.length > 0) {
            console.log('🎤 [ARChatScreen] ===== PLAYING REMAINING TEXT =====');
            console.log('🎤 [ARChatScreen] Already spoke:', alreadySpokenLength, 'chars');
            console.log('🎤 [ARChatScreen] Remaining text:', remainingText.substring(0, 150));
            console.log('🎤 [ARChatScreen] Full text length:', cleanText.length);
            
            ttsPlayingRef.current = true;
            ttsStartedTextRef.current = cleanText; // Update to full text
            
            // Generate visemes for remaining text
            const wordCount = remainingText.split(/\s+/).length;
            const estimatedDurationMs = wordCount * 400;
            const visemes = generateVisemes(remainingText, estimatedDurationMs);
            setCurrentVisemes(visemes);
            
            playTTS(remainingText, (visemeId) => {
              setCurrentVisemeId(visemeId);
            }, false).then(() => {
              console.log('✅ [ARChatScreen] Remaining text TTS completed - FULL MESSAGE DONE');
              ttsPlayingRef.current = false;
            }).catch((error) => {
              console.error('❌ [ARChatScreen] Remaining text TTS error:', error);
              ttsPlayingRef.current = false;
            });
          } else {
            console.log('✅ [ARChatScreen] No remaining text - message already fully spoken');
          }
        } else {
          // TTS hasn't started yet - start it now with full text
          try {
            console.log('🔊 [ARChatScreen] ===== STARTING TTS (final chunk) =====');
            console.log('🔊 [ARChatScreen] Text to speak:', cleanText.substring(0, 150));
            console.log('🔊 [ARChatScreen] Text length:', cleanText.length);
            
            // Generate visemes from text
            const wordCount = cleanText.split(/\s+/).length;
            const estimatedDurationMs = wordCount * 400; // ~400ms per word
            const visemes = generateVisemes(cleanText, estimatedDurationMs);
            setCurrentVisemes(visemes);
            
            console.log('🔊 [ARChatScreen] Visemes generated:', { 
              visemeCount: visemes.length,
              estimatedDuration: `${(estimatedDurationMs / 1000).toFixed(1)}s`
            });
            
            ttsPlayingRef.current = true;
            ttsStartedTextRef.current = cleanText;
            
            // Play TTS using expo-speech (now with audio session config)
            console.log('🔊 [ARChatScreen] Calling playTTS()...');
            playTTS(cleanText, (visemeId) => {
              setCurrentVisemeId(visemeId);
              // Don't log every viseme update (too verbose)
            }).then(() => {
              console.log('✅ [ARChatScreen] playTTS() completed successfully');
              ttsPlayingRef.current = false;
            }).catch((error) => {
              console.error('❌ [ARChatScreen] TTS playback error:', error);
              ttsPlayingRef.current = false;
              Alert.alert('TTS Error', `Failed to play message: ${error?.message || error}`);
              // Continue with visemes even if TTS fails
            });
          } catch (error) {
            console.error('❌ [ARChatScreen] TTS generation error:', error);
            ttsPlayingRef.current = false;
            Alert.alert('TTS Error', `Failed to generate TTS: ${error}`);
          }
        }
      } else {
        console.warn('⚠️ [ARChatScreen] No clean text for TTS (cleanText is empty or whitespace)');
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
      // Note: Don't reset TTS state here - let it finish naturally
      // DON'T clear ttsQueuedTextRef here - we need it for remaining text playback!
      // Reset TTS state only after TTS completes
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      Speech.stop(); // Stop any ongoing TTS
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
      // Reset TTS state
      ttsPlayingRef.current = false;
      ttsQueuedTextRef.current = '';
      ttsStartedTextRef.current = '';
      Speech.stop(); // Stop any ongoing TTS
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

      {/* AR/VR View Container */}
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {viewMode === 'ar' ? (
          // AR Mode: Camera background with 3D model overlay
          <View style={{ flex: 1 }}>
            {cameraPermission?.granted ? (
              <View style={{ flex: 1 }}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                />
                {/* 3D Model Overlay - Transparent background to show camera */}
                {modelUrl && (
                  <View style={{ flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }}>
                    <Model3DViewer
                      modelUrl={modelUrl}
                      enableAR={true}
                      markers={currentMarkers}
                      currentEmotion={currentEmotion || undefined}
                      currentMovement={currentMovement || undefined}
                      visemes={currentVisemes}
                    />
                  </View>
                )}
              </View>
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
                enableAR={false}
                markers={currentMarkers}
                currentEmotion={currentEmotion || undefined}
                currentMovement={currentMovement || undefined}
                visemes={currentVisemes}
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: Math.max(12, insets.bottom), // Add bottom safe area for Android navigation bar
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
          {/* Beep Test Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#FF9500',
              borderRadius: 20,
              width: 44,
              height: 44,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={handleBeepTest}
          >
            <Ionicons name="volume-high" size={20} color="#FFFFFF" />
          </TouchableOpacity>
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

