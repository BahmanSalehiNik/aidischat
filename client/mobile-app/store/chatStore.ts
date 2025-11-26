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
      const existingMessages = state.messages[roomId] || [];
      
      // If this is a real message (has real id, no tempId), check if it should replace an optimistic message FIRST
      // This must happen BEFORE the duplicate check to ensure optimistic messages are replaced
      // Match by: same content, same sender, same replyToMessageId (if reply), within 5 seconds, and existing message has tempId
      if (!message.tempId && message.id && !message.id.startsWith('temp-')) {
        const messageTime = new Date(message.createdAt).getTime();
        const optimisticIndex = existingMessages.findIndex((m) => {
          if (!m.tempId) return false; // Only replace optimistic messages
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
          const contentMatch = m.content === message.content;
          const senderMatch = m.senderId === message.senderId;
          const replyMatch = (m.replyToMessageId || null) === (message.replyToMessageId || null);
          const shouldMatch = (
            contentMatch &&
            senderMatch &&
            replyMatch && // Also match by replyToMessageId for replies
            timeDiff < 5000 // Within 5 seconds
          );
          
          if (shouldMatch) {
            console.log(`[ChatStore] Matching optimistic message ${m.tempId} with real message ${message.id}`, {
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
          console.log(`[ChatStore] Replacing optimistic message ${optimisticMsg.tempId} with real message ${message.id}`);
          const updated = [...existingMessages];
          updated[optimisticIndex] = {
            ...message,
            // Preserve replyTo from optimistic message if real message doesn't have it yet
            replyTo: message.replyTo || optimisticMsg.replyTo,
            // Preserve reactions from optimistic message if real message doesn't have them yet
            reactionsSummary: message.reactionsSummary || optimisticMsg.reactionsSummary,
            currentUserReaction: message.currentUserReaction !== undefined ? message.currentUserReaction : optimisticMsg.currentUserReaction,
          };
          return {
            messages: {
              ...state.messages,
              [roomId]: updated.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              ),
            },
          };
        } else {
          // Log why matching failed for debugging
          if (message.replyToMessageId) {
            const optimisticReplies = existingMessages.filter(m => 
              m.tempId && 
              (m.replyToMessageId || null) === (message.replyToMessageId || null) &&
              m.senderId === message.senderId
            );
            if (optimisticReplies.length > 0) {
              console.warn(`[ChatStore] Failed to match optimistic reply message. Real message:`, {
                id: message.id,
                content: message.content ? message.content.substring(0, 50) : '(empty)',
                senderId: message.senderId,
                replyToMessageId: message.replyToMessageId,
                createdAt: message.createdAt,
              });
              optimisticReplies.forEach(m => {
                const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
                const contentMatch = m.content === message.content;
                console.warn(`[ChatStore] Optimistic message ${m.tempId}:`, {
                  content: m.content ? m.content.substring(0, 50) : '(empty)',
                  contentMatch,
                  senderMatch: m.senderId === message.senderId,
                  replyMatch: (m.replyToMessageId || null) === (message.replyToMessageId || null),
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
      if (message.replyToMessageId) {
        const messageTime = new Date(message.createdAt).getTime();
        const duplicateReply = existingMessages.find((m) => {
          // Skip if it's the same message (already checked above)
          if (m.id === message.id || (message.tempId && m.tempId === message.tempId)) return false;
          // Skip optimistic messages (they should have been matched above)
          if (m.tempId && !message.tempId) return false;
          
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
          const isDuplicate = (
            m.content === message.content &&
            m.senderId === message.senderId &&
            (m.replyToMessageId || null) === (message.replyToMessageId || null) &&
            timeDiff < 5000 // Within 5 seconds (same as optimistic matching window)
          );
          
          if (isDuplicate) {
            console.warn(`[ChatStore] Found duplicate reply:`, {
              existing: { id: m.id || m.tempId, content: m.content ? m.content.substring(0, 30) : '(empty)', replyTo: m.replyToMessageId },
              new: { id: message.id || message.tempId, content: message.content ? message.content.substring(0, 30) : '(empty)', replyTo: message.replyToMessageId },
              timeDiff,
            });
          }
          
          return isDuplicate;
        });
        
        if (duplicateReply) {
          console.log(`[ChatStore] Preventing duplicate reply message: ${message.id || message.tempId} (duplicate of ${duplicateReply.id || duplicateReply.tempId})`);
          return state;
        }
      }
      
      // Add new message
      console.log(`[ChatStore] Adding new message: ${message.id || message.tempId}`, {
        content: message.content ? message.content.substring(0, 30) : '(empty)',
        replyToMessageId: message.replyToMessageId,
      });
      return {
        messages: {
          ...state.messages,
          [roomId]: [...existingMessages, message].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        },
      };
    });
  },

  setMessages: (roomId: string, messages: Message[]) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: messages.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
      },
    }));
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

