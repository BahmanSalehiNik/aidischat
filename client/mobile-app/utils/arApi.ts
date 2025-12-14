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
    const response = await api.post('/rooms', {
      type: 'ar',
      agentId,
    });
    return response.data;
  },

  // Get AR room by ID
  getARRoom: async (roomId: string): Promise<ARRoom> => {
    const api = getApiClient();
    const response = await api.get(`/rooms/${roomId}`);
    return response.data;
  },

  // Send AR message
  sendARMessage: async (roomId: string, content: string): Promise<ARMessage> => {
    const api = getApiClient();
    const response = await api.post(`/ar-rooms/${roomId}/messages`, {
      content,
    });
    return response.data;
  },

  // Get AR message history
  getARMessages: async (roomId: string): Promise<ARMessage[]> => {
    const api = getApiClient();
    const response = await api.get(`/ar-rooms/${roomId}/messages`);
    return response.data;
  },

  // Get provider tokens for TTS/animation
  getProviderTokens: async (roomId: string): Promise<ProviderTokens> => {
    const api = getApiClient();
    const response = await api.get(`/ar-rooms/${roomId}/provider-tokens`);
    return response.data;
  },
};

