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
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    console.log(`🔑 Token available: ${token ? 'Yes' : 'No'}`, token ? `${token.substring(0, 20)}...` : '');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add auth token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`✅ Added Authorization header`);
    } else {
      console.warn(`⚠️ No token available for request to ${endpoint}`);
    }

    // Handle cookie-based auth (for session-based auth)
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Include cookies
    };

    try {
      const response = await fetch(url, fetchOptions);
      console.log(`📡 API Response: ${response.status} ${response.statusText} for ${url}`);
      
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
        console.error(`❌ API Error:`, data);
        // Backend may return error in 'error' field or 'message' field
        const errorMessage = data.error || data.message || `HTTP error! status: ${response.status}`;
        const error: ApiError = {
          message: errorMessage,
          errors: data.errors,
        };
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error(`❌ Network Error for ${url}:`, error);
      console.error(`❌ Error Details:`, {
        message: error?.message,
        name: error?.name,
        code: error?.code,
        errno: error?.errno,
        stack: error?.stack,
      });
      
      if (error instanceof TypeError) {
        // Network-related errors
        if (error.message.includes('fetch') || error.message.includes('Network request failed')) {
          const errorMessage = `Network error: Unable to reach ${this.baseUrl}. Please check:
1. Your internet connection
2. The backend server is running and accessible
3. DNS can resolve ${new URL(this.baseUrl).hostname}
4. SSL certificate is valid (if using HTTPS)`;
          console.error(`❌ ${errorMessage}`);
          throw new Error(errorMessage);
        }
      }
      
      // Re-throw other errors as-is
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
let lastBaseUrl: string | null = null;

export const getApiClient = (): ApiClient => {
  // Log the raw environment variable to debug
  console.log(`📋 Raw API_BASE_URL from env:`, API_BASE_URL);
  
  const currentBaseUrl = API_BASE_URL || 'http://localhost:3000';
  
  // Reinitialize if base URL changed (e.g., .env was updated)
  if (!apiClient || lastBaseUrl !== currentBaseUrl) {
    console.log(`🔧 Initializing API Client with base URL: ${currentBaseUrl}`);
    apiClient = new ApiClient(currentBaseUrl);
    lastBaseUrl = currentBaseUrl;
  } else {
    console.log(`♻️  Using existing API Client with base URL: ${currentBaseUrl}`);
  }
  
  return apiClient;
};

// Auth API
export const authApi = {
  signIn: async (email: string, password: string) => {
    const api = getApiClient();
    // Note: Backend uses session cookies, but we need to extract token
    // For now, we'll handle it in the response
    const response = await api.post('/users/signin', { email, password });
    return response;
  },

  signUp: async (email: string, password: string) => {
    const api = getApiClient();
    const response = await api.post('/users/signup', { email, password });
    return response;
  },

  getCurrentUser: async () => {
    const api = getApiClient();
    return api.get('/users/currentuser');
  },
};

// Room API
export const roomApi = {
  createRoom: async (data: { type: string; name?: string; visibility?: string }) => {
    const api = getApiClient();
    return api.post('/rooms', data);
  },

  getRoom: async (roomId: string) => {
    const api = getApiClient();
    return api.get(`/rooms/${roomId}`);
  },

  getUserRooms: async () => {
    const api = getApiClient();
    return api.get('/users/rooms');
  },

  deleteRoom: async (roomId: string) => {
    const api = getApiClient();
    return api.delete(`/rooms/${roomId}`);
  },

  addParticipant: async (roomId: string, data: { participantId: string; participantType?: string; role?: string }) => {
    const api = getApiClient();
    return api.post(`/rooms/${roomId}/participants`, data);
  },

  joinRoom: async (roomId: string) => {
    const api = getApiClient();
    return api.post(`/rooms/${roomId}/join`);
  },
};

// Message API
export const messageApi = {
  getMessages: async (roomId: string, page: number = 1, limit: number = 50) => {
    const api = getApiClient();
    return api.get(`/rooms/${roomId}/messages?page=${page}&limit=${limit}`);
  },
};

// Debug API
export const debugApi = {
  checkParticipant: async (roomId: string, participantId: string) => {
    const api = getApiClient();
    return api.get(`/debug/rooms/${roomId}/participants/${participantId}`);
  },
};

