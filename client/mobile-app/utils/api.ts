import { API_BASE_URL } from '@env';
import { useAuthStore } from '../store/authStore';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const API_PATH_REGEX = /\/api(\/|$)/i;

const normalizeBaseUrl = (baseUrl?: string | null) => {
  if (!baseUrl) {
    return '';
  }

  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return '';
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (API_PATH_REGEX.test(withoutTrailingSlash)) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
};

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
        
        // Handle 401 Unauthorized - might indicate token issue
        if (response.status === 401) {
          const { token } = useAuthStore.getState();
          console.error(`🔐 Auth Error Details:`, {
            hasToken: !!token,
            tokenLength: token?.length,
            tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
            endpoint,
          });
        }
        
        // Handle validation errors (400 status with errors array)
        if (response.status === 400 && data.errors && Array.isArray(data.errors)) {
          const validationMessages = data.errors
            .map((e: any) => e.field ? `${e.field}: ${e.message}` : e.message)
            .join('; ');
          const error: ApiError = {
            message: `Validation error: ${validationMessages}`,
            errors: data.errors,
          };
          throw error;
        }
        
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

  const normalizedEnvBase = normalizeBaseUrl(API_BASE_URL);
  const fallbackBase = normalizeBaseUrl(DEFAULT_BASE_URL);
  const currentBaseUrl = normalizedEnvBase || fallbackBase;

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

// Media API
export const mediaApi = {
  // Get upload URL from media service
  getUploadUrl: async (container: string, contentType: string, filename?: string) => {
    const api = getApiClient();
    return api.post<{ uploadUrl: string; provider: string; container: string; key: string }>('/media/upload/', {
      container,
      contentType,
      filename,
    });
  },

  // Upload file directly to storage using signed URL
  uploadFile: async (uploadUrl: string, fileUri: string, contentType: string, provider?: string): Promise<void> => {
    // In React Native, we need to read the file and send it as binary data
    const response = await fetch(fileUri);
    const blob = await response.blob();
    
    // Build headers based on provider
    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };
    
    // Add provider-specific headers if needed
    if (provider === 'azure' || uploadUrl.includes('blob.core.windows.net')) {
      headers['x-ms-blob-type'] = 'BlockBlob';
    }
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: blob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }
  },

  // Register uploaded media with media service
  createMedia: async (data: {
    provider: string;
    bucket: string;
    key: string;
    url: string;
    type: 'image' | 'video';
    size: number;
  }) => {
    const api = getApiClient();
    return api.post<{ id: string }>('/media/', data);
  },
};

// Post API
export const postApi = {
  createPost: async (data: { content: string; mediaIds?: string[]; visibility?: 'public' | 'friends' | 'private' }) => {
    const api = getApiClient();
    return api.post('/post', data);
  },

  getPost: async (postId: string) => {
    const api = getApiClient();
    return api.get(`/posts/${postId}`);
  },

  getUserPosts: async (userId?: string) => {
    const api = getApiClient();
    try {
      // Use the new posts endpoint with userId filter
      const endpoint = userId ? `/posts?userId=${userId}` : '/posts';
      const posts = await api.get<any[]>(endpoint);
      
      // Transform to Post format
      return (Array.isArray(posts) ? posts : []).map((post: any) => ({
        id: post.id || post._id,
        userId: post.userId || '',
        content: post.content || '',
        mediaIds: post.mediaIds || [],
        media: post.media || [],
        visibility: post.visibility || 'public',
        createdAt: post.createdAt || new Date().toISOString(),
        reactions: post.reactions || [],
        commentsCount: 0, // Will be populated if available
        author: post.author || {
          userId: post.userId || '',
          name: undefined,
          avatarUrl: undefined,
        },
      }));
    } catch (error: any) {
      console.warn('Failed to fetch user posts:', error?.message);
      return [];
    }
  },

  getFeed: async () => {
    const api = getApiClient();
    const response = await api.get<{ items: any[]; nextCursor: string | null }>('/feeds');
    // Transform feed items to Post format
    return (response.items || []).map((item: any) => ({
      id: item.postId || item.feedId,
      userId: item.author?.userId || '',
      content: item.content || '',
      mediaIds: item.media?.map((m: any) => (typeof m === 'string' ? m : m.id || m.url)) || [],
      media: item.media || [],
      visibility: item.visibility || 'public',
      createdAt: item.createdAt || new Date().toISOString(),
      reactions: item.reactionsSummary?.map((r: any) => ({ type: r.type, count: r.count })) || [],
      commentsCount: item.commentsCount || 0,
      author: item.author || null,
    }));
  },

  updatePost: async (postId: string, data: { content?: string; visibility?: 'public' | 'friends' | 'private'; mediaIds?: string[] }) => {
    const api = getApiClient();
    return api.put(`/posts/${postId}`, data);
  },

  deletePost: async (postId: string) => {
    const api = getApiClient();
    return api.delete(`/posts/${postId}`);
  },
};

// Search API
export interface SearchResult {
  id: string;
  type: 'users' | 'posts' | 'agents' | 'pages';
  title: string;
  subtitle?: string;
  snippet?: string;
  avatarUrl?: string;
  score?: number;
}

export interface SearchResponse {
  query: string;
  types?: string[];
  results: SearchResult[];
}

export interface AutocompleteResponse {
  users?: SearchResult[];
  posts?: SearchResult[];
  agents?: SearchResult[];
  pages?: SearchResult[];
}

export const searchApi = {
  search: async (query: string, types?: string[]): Promise<SearchResponse> => {
    const api = getApiClient();
    const typesParam = types && types.length > 0 ? types.join(',') : undefined;
    const url = typesParam 
      ? `/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(typesParam)}`
      : `/search?q=${encodeURIComponent(query)}`;
    return api.get<SearchResponse>(url);
  },

  autocomplete: async (
    query: string,
    limit: number = 5,
    types: string[] = ['users', 'posts', 'agents', 'pages']
  ): Promise<AutocompleteResponse> => {
    const api = getApiClient();
    const typesParam = types.join(',');
    return api.get<AutocompleteResponse>(
      `/search/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}&types=${encodeURIComponent(typesParam)}`
    );
  },
};

// Debug API
export const debugApi = {
  checkParticipant: async (roomId: string, participantId: string) => {
    const api = getApiClient();
    return api.get(`/debug/rooms/${roomId}/participants/${participantId}`);
  },
};

