import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_URL } from '@env';
import { useChatStore, Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { getResolvedWsUrl } from '../utils/network';

// DEBUG: Log environment variables at module load time
console.log('🔍 [ENV DEBUG] Raw WS_URL from @env:', WS_URL);
console.log('🔍 [ENV DEBUG] Type:', typeof WS_URL);

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const useWebSocket = (roomId: string | null) => {
  const { token } = useAuthStore();
  const { addMessage, setRoomMembers, removeRoom } = useChatStore();
  // Normalize roomId to ensure consistency (trim whitespace)
  const normalizedRoomId = roomId?.trim() || null;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingReactionUpdatesRef = useRef<Map<string, Array<{ data: any; timestamp: number }>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsUrl = getResolvedWsUrl(WS_URL);

  const connect = useCallback(() => {
    if (!token || !normalizedRoomId) {
      console.log('⚠️ Cannot connect: missing token or roomId');
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Connect with token in query parameter
      const wsUrlWithToken = `${wsUrl}?token=${token}`;
      console.log(`🔗 Connecting to WebSocket: ${wsUrlWithToken.replace(/token=[^&]+/, 'token=***')}`);

      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket connected`);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Join the room immediately on connect
        if (normalizedRoomId) {
          console.log(`[WebSocket] Joining room ${normalizedRoomId} on connect`);
          ws.send(JSON.stringify({
            type: 'join',
            roomId: normalizedRoomId,
          }));
        } else {
          console.warn(`[WebSocket] ⚠️ No roomId provided, cannot join room`);
        }

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('📨 Received message:', msg.type);

          switch (msg.type) {
            case 'pong':
              // Heartbeat response, no action needed
              break;

            case 'room.joined':
              console.log(`✅ Joined room ${msg.payload.roomId}`);
              if (msg.payload.members) {
                setRoomMembers(msg.payload.roomId, msg.payload.members);
              }
              break;

            case 'room.membership':
              console.log(`👥 Room membership changed: ${msg.payload.action}`);
              if (msg.payload.members) {
                setRoomMembers(msg.payload.roomId, msg.payload.members);
              }
              break;

            case 'room.deleted':
              console.log(`🗑️ Room deleted: ${msg.payload.roomId}`);
              removeRoom(msg.payload.roomId);
              break;

            case 'message':
              // Message from server
              if (msg.data) {
                // Validate required fields before processing
                // Note: content can be empty (e.g., messages with only attachments)
                if (!msg.data.id || !msg.data.roomId || !msg.data.senderId) {
                  console.warn(`⚠️ [WebSocket] Invalid message received, missing required fields:`, {
                    hasId: !!msg.data.id,
                    hasRoomId: !!msg.data.roomId,
                    hasSenderId: !!msg.data.senderId,
                    hasContent: !!msg.data.content,
                    data: msg.data,
                  });
                  break;
                }

                const { user } = useAuthStore.getState();
                // Normalize roomId for comparison
                const messageRoomIdNormalized = msg.data.roomId?.trim();
                const roomIdMatch = messageRoomIdNormalized === normalizedRoomId;

                console.log(`📨 Received message via WebSocket:`, {
                  id: msg.data.id,
                  roomId: msg.data.roomId,
                  roomIdNormalized: messageRoomIdNormalized,
                  roomIdFromHook: normalizedRoomId, // DEBUG: Compare roomId from hook param vs message
                  roomIdMatch, // DEBUG: Check if they match
                  senderId: msg.data.senderId,
                  content: msg.data.content?.substring(0, 50),
                  replyToMessageId: msg.data.replyToMessageId,
                  reactionsSummary: msg.data.reactionsSummary,
                  reactions: msg.data.reactions,
                });
                const message: Message = {
                  id: msg.data.id,
                  roomId: msg.data.roomId,
                  senderId: msg.data.senderId,
                  senderType: msg.data.senderType || 'human',
                  senderName: msg.data.senderName, // Use denormalized sender name from event
                  content: msg.data.content || '',
                  createdAt: msg.data.createdAt || new Date().toISOString(),
                  attachments: msg.data.attachments,
                  replyToMessageId: msg.data.replyToMessageId || null,
                  // Include replyTo directly from message.created event if available
                  replyTo: msg.data.replyTo ? {
                    id: msg.data.replyTo.id,
                    roomId: msg.data.roomId,
                    senderId: msg.data.replyTo.senderId,
                    senderName: msg.data.replyTo.senderName,
                    senderType: msg.data.replyTo.senderType || 'human',
                    content: msg.data.replyTo.content || '',
                    createdAt: msg.data.replyTo.createdAt || new Date().toISOString(),
                    // Exclude attachments - not needed for preview card
                  } : undefined,
                  reactions: msg.data.reactions || [],
                  reactionsSummary: msg.data.reactionsSummary || [], // Initialize with empty array if not provided
                  currentUserReaction: msg.data.reactions?.find((r: any) => r.userId === user?.id)?.emoji || null, // Calculate current user's reaction if available
                  sender: msg.data.sender, // Preserve sender info if present (for backward compatibility)
                };

                // Check if this message already exists before adding
                // The addMessage function in the store will handle optimistic message replacement
                // So we just call addMessage and let it handle deduplication
                console.log(`[WebSocket] Adding/updating message ${message.id} with reactionsSummary:`, message.reactionsSummary);

                // Normalize roomId from message data and compare with hook param
                const messageRoomId = msg.data.roomId?.trim();
                const targetRoomId = messageRoomId || normalizedRoomId;

                console.log(`[WebSocket] 🔍 DEBUG - Adding message to roomId: "${messageRoomId}", hook roomId: "${normalizedRoomId}", using: "${targetRoomId}"`);

                if (!targetRoomId) {
                  console.error(`[WebSocket] ❌ Cannot add message: no roomId in message data or hook param`);
                  break;
                }

                // Log if there's a mismatch
                if (messageRoomId && normalizedRoomId && messageRoomId !== normalizedRoomId) {
                  console.warn(`[WebSocket] ⚠️ roomId mismatch - hook: "${normalizedRoomId}", message: "${messageRoomId}", using: "${targetRoomId}"`);
                }

                // Ensure message.roomId matches targetRoomId
                message.roomId = targetRoomId;
                addMessage(targetRoomId, message);

                // After adding, check if there are any pending reaction updates for this message
                // Use a small delay to ensure the message is in the store and optimistic replacement is complete
                setTimeout(() => {
                  // Check if there are any pending reaction updates for this message
                  const { messages: currentMessages } = useChatStore.getState();
                  const roomMessages = currentMessages[targetRoomId] || [];
                  // Find the message - it might have been replaced (optimistic -> real), so check both id and tempId
                  const actualMessage = roomMessages.find(m =>
                    m.id === message.id ||
                    (message.tempId && m.tempId === message.tempId) ||
                    (message.tempId && m.id === message.id) // Real message replaced optimistic
                  );

                  if (actualMessage) {
                    // Check for pending updates by both real ID and tempId (in case message was replaced)
                    let pendingUpdates = pendingReactionUpdatesRef.current.get(actualMessage.id);
                    if (!pendingUpdates && message.tempId) {
                      // Also check by tempId in case the message ID changed
                      const pendingByTempId = pendingReactionUpdatesRef.current.get(message.tempId);
                      if (pendingByTempId) {
                        // Move updates to the real message ID
                        pendingReactionUpdatesRef.current.set(actualMessage.id, pendingByTempId);
                        pendingReactionUpdatesRef.current.delete(message.tempId);
                        pendingUpdates = pendingByTempId;
                      }
                    }

                    if (pendingUpdates && pendingUpdates.length > 0) {
                      console.log(`🔄 [WebSocket] Found ${pendingUpdates.length} pending reaction update(s) for message ${actualMessage.id}, applying now...`);
                      const { updateMessage } = useChatStore.getState();
                      const { user } = useAuthStore.getState();

                      // Apply the most recent pending update
                      const latestUpdate = pendingUpdates[pendingUpdates.length - 1];
                      const updateData = latestUpdate.data;

                      // Determine if this is a created or removed event based on data structure
                      const isRemoval = updateData.userId && !updateData.reaction; // Removal has userId but no reaction object

                      let newCurrentUserReaction: string | null | undefined;
                      if (isRemoval) {
                        // For removal: if current user removed, set to null; otherwise preserve
                        const isCurrentUserRemoval = updateData.userId === user?.id;
                        newCurrentUserReaction = isCurrentUserRemoval ? null : actualMessage.currentUserReaction;
                      } else {
                        // For creation: if current user reacted, use their emoji; otherwise preserve
                        const isCurrentUserReaction = updateData.reaction?.userId === user?.id;
                        if (isCurrentUserReaction) {
                          newCurrentUserReaction = updateData.reaction?.emoji || null;
                        } else {
                          newCurrentUserReaction = actualMessage.currentUserReaction;
                        }
                      }

                      const updates: any = {
                        reactionsSummary: updateData.reactionsSummary || [],
                      };
                      if (newCurrentUserReaction !== undefined) {
                        updates.currentUserReaction = newCurrentUserReaction;
                      }

                      updateMessage(targetRoomId, actualMessage.id, updates);
                      console.log(`✅ [WebSocket] Applied pending ${isRemoval ? 'removal' : 'reaction'} update for message ${actualMessage.id}`);

                      // Remove all processed updates for this message
                      pendingReactionUpdatesRef.current.delete(actualMessage.id);
                      if (message.tempId) {
                        pendingReactionUpdatesRef.current.delete(message.tempId);
                      }
                    }
                  }
                }, 50); // Small delay to ensure message is in store

                // If this is a reply and replyTo isn't set yet, try to populate from store
                // (fallback in case replyTo wasn't included in message.created event)
                if (message.replyToMessageId && !message.replyTo) {
                  const { messages } = useChatStore.getState();
                  const roomMessages = messages[targetRoomId] || [];
                  const originalMessage = roomMessages.find(m => m.id === message.replyToMessageId);
                  if (originalMessage) {
                    const { updateMessage } = useChatStore.getState();
                    updateMessage(targetRoomId, message.id, {
                      replyTo: {
                        id: originalMessage.id,
                        roomId: originalMessage.roomId,
                        senderId: originalMessage.senderId,
                        senderName: originalMessage.senderName,
                        senderType: originalMessage.senderType,
                        content: originalMessage.content,
                        createdAt: originalMessage.createdAt,
                        attachments: originalMessage.attachments || [],
                      },
                    });
                  }
                }
              } else {
                console.warn(`⚠️ Received message event without data:`, msg);
              }
              break;

            case 'message.reaction.created':
              // Reaction added/updated
              if (msg.data) {
                // Normalize roomId
                const reactionRoomId = msg.data.roomId?.trim() || normalizedRoomId;
                console.log(`❤️ Reaction created:`, {
                  messageId: msg.data.messageId,
                  roomId: msg.data.roomId,
                  roomIdNormalized: reactionRoomId,
                  emoji: msg.data.reaction?.emoji,
                  userId: msg.data.reaction?.userId,
                  reactionsSummary: msg.data.reactionsSummary,
                });
                const { updateMessage, messages, addMessage } = useChatStore.getState();
                const { user } = useAuthStore.getState();
                const messageId = msg.data.messageId;
                const roomId = reactionRoomId;

                // Get the existing message to preserve currentUserReaction if it's not from this event
                // Use a retry mechanism in case the message was just added and store hasn't updated yet
                let roomMessages = messages[roomId] || [];
                let existingMessage = roomMessages.find(m => m.id === messageId);

                // If message not found, queue the update for when the message arrives
                if (!existingMessage) {
                  console.warn(`⚠️ [WebSocket] Message ${messageId} not found in store for room ${roomId}. Queueing reaction update...`, {
                    roomId,
                    messageId,
                    totalMessagesInRoom: roomMessages.length,
                    messageIds: roomMessages.slice(0, 5).map(m => m.id),
                  });

                  // Queue this reaction update
                  const pending = pendingReactionUpdatesRef.current.get(messageId) || [];
                  pending.push({ data: msg.data, timestamp: Date.now() });
                  pendingReactionUpdatesRef.current.set(messageId, pending);

                  // Also retry after delays (message might be added asynchronously)
                  const retryDelays = [100, 500, 1000]; // Progressive retries
                  retryDelays.forEach((delay, index) => {
                    setTimeout(() => {
                      const { messages: retryMessages } = useChatStore.getState();
                      const retryRoomMessages = retryMessages[roomId] || [];
                      const retryExistingMessage = retryRoomMessages.find(m => m.id === messageId);

                      if (retryExistingMessage) {
                        console.log(`✅ [WebSocket] Found message ${messageId} on retry ${index + 1}, updating reactions.`);
                        const isCurrentUserReaction = msg.data.reaction?.userId === user?.id;
                        let newCurrentUserReaction: string | null | undefined;

                        if (isCurrentUserReaction) {
                          newCurrentUserReaction = msg.data.reaction?.emoji || null;
                        } else {
                          newCurrentUserReaction = retryExistingMessage.currentUserReaction;
                        }

                        const updates: any = {
                          reactionsSummary: msg.data.reactionsSummary || [],
                        };
                        if (newCurrentUserReaction !== undefined) {
                          updates.currentUserReaction = newCurrentUserReaction;
                        }

                        updateMessage(roomId, messageId, updates);

                        // Remove from queue since we applied it (remove all pending updates for this message)
                        pendingReactionUpdatesRef.current.delete(messageId);
                      } else if (index === retryDelays.length - 1) {
                        // Last retry failed - keep it in queue for when message arrives
                        console.log(`⏳ [WebSocket] Message ${messageId} still not found after all retries. Update queued for when message arrives.`);
                      }
                    }, delay);
                  });

                  // Don't break - continue to try immediate update as well
                } else {
                  console.log(`✅ [WebSocket] Found message ${messageId}, updating reactions. Current reactionsSummary:`, existingMessage.reactionsSummary);
                }

                // Determine if this reaction is from the current user
                const isCurrentUserReaction = msg.data.reaction?.userId === user?.id;

                // Calculate currentUserReaction:
                // - If this reaction is from current user, use it
                // - Otherwise, preserve existing currentUserReaction OR calculate from reactions array if available
                let newCurrentUserReaction: string | null | undefined;
                if (isCurrentUserReaction) {
                  newCurrentUserReaction = msg.data.reaction?.emoji || null;
                  console.log(`👤 [WebSocket] This is current user's reaction, setting to: ${newCurrentUserReaction}`);
                } else if (existingMessage) {
                  // Preserve existing if available, otherwise try to calculate from reactions array
                  if (existingMessage.currentUserReaction !== undefined) {
                    newCurrentUserReaction = existingMessage.currentUserReaction;
                    console.log(`👤 [WebSocket] Preserving existing currentUserReaction: ${newCurrentUserReaction}`);
                  } else if (existingMessage.reactions) {
                    // Fallback: calculate from reactions array
                    const userReaction = existingMessage.reactions.find((r: any) => r.userId === user?.id);
                    newCurrentUserReaction = userReaction?.emoji || null;
                    console.log(`👤 [WebSocket] Calculated from reactions array: ${newCurrentUserReaction}`);
                  } else {
                    // Don't set it (undefined) to preserve existing value
                    newCurrentUserReaction = undefined;
                    console.log(`👤 [WebSocket] No currentUserReaction to preserve, leaving undefined`);
                  }
                } else {
                  // Message not found - don't set currentUserReaction (undefined)
                  newCurrentUserReaction = undefined;
                  console.log(`👤 [WebSocket] Message not found, leaving currentUserReaction undefined`);
                }

                // Update message with new reaction summary (only if message exists)
                if (existingMessage) {
                  const updates: any = {
                    reactionsSummary: msg.data.reactionsSummary || [],
                  };
                  if (newCurrentUserReaction !== undefined) {
                    updates.currentUserReaction = newCurrentUserReaction;
                  }

                  console.log(`🔄 [WebSocket] Updating message ${messageId} with:`, updates);
                  updateMessage(roomId, messageId, updates);

                  // Verify update
                  const { messages: updatedMessages } = useChatStore.getState();
                  const updatedRoomMessages = updatedMessages[roomId] || [];
                  const updatedMessage = updatedRoomMessages.find(m => m.id === messageId);
                  console.log(`✅ [WebSocket] Message updated. New reactionsSummary:`, updatedMessage?.reactionsSummary);
                }
              }
              break;

            case 'message.reaction.removed':
              // Reaction removed
              if (msg.data) {
                // Normalize roomId
                const reactionRoomId = msg.data.roomId?.trim() || normalizedRoomId;
                console.log(`💔 Reaction removed:`, msg.data);
                const { updateMessage, messages } = useChatStore.getState();
                const { user } = useAuthStore.getState();
                const messageId = msg.data.messageId;
                const roomId = reactionRoomId;

                // Get the existing message to preserve currentUserReaction if it's not from this event
                const roomMessages = messages[roomId] || [];
                const existingMessage = roomMessages.find(m => m.id === messageId);

                // If message not found, queue the update for when the message arrives
                if (!existingMessage) {
                  console.warn(`⚠️ [WebSocket] Message ${messageId} not found for reaction removal. Queueing update...`);

                  // Queue this reaction removal update
                  const pending = pendingReactionUpdatesRef.current.get(messageId) || [];
                  pending.push({ data: msg.data, timestamp: Date.now() });
                  pendingReactionUpdatesRef.current.set(messageId, pending);

                  // Also retry after delays
                  const retryDelays = [100, 500, 1000];
                  retryDelays.forEach((delay, index) => {
                    setTimeout(() => {
                      const { messages: retryMessages } = useChatStore.getState();
                      const retryRoomMessages = retryMessages[roomId] || [];
                      const retryExistingMessage = retryRoomMessages.find(m => m.id === messageId);

                      if (retryExistingMessage) {
                        console.log(`✅ [WebSocket] Found message ${messageId} on retry ${index + 1} for removal, updating reactions.`);
                        const isCurrentUserRemoval = msg.data.userId === user?.id;
                        const newCurrentUserReaction = isCurrentUserRemoval ? null : retryExistingMessage.currentUserReaction;

                        updateMessage(roomId, messageId, {
                          reactionsSummary: msg.data.reactionsSummary || [],
                          currentUserReaction: newCurrentUserReaction,
                        });

                        // Remove from queue
                        pendingReactionUpdatesRef.current.delete(messageId);
                      } else if (index === retryDelays.length - 1) {
                        console.log(`⏳ [WebSocket] Message ${messageId} still not found after all retries. Removal update queued.`);
                      }
                    }, delay);
                  });
                } else {
                  // If this removal is from the current user, clear their reaction
                  // Otherwise, preserve the existing currentUserReaction
                  const isCurrentUserRemoval = msg.data.userId === user?.id;
                  const newCurrentUserReaction = isCurrentUserRemoval
                    ? null
                    : existingMessage.currentUserReaction; // Preserve existing if not from current user

                  // Update message with new reaction summary
                  updateMessage(roomId, messageId, {
                    reactionsSummary: msg.data.reactionsSummary || [],
                    currentUserReaction: newCurrentUserReaction,
                  });
                }
              }
              break;

            case 'message.reply.created':
              // Reply message created - this event is now redundant since replyTo is included in message.created
              // But we keep it for backward compatibility and as a fallback
              if (msg.data) {
                // Normalize roomId
                const replyRoomId = msg.data.roomId?.trim() || normalizedRoomId;
                console.log(`↩️ Reply created (fallback update):`, {
                  messageId: msg.data.messageId,
                  roomId: msg.data.roomId,
                  roomIdNormalized: replyRoomId,
                });
                const { updateMessage, messages } = useChatStore.getState();
                const messageId = msg.data.messageId;
                const roomId = replyRoomId;

                // Only update if replyTo isn't already set (message.created should have set it)
                if (msg.data.replyTo) {
                  const roomMessages = messages[roomId] || [];
                  const existingMessage = roomMessages.find(m => m.id === messageId);

                  if (existingMessage && !existingMessage.replyTo) {
                    // Only update if replyTo is missing (fallback case)
                    console.log(`[WebSocket] Fallback: Updating message ${messageId} with replyTo data`);
                    updateMessage(roomId, messageId, {
                      replyTo: {
                        id: msg.data.replyTo.id,
                        roomId: roomId,
                        senderId: msg.data.replyTo.senderId,
                        senderName: msg.data.replyTo.senderName || undefined,
                        senderType: msg.data.replyTo.senderType || 'human',
                        content: msg.data.replyTo.content,
                        createdAt: msg.data.replyTo.createdAt || new Date().toISOString(),
                        // Exclude attachments - not needed for preview card
                      },
                      replyToMessageId: msg.data.replyToMessageId,
                    });
                  }
                }
              }
              break;

            case 'error':
              console.error('❌ WebSocket error:', msg.payload?.message);
              setConnectionError(msg.payload?.message || 'Unknown error');
              break;

            default:
              console.log('Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed', event.code, event.reason);
        setIsConnected(false);

        // Clean up heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnect if not a normal closure
        if (event.code !== 1000 && normalizedRoomId) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );

          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to connect');
      setIsConnected(false);
    }
  }, [token, roomId, addMessage, setRoomMembers, removeRoom, wsUrl]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((content: string, tempId?: string, replyToMessageId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }

    if (!normalizedRoomId) {
      console.error('Cannot send message: no roomId');
      return false;
    }

    try {
      // Optimistic update
      if (tempId) {
        const { messages } = useChatStore.getState();
        const roomMessages = messages[normalizedRoomId] || [];
        let replyTo: Message | undefined;

        // If this is a reply, find the original message to populate replyTo
        if (replyToMessageId) {
          replyTo = roomMessages.find(m => m.id === replyToMessageId);
        }

        const optimisticMessage: Message = {
          id: tempId,
          roomId: normalizedRoomId,
          senderId: useAuthStore.getState().user?.id || '',
          senderType: 'human',
          content,
          createdAt: new Date().toISOString(),
          tempId,
          replyToMessageId: replyToMessageId || null,
          replyTo: replyTo ? {
            id: replyTo.id,
            roomId: replyTo.roomId,
            senderId: replyTo.senderId,
            senderName: replyTo.senderName,
            senderType: replyTo.senderType,
            content: replyTo.content,
            createdAt: replyTo.createdAt,
            // Exclude attachments - not needed for preview card
          } : undefined,
        };
        addMessage(normalizedRoomId, optimisticMessage);
      }

      if (replyToMessageId) {
        // Send as reply
        wsRef.current.send(JSON.stringify({
          type: 'message.reply',
          roomId: normalizedRoomId,
          content,
          replyToMessageId,
          tempId,
        }));
      } else {
        // Send as normal message
        wsRef.current.send(JSON.stringify({
          type: 'message.send',
          roomId: normalizedRoomId,
          content,
          tempId,
          replyToMessageId, // Include even if null for consistency
        }));
      }

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [normalizedRoomId, addMessage]);

  const sendReaction = useCallback((messageId: string, emoji: string | null) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send reaction: WebSocket not connected');
      return false;
    }

    if (!roomId) {
      console.error('Cannot send reaction: no roomId');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'message.reaction',
        roomId,
        messageId,
        emoji: emoji || '',
        action: emoji ? 'add' : 'remove',
      }));

      return true;
    } catch (error) {
      console.error('Error sending reaction:', error);
      return false;
    }
  }, [roomId]);

  const joinRoom = useCallback((targetRoomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot join room: WebSocket not connected');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
      }));
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
  }, []);

  return {
    sendMessage,
    sendReaction,
    joinRoom,
    isConnected,
    connectionError,
  };
};

