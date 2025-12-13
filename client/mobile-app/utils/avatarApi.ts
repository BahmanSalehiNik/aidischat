// Avatar API client for React Native app
import { getApiClient } from './api';

export interface AvatarStatus {
  status: 'pending' | 'generating' | 'ready' | 'failed';
  progress?: number;
  error?: string;
  modelUrl?: string;
  format?: string;
  modelType?: string;
  estimatedTimeRemaining?: number;
}

export interface AvatarDownloadUrl {
  url: string;
  expiresIn: number | null;
  format: string;
  modelType: string;
}

export interface Avatar {
  agentId: string;
  ownerUserId: string;
  modelType?: string;
  format?: string;
  modelUrl?: string;
  status: string;
  generationStartedAt?: string;
  generationCompletedAt?: string;
  generationError?: string;
  provider?: string;
  characterDescription?: any;
}

export const avatarApi = {
  /**
   * Get avatar for an agent
   */
  getAvatar: async (agentId: string): Promise<Avatar | null> => {
    const api = getApiClient();
    try {
      return await api.get<Avatar>(`/avatars/${agentId}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get avatar generation status with progress
   */
  getAvatarStatus: async (agentId: string): Promise<AvatarStatus> => {
    const api = getApiClient();
    return api.get<AvatarStatus>(`/avatars/${agentId}/status`);
  },

  /**
   * Get signed download URL for avatar model
   * @param agentId Agent ID
   * @param expiresSeconds Optional expiration time in seconds (default: 900 = 15 minutes)
   */
  getDownloadUrl: async (agentId: string, expiresSeconds?: number): Promise<AvatarDownloadUrl> => {
    const api = getApiClient();
    const params = expiresSeconds ? `?expiresSeconds=${expiresSeconds}` : '';
    return api.get<AvatarDownloadUrl>(`/avatars/${agentId}/download-url${params}`);
  },

  /**
   * Start avatar generation for an agent
   * Note: This is usually triggered automatically when an agent is created
   */
  generateAvatar: async (agentId: string, agentProfile: any): Promise<{ agentId: string; status: string; message: string }> => {
    const api = getApiClient();
    return api.post<{ agentId: string; status: string; message: string }>('/avatars/generate', {
      agentId,
      agentProfile,
    });
  },
};

