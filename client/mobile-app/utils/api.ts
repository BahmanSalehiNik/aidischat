import { API_BASE_URL } from '@env';
import { useAuthStore } from '../store/authStore';

export interface ApiError {
  message: string;
  errors?: Array<{ message: string; field?: string }>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { token } = useAuthStore.getState();
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add auth token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Handle cookie-based auth (for session-based auth)
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    };

    try {
      const response = await fetch(url, fetchOptions);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.text()) as T;
      }

      const data = await response.json();

      if (!response.ok) {
        const error: ApiError = {
          message: data.message || `HTTP error! status: ${response.status}`,
          errors: data.errors,
        };
        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create singleton instance
let apiClient: ApiClient | null = null;

export const getApiClient = (): ApiClient => {
  if (!apiClient) {
    const baseUrl = API_BASE_URL || 'http://localhost:3000';
    apiClient = new ApiClient(baseUrl);
  }
  return apiClient;
};

// Auth API
export const authApi = {
  signIn: async (email: string, password: string) => {
    const api = getApiClient();
    // Note: Backend uses session cookies, but we need to extract token
    // For now, we'll handle it in the response
    const response = await api.post('/api/users/signin', { email, password });
    return response;
  },

  signUp: async (email: string, password: string) => {
    const api = getApiClient();
    const response = await api.post('/api/users/signup', { email, password });
    return response;
  },

  getCurrentUser: async () => {
    const api = getApiClient();
    return api.get('/api/users/currentuser');
  },
};

// Room API
export const roomApi = {
  createRoom: async (data: { type: string; name?: string; visibility?: string }) => {
    const api = getApiClient();
    return api.post('/api/rooms', data);
  },

  getRoom: async (roomId: string) => {
    const api = getApiClient();
    return api.get(`/api/rooms/${roomId}`);
  },

  getUserRooms: async () => {
    const api = getApiClient();
    return api.get('/api/users/rooms');
  },

  deleteRoom: async (roomId: string) => {
    const api = getApiClient();
    return api.delete(`/api/rooms/${roomId}`);
  },

  addParticipant: async (roomId: string, data: { participantId: string; participantType?: string; role?: string }) => {
    const api = getApiClient();
    return api.post(`/api/rooms/${roomId}/participants`, data);
  },
};

// Message API
export const messageApi = {
  getMessages: async (roomId: string, page: number = 1, limit: number = 50) => {
    const api = getApiClient();
    return api.get(`/api/rooms/${roomId}/messages?page=${page}&limit=${limit}`);
  },
};

