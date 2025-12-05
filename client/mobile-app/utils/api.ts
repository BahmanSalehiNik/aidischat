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
    // DEBUG: Extract and log roomId from URL if present
    const roomIdMatch = endpoint.match(/\/rooms\/([^\/]+)/);
    if (roomIdMatch) {
      console.log(`📋 [CLIENT DEBUG] roomId in request: "${roomIdMatch[1]}"`);
    }
    
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
        // Don't log 404 errors for agent lookups - they're expected when checking if an ID is an agent
        const isAgentLookup = url.includes('/api/agents/') && response.status === 404;
        if (!isAgentLookup) {
          console.error(`❌ API Error:`, data);
        }
        
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
      // Don't log 404 errors for agent lookups - they're expected when checking if an ID is an agent
      // Also don't log 404 errors for room lookups - rooms might be deleted
      const isAgentLookup = url.includes('/api/agents/') && 
                           (error?.message?.includes('404') || error?.message?.includes('not found'));
      const isRoomLookup = url.includes('/api/rooms/') && 
                          (error?.message?.includes('404') || error?.message?.includes('Room not found'));
      
      if (!isAgentLookup && !isRoomLookup) {
        console.error(`❌ Network Error for ${url}:`, error);
        console.error(`❌ Error Details:`, {
          message: error?.message,
          name: error?.name,
          code: error?.code,
          errno: error?.errno,
          stack: error?.stack,
        });
      }
      
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

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
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

  addParticipant: async (
    roomId: string,
    data: { participantId: string; participantType: 'human' | 'agent'; role?: string }
  ) => {
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

// Chat History API
export interface ChatSession {
  id: string;
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  startTime: string;
  endTime?: string;
  lastActivityTime: string;
  firstMessageId: string;
  lastMessageId: string;
  messageCount: number;
  title?: string;
}

export interface SessionListResponse {
  sessions: ChatSession[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SessionMessagesResponse {
  messageIds: string[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export const chatHistoryApi = {
  // Get user's chat sessions
  getUserSessions: async (options?: {
    roomId?: string;
    participantType?: 'human' | 'agent';
    limit?: number;
    offset?: number;
    includeActive?: boolean;
  }): Promise<SessionListResponse> => {
    const api = getApiClient();
    const params = new URLSearchParams();
    if (options?.roomId) params.append('roomId', options.roomId);
    if (options?.participantType) params.append('participantType', options.participantType);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.includeActive !== undefined) params.append('includeActive', options.includeActive.toString());
    
    const query = params.toString();
    return api.get(`/sessions${query ? `?${query}` : ''}`);
  },

  // Get agent's chat sessions
  getAgentSessions: async (agentId: string, options?: {
    roomId?: string;
    limit?: number;
    offset?: number;
    includeActive?: boolean;
  }): Promise<SessionListResponse> => {
    const api = getApiClient();
    const params = new URLSearchParams();
    if (options?.roomId) params.append('roomId', options.roomId);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.includeActive !== undefined) params.append('includeActive', options.includeActive.toString());
    
    const query = params.toString();
    return api.get(`/agents/${agentId}/sessions${query ? `?${query}` : ''}`);
  },

  // Get all sessions in a room (regardless of participant)
  // This allows agents to see all messages in a room, including from other agents
  getRoomSessions: async (roomId: string, options?: {
    limit?: number;
    offset?: number;
    includeActive?: boolean;
  }): Promise<SessionListResponse> => {
    const api = getApiClient();
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.includeActive !== undefined) params.append('includeActive', options.includeActive.toString());
    
    const query = params.toString();
    return api.get(`/rooms/${roomId}/sessions${query ? `?${query}` : ''}`);
  },

  // Get a specific session by ID
  getSession: async (sessionId: string): Promise<{ session: ChatSession }> => {
    const api = getApiClient();
    return api.get(`/sessions/${sessionId}`);
  },

  // Get messages for a session
  getSessionMessages: async (sessionId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<SessionMessagesResponse> => {
    const api = getApiClient();
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    
    const query = params.toString();
    return api.get(`/sessions/${sessionId}/messages${query ? `?${query}` : ''}`);
  },

  // Find session by message ID
  getSessionByMessage: async (messageId: string): Promise<{ session: ChatSession }> => {
    const api = getApiClient();
    return api.get(`/sessions/by-message/${messageId}`);
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
    const post = await api.get<any>(`/posts/${postId}`);
    // Transform to Post format
    return {
      id: post.id || post._id,
      userId: post.userId || '',
      content: post.content || '',
      mediaIds: post.mediaIds || [],
      media: post.media || [],
      visibility: post.visibility || 'public',
      createdAt: post.createdAt || new Date().toISOString(),
      reactions: post.reactions || [],
      reactionsSummary: post.reactionsSummary,
      currentUserReaction: post.currentUserReaction,
      commentsCount: post.commentsCount || 0,
      author: post.author || {
        userId: post.userId || '',
        name: undefined,
        email: undefined,
        avatarUrl: undefined,
      },
    };
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
        reactionsSummary: post.reactionsSummary,
        currentUserReaction: post.currentUserReaction,
        commentsCount: post.commentsCount || 0,
        author: post.author || {
          userId: post.userId || '',
          name: undefined,
          email: undefined,
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
      reactions: [], // Feed doesn't return individual reactions
      reactionsSummary: item.reactionsSummary || [],
      currentUserReaction: item.currentUserReaction,
      commentsCount: item.commentsCount || 0,
      // Preserve author object from backend, it already has name, email, etc.
      author: item.author ? {
        userId: item.author.userId || '',
        name: item.author.name,
        email: item.author.email,
        avatarUrl: item.author.avatarUrl,
      } : {
        userId: '',
        name: undefined,
        email: undefined,
        avatarUrl: undefined,
      },
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

// Comment API
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  author?: {
    userId: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
  reactions?: { type: string; count: number }[];
  currentUserReaction?: { userId: string; type: string };
}

export interface CommentsResponse {
  comments: Comment[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export const commentApi = {
  getComments: async (postId: string, page: number = 1, limit: number = 10, parentCommentId?: string): Promise<CommentsResponse> => {
    const api = getApiClient();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (parentCommentId) {
      params.append('parentCommentId', parentCommentId);
    }
    return api.get<CommentsResponse>(`/posts/${postId}/comments?${params.toString()}`);
  },

  createComment: async (postId: string, text: string, parentCommentId?: string): Promise<Comment> => {
    const api = getApiClient();
    return api.post<Comment>(`/posts/${postId}/comments`, {
      text,
      parentCommentId,
    });
  },

  updateComment: async (postId: string, commentId: string, text: string): Promise<Comment> => {
    const api = getApiClient();
    return api.patch<Comment>(`/posts/${postId}/comments/${commentId}`, { text });
  },

  deleteComment: async (postId: string, commentId: string): Promise<void> => {
    const api = getApiClient();
    return api.delete<void>(`/posts/${postId}/comments/${commentId}`);
  },
};

// Reaction API
export type ReactionType = 'like' | 'love' | 'haha' | 'sad' | 'angry';

export interface Reaction {
  id: string;
  userId: string;
  postId?: string;
  commentId?: string;
  type: ReactionType;
  createdAt: string;
}

export const reactionApi = {
  addPostReaction: async (postId: string, type: ReactionType): Promise<Reaction> => {
    const api = getApiClient();
    return api.post<Reaction>(`/posts/${postId}/reactions`, { type });
  },

  removePostReaction: async (postId: string): Promise<void> => {
    const api = getApiClient();
    return api.delete<void>(`/posts/${postId}/reactions`);
  },

  addCommentReaction: async (commentId: string, type: ReactionType): Promise<Reaction> => {
    const api = getApiClient();
    return api.post<Reaction>(`/comments/${commentId}/reactions`, { type });
  },

  removeCommentReaction: async (commentId: string): Promise<void> => {
    const api = getApiClient();
    return api.delete<void>(`/comments/${commentId}/reactions`);
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

// Friend Suggestions API
export interface FriendSuggestion {
  userId: string;
  reason: 'popular' | 'new' | 'mutual';
  mutualCount?: number;
  username?: string;
  fullName?: string;
  profilePicture?: string;
  profileId?: string; // Profile ID if available from backend
}

export interface FriendSuggestionsResponse {
  userId: string;
  suggestions: FriendSuggestion[];
}

export const friendSuggestionsApi = {
  getSuggestions: async (): Promise<FriendSuggestionsResponse> => {
    const api = getApiClient();
    return api.get<FriendSuggestionsResponse>('/friend-suggestions');
  },

  sendFeedback: async (suggestionId: string, action: 'accept' | 'dismiss') => {
    const api = getApiClient();
    return api.post('/friend-suggestions/feedback', {
      suggestionId,
      action,
    });
  },
};

// Friendship API
export interface FriendshipRequest {
  recipient: string;
  recipientProfile: string;
}

export const friendshipApi = {
  sendFriendRequest: async (recipient: string, recipientProfile: string) => {
    const api = getApiClient();
    return api.post<FriendshipRequest>('/friends', {
      recipient,
      recipientProfile,
    });
  },

  getFriendRequests: async () => {
    const api = getApiClient();
    return api.get('/friends');
  },

  updateFriendship: async (friendshipId: string, status: 'accepted' | 'declined' | 'blocked') => {
    const api = getApiClient();
    return api.put(`/friends/${friendshipId}`, { status });
  },
};

// Debug API
export const debugApi = {
  checkParticipant: async (roomId: string, participantId: string) => {
    const api = getApiClient();
    return api.get(`/debug/rooms/${roomId}/participants/${participantId}`);
  },
};

// Agents API
export interface AgentProfile {
  id: string;
  name: string;
  profession?: string;
  breed?: string;
  gender?: string;
  age?: number;
  displayName?: string;
  title?: string;
  avatarUrl?: string;
  [key: string]: any;
}

export interface Agent {
  id: string;
  agentProfileId: string;
  modelProvider: string;
  modelName: string;
  status: string;
  ownerUserId: string;
  [key: string]: any;
}

export interface AgentWithProfile {
  agent: Agent;
  agentProfile: AgentProfile | null;
}

export const agentsApi = {
  createProfile: async (profileData: any): Promise<AgentProfile> => {
    const api = getApiClient();
    return api.post<AgentProfile>('/agents/profiles', profileData);
  },

  createAgent: async (agentData: any): Promise<Agent> => {
    const api = getApiClient();
    return api.post<Agent>('/agents', agentData);
  },

  getAgents: async (): Promise<AgentWithProfile[]> => {
    const api = getApiClient();
    return api.get<AgentWithProfile[]>('/agents');
  },

  getAgent: async (agentId: string): Promise<Agent> => {
    const api = getApiClient();
    return api.get<Agent>(`/agents/${agentId}`);
  },

  getAgentWithProfile: async (agentId: string): Promise<{ agent: Agent; agentProfile: AgentProfile }> => {
    const api = getApiClient();
    return api.get<{ agent: Agent; agentProfile: AgentProfile }>(`/agents/${agentId}`);
  },

  updateAgent: async (agentId: string, agentData: any): Promise<Agent> => {
    const api = getApiClient();
    return api.put<Agent>(`/agents/${agentId}`, agentData);
  },

  updateProfile: async (profileId: string, profileData: any): Promise<AgentProfile> => {
    const api = getApiClient();
    return api.put<AgentProfile>(`/agents/profiles/${profileId}`, profileData);
  },

  deleteAgent: async (agentId: string): Promise<void> => {
    const api = getApiClient();
    return api.delete<void>(`/agents/${agentId}`);
  },
};

// Agent Manager API
export interface AgentDraft {
  id: string;
  draftType: 'post' | 'comment' | 'reaction';
  agentId: string;
  ownerUserId: string;
  content?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  visibility?: 'public' | 'friends' | 'private';
  postId?: string;
  commentId?: string;
  reactionType?: 'like' | 'love' | 'haha' | 'sad' | 'angry';
  mediaIds?: string[];
}

export const agentManagerApi = {
  getDrafts: async (
    agentId: string,
    options?: { type?: 'post' | 'comment' | 'reaction'; status?: 'pending' | 'approved' | 'rejected' | 'expired' }
  ): Promise<AgentDraft[]> => {
    const api = getApiClient();
    const queryParams = new URLSearchParams();
    if (options?.type) queryParams.append('type', options.type);
    if (options?.status) queryParams.append('status', options.status);
    const queryString = queryParams.toString();
    const endpoint = `/agent-manager/agents/${agentId}/drafts${queryString ? `?${queryString}` : ''}`;
    const response = await api.get<{ drafts: AgentDraft[] }>(endpoint);
    return response.drafts || [];
  },
};

