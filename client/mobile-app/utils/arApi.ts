// AR Conversations API
import { getApiClient } from './api';

export interface ARRoom {
  id: string;
  type: 'ar';
  agentId: string;
  createdBy: string;
  status: 'active' | 'paused' | 'ended';
  createdAt: string;
}

export interface ARMessage {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  content: string;
  markers: Array<{ type: 'emotion' | 'gesture' | 'pose' | 'tone'; value: string }>;
  status: 'streaming' | 'completed' | 'failed';
  createdAt: string;
}

export interface ProviderTokens {
  elevenLabsToken: string;
  azureSpeechToken: string;
  expiresIn: string;
}

export const arApi = {
  // Create or get AR room for agent
  createOrGetARRoom: async (agentId: string): Promise<ARRoom> => {
    const api = getApiClient();
    console.log('📤 Creating AR room for agentId:', agentId);
    // api.post() already returns the parsed JSON data directly, not response.data
    const roomData = await api.post<ARRoom>('/rooms', {
      type: 'ar',
      agentId,
    });
    console.log('📥 AR room API response:', roomData);
    return roomData;
  },

  // Get AR room by ID
  getARRoom: async (roomId: string): Promise<ARRoom> => {
    const api = getApiClient();
    // api.get() already returns the parsed JSON data directly
    return api.get<ARRoom>(`/rooms/${roomId}`);
  },

  // Send AR message
  sendARMessage: async (roomId: string, content: string, agentId: string): Promise<ARMessage> => {
    const api = getApiClient();
    // api.post() already returns the parsed JSON data directly
    return api.post<ARMessage>(`/ar-rooms/${roomId}/messages`, {
      content,
      agentId,
    });
  },

  // Get AR message history
  getARMessages: async (roomId: string): Promise<ARMessage[]> => {
    const api = getApiClient();
    // api.get() already returns the parsed JSON data directly
    return api.get<ARMessage[]>(`/ar-rooms/${roomId}/messages`);
  },

  // Get provider tokens for TTS/animation
  getProviderTokens: async (roomId: string): Promise<ProviderTokens> => {
    const api = getApiClient();
    // api.get() already returns the parsed JSON data directly
    return api.get<ProviderTokens>(`/ar-rooms/${roomId}/provider-tokens`);
  },
};

