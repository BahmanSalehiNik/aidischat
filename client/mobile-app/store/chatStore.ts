import { create } from 'zustand';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  senderName?: string; // Denormalized sender name (stored in database)
  content: string;
  createdAt: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  replyToMessageId?: string | null; // Reference to original message (for replies)
  reactions?: Array<{ userId: string; emoji: string; createdAt: string }>; // Embedded reactions
  reactionsSummary?: Array<{ emoji: string; count: number }>; // Aggregated summary
  currentUserReaction?: string | null; // Current user's reaction emoji
  tempId?: string; // For optimistic updates
  sender?: {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
  replyTo?: Message; // Populated original message (for display)
}

export interface Room {
  id: string;
  name?: string;
  type: 'dm' | 'group' | 'stage' | 'ai-sim';
  createdBy: string;
  createdAt: string;
  visibility?: 'private' | 'public' | 'invite';
  role?: 'member' | 'moderator' | 'owner';
  joinedAt?: string;
}

interface ChatState {
  messages: Record<string, Message[]>; // roomId -> messages
  rooms: Room[];
  currentRoomId: string | null;
  roomMembers: Record<string, string[]>; // roomId -> memberIds
  
  // Message actions
  addMessage: (roomId: string, message: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => void;
  
  // Room actions
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  setRoomMembers: (roomId: string, members: string[]) => void;
  
  // Clear actions
  clearRoomMessages: (roomId: string) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  rooms: [],
  currentRoomId: null,
  roomMembers: {},

  addMessage: (roomId: string, message: Message) => {
    set((state) => {
      // Normalize roomIds to ensure consistency
      const normalizedRoomId = roomId?.trim();
      const normalizedMessageRoomId = message.roomId?.trim() || normalizedRoomId;
      
      // Log if there's a mismatch
      if (normalizedMessageRoomId !== normalizedRoomId) {
        console.warn(`[ChatStore] ⚠️ addMessage: roomId mismatch - param: "${normalizedRoomId}", message.roomId: "${normalizedMessageRoomId}"`);
      }
      
      // Use the normalized roomId from the message if available, otherwise use the param
      const targetRoomId = normalizedMessageRoomId || normalizedRoomId;
      
      // Ensure message.roomId matches targetRoomId
      const normalizedMessage = {
        ...message,
        roomId: targetRoomId,
      };
      
      const existingMessages = state.messages[targetRoomId] || [];
      let updatedMessages = existingMessages;
      let shouldUpdateRoomMembers = false;
      
      // If this is a real message (has real id, no tempId), check if it should replace an optimistic message FIRST
      // This must happen BEFORE the duplicate check to ensure optimistic messages are replaced
      // Match by: same content, same sender, same replyToMessageId (if reply), within 5 seconds, and existing message has tempId
      if (!normalizedMessage.tempId && normalizedMessage.id && !normalizedMessage.id.startsWith('temp-')) {
        const messageTime = new Date(normalizedMessage.createdAt).getTime();
        const optimisticIndex = existingMessages.findIndex((m) => {
          if (!m.tempId) return false; // Only replace optimistic messages
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
          const contentMatch = m.content === normalizedMessage.content;
          const senderMatch = m.senderId === normalizedMessage.senderId;
          const replyMatch = (m.replyToMessageId || null) === (normalizedMessage.replyToMessageId || null);
          const shouldMatch = (
            contentMatch &&
            senderMatch &&
            replyMatch && // Also match by replyToMessageId for replies
            timeDiff < 5000 // Within 5 seconds
          );
          
          if (shouldMatch) {
            console.log(`[ChatStore] Matching optimistic message ${m.tempId} with real message ${normalizedMessage.id}`, {
              contentMatch,
              senderMatch,
              replyMatch,
              timeDiff,
            });
          }
          
          return shouldMatch;
        });
        
        if (optimisticIndex !== -1) {
          // Replace the optimistic message with the real one, preserving replyTo if it was set
          const optimisticMsg = existingMessages[optimisticIndex];
          console.log(`[ChatStore] Replacing optimistic message ${optimisticMsg.tempId} with real message ${normalizedMessage.id}`);
          updatedMessages = [...existingMessages];
          updatedMessages[optimisticIndex] = {
            ...normalizedMessage,
            // Preserve replyTo from optimistic message if real message doesn't have it yet
            replyTo: normalizedMessage.replyTo || optimisticMsg.replyTo,
            // Preserve reactions from optimistic message if real message doesn't have them yet
            reactionsSummary: normalizedMessage.reactionsSummary || optimisticMsg.reactionsSummary,
            currentUserReaction: normalizedMessage.currentUserReaction !== undefined ? normalizedMessage.currentUserReaction : optimisticMsg.currentUserReaction,
          };
          updatedMessages = updatedMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          shouldUpdateRoomMembers = true; // New message arrived, might have new sender
        } else {
          // Log why matching failed for debugging
          if (normalizedMessage.replyToMessageId) {
            const optimisticReplies = existingMessages.filter(m => 
              m.tempId && 
              (m.replyToMessageId || null) === (normalizedMessage.replyToMessageId || null) &&
              m.senderId === normalizedMessage.senderId
            );
            if (optimisticReplies.length > 0) {
              console.warn(`[ChatStore] Failed to match optimistic reply message. Real message:`, {
                id: normalizedMessage.id,
                content: normalizedMessage.content ? normalizedMessage.content.substring(0, 50) : '(empty)',
                senderId: normalizedMessage.senderId,
                replyToMessageId: normalizedMessage.replyToMessageId,
                createdAt: normalizedMessage.createdAt,
              });
              optimisticReplies.forEach(m => {
                const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
                const contentMatch = m.content === normalizedMessage.content;
                console.warn(`[ChatStore] Optimistic message ${m.tempId}:`, {
                  content: m.content ? m.content.substring(0, 50) : '(empty)',
                  contentMatch,
                  senderMatch: m.senderId === normalizedMessage.senderId,
                  replyMatch: (m.replyToMessageId || null) === (normalizedMessage.replyToMessageId || null),
                  timeDiff,
                  withinWindow: timeDiff < 5000,
                });
              });
            }
          }
        }
      }
      
      // Also check for duplicate replies: same content, same sender, same replyToMessageId, within 5 seconds
      // This prevents duplicate replies when optimistic message matching fails
      // Check this AFTER optimistic message matching to catch any that slipped through
      if (normalizedMessage.replyToMessageId) {
        const messageTime = new Date(normalizedMessage.createdAt).getTime();
        const duplicateReply = existingMessages.find((m) => {
          // Skip if it's the same message (already checked above)
          if (m.id === normalizedMessage.id || (normalizedMessage.tempId && m.tempId === normalizedMessage.tempId)) return false;
          // Skip optimistic messages (they should have been matched above)
          if (m.tempId && !normalizedMessage.tempId) return false;
          
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
          const isDuplicate = (
            m.content === normalizedMessage.content &&
            m.senderId === normalizedMessage.senderId &&
            (m.replyToMessageId || null) === (normalizedMessage.replyToMessageId || null) &&
            timeDiff < 5000 // Within 5 seconds (same as optimistic matching window)
          );
          
          if (isDuplicate) {
            console.warn(`[ChatStore] Found duplicate reply:`, {
              existing: { id: m.id || m.tempId, content: m.content ? m.content.substring(0, 30) : '(empty)', replyTo: m.replyToMessageId },
              new: { id: normalizedMessage.id || normalizedMessage.tempId, content: normalizedMessage.content ? normalizedMessage.content.substring(0, 30) : '(empty)', replyTo: normalizedMessage.replyToMessageId },
              timeDiff,
            });
          }
          
          return isDuplicate;
        });
        
        if (duplicateReply) {
          console.log(`[ChatStore] Preventing duplicate reply message: ${normalizedMessage.id || normalizedMessage.tempId} (duplicate of ${duplicateReply.id || duplicateReply.tempId})`);
          return state;
        }
      }
      
      // Add new message (if not already replaced above)
      if (updatedMessages === existingMessages) {
        console.log(`[ChatStore] Adding new message: ${normalizedMessage.id || normalizedMessage.tempId}`, {
          content: normalizedMessage.content ? normalizedMessage.content.substring(0, 30) : '(empty)',
          replyToMessageId: normalizedMessage.replyToMessageId,
          roomId: normalizedMessage.roomId,
          targetRoomId,
        });
        updatedMessages = [...existingMessages, normalizedMessage].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        shouldUpdateRoomMembers = true; // New message arrived, might have new sender
      }
      
      // Update roomMembers if this is a new message with a sender we haven't seen
      let newRoomMembers = state.roomMembers;
      if (shouldUpdateRoomMembers && normalizedMessage.senderId && targetRoomId) {
        const currentMembers = state.roomMembers[targetRoomId] || [];
        if (!currentMembers.includes(normalizedMessage.senderId)) {
          console.log(`[ChatStore] Adding new sender ${normalizedMessage.senderId} to roomMembers for room ${targetRoomId}`);
          newRoomMembers = {
            ...state.roomMembers,
            [targetRoomId]: [...currentMembers, normalizedMessage.senderId],
          };
        }
      }
      
      // CRITICAL: Always create new object references to ensure Zustand detects the change
      console.log(`[ChatStore] addMessage: Adding message ${normalizedMessage.id || normalizedMessage.tempId} to roomId: "${targetRoomId}"`);
      return {
        messages: {
          ...state.messages,
          [targetRoomId]: updatedMessages, // New array reference
        },
        roomMembers: newRoomMembers, // Updated roomMembers if needed
      };
    });
  },

  setMessages: (roomId: string, messages: Message[]) => {
    set((state) => {
      // Normalize roomId (trim whitespace, ensure consistent format)
      const normalizedRoomId = roomId?.trim();
      
      // Check if messages have different roomIds and log warnings
      const mismatchedMessages = messages.filter(m => m.roomId && m.roomId !== normalizedRoomId);
      if (mismatchedMessages.length > 0) {
        console.warn(`[ChatStore] ⚠️ setMessages: Found ${mismatchedMessages.length} messages with different roomId:`, {
          targetRoomId: normalizedRoomId,
          mismatchedRoomIds: [...new Set(mismatchedMessages.map(m => m.roomId))],
          sampleMessage: mismatchedMessages[0],
        });
      }
      
      // Normalize all message roomIds to match the target roomId
      const normalizedMessages = messages.map(m => ({
        ...m,
        roomId: normalizedRoomId, // Ensure all messages use the same roomId
      }));
      
      console.log(`[ChatStore] setMessages: Setting ${normalizedMessages.length} messages for roomId: "${normalizedRoomId}"`);
      
      return {
        messages: {
          ...state.messages,
          [normalizedRoomId]: normalizedMessages.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        },
      };
    });
  },

  updateMessage: (roomId: string, messageId: string, updates: Partial<Message>) => {
    set((state) => {
      const roomMessages = state.messages[roomId] || [];
      let found = false;
      const updated = roomMessages.map((msg) => {
        // Match by id or tempId
        if (msg.id === messageId || msg.tempId === messageId) {
          found = true;
          // Filter out undefined values to avoid overwriting with undefined
          const cleanUpdates = Object.fromEntries(
            Object.entries(updates).filter(([_, v]) => v !== undefined)
          );
          // CRITICAL: Create a completely new object reference, not just spread
          // This ensures FlashList detects the change via object identity
          // Create new array reference for reactionsSummary to ensure FlashList detects the change
          const newReactionsSummary = cleanUpdates.reactionsSummary !== undefined 
            ? (Array.isArray(cleanUpdates.reactionsSummary) ? [...cleanUpdates.reactionsSummary] : cleanUpdates.reactionsSummary)
            : (msg.reactionsSummary && Array.isArray(msg.reactionsSummary) ? [...msg.reactionsSummary] : msg.reactionsSummary);
          
          const updatedMsg: Message = {
            ...msg,
            ...cleanUpdates,
            reactionsSummary: newReactionsSummary as Array<{ emoji: string; count: number }> | undefined,
          };
          console.log(`[ChatStore] Updated message ${messageId}:`, {
            before: { reactionsSummary: msg.reactionsSummary, currentUserReaction: msg.currentUserReaction },
            after: { reactionsSummary: updatedMsg.reactionsSummary, currentUserReaction: updatedMsg.currentUserReaction },
            sameReference: msg === updatedMsg, // Should be false
          });
          return updatedMsg;
        }
        return msg;
      });
      
      if (!found) {
        console.warn(`[ChatStore] Message ${messageId} not found in room ${roomId} for update. Available message IDs:`, roomMessages.map(m => m.id || m.tempId).slice(0, 5));
        // Return state unchanged if message not found
        return state;
      }
      
      // CRITICAL: Create new references at every level to ensure Zustand and React detect the change
      // 1. New object reference for the updated message (already done in map above)
      // 2. New array reference for the room's messages array
      // 3. New object reference for the messages object
      // This ensures FlashList and React components re-render when reactions change
      // Note: We only create new references for the updated message, not all messages,
      // to avoid unnecessary re-renders. FlashList will detect the change via extraData.
      const newRoomMessages = [...updated]; // New array reference (updated message already has new object reference)
      const newMessages = {
        ...state.messages,
        [roomId]: newRoomMessages, // New object reference for this room
      };
      
      console.log(`[ChatStore] Creating new references for room ${roomId}, message ${messageId}`, {
        oldArrayLength: roomMessages.length,
        newArrayLength: newRoomMessages.length,
        updatedMessageIndex: updated.findIndex(m => m.id === messageId || m.tempId === messageId),
        reactionsSummary: updated.find(m => m.id === messageId || m.tempId === messageId)?.reactionsSummary,
      });
      
      return {
        messages: newMessages, // New messages object reference
      };
    });
  },

  setRooms: (rooms: Room[]) => {
    set({ rooms });
  },

  addRoom: (room: Room) => {
    set((state) => ({
      rooms: [...state.rooms.filter((r) => r.id !== room.id), room],
    }));
  },

  removeRoom: (roomId: string) => {
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([id]) => id !== roomId)
      ),
    }));
  },

  setCurrentRoom: (roomId: string | null) => {
    set({ currentRoomId: roomId });
  },

  setRoomMembers: (roomId: string, members: string[]) => {
    set((state) => ({
      roomMembers: {
        ...state.roomMembers,
        [roomId]: members,
      },
    }));
  },

  clearRoomMessages: (roomId: string) => {
    set((state) => {
      const { [roomId]: _, ...rest } = state.messages;
      return { messages: rest };
    });
  },

  clear: () => {
    set({ messages: {}, rooms: [], currentRoomId: null, roomMembers: {} });
  },
}));

