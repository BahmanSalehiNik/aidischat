import { create } from 'zustand';

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  content: string;
  createdAt: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  tempId?: string; // For optimistic updates
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
      
      // Check for exact duplicate by id or tempId
      const exactDuplicate = existingMessages.some(
        (m) => m.id === message.id || (message.tempId && m.tempId === message.tempId)
      );
      
      if (exactDuplicate) {
        return state;
      }
      
      // If this is a real message (has real id, no tempId), check if it should replace an optimistic message
      // Match by: same content, same sender, within 5 seconds, and existing message has tempId
      if (!message.tempId && message.id && !message.id.startsWith('temp-')) {
        const messageTime = new Date(message.createdAt).getTime();
        const optimisticIndex = existingMessages.findIndex((m) => {
          if (!m.tempId) return false; // Only replace optimistic messages
          const timeDiff = Math.abs(new Date(m.createdAt).getTime() - messageTime);
          return (
            m.content === message.content &&
            m.senderId === message.senderId &&
            timeDiff < 5000 // Within 5 seconds
          );
        });
        
        if (optimisticIndex !== -1) {
          // Replace the optimistic message with the real one
          const updated = [...existingMessages];
          updated[optimisticIndex] = message;
          return {
            messages: {
              ...state.messages,
              [roomId]: updated.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              ),
            },
          };
        }
      }
      
      // Add new message
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
      const updated = roomMessages.map((msg) =>
        msg.id === messageId || msg.tempId === messageId
          ? { ...msg, ...updates }
          : msg
      );
      return {
        messages: {
          ...state.messages,
          [roomId]: updated,
        },
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

