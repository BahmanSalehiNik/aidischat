// Message window model for in-memory and Redis storage

export interface WindowMessage {
  id: string;
  content: string;
  senderId: string;
  senderType: 'human' | 'agent';
  createdAt: Date;
}

export interface MessageWindow {
  roomId: string;
  messages: WindowMessage[];
  lastMessageAt: Date;
  lastAnalyzedAt: Date | null;
  analysisCount: number;
}

// In-memory storage for active windows
const windowCache = new Map<string, MessageWindow>();

export class MessageWindowModel {
  /**
   * Get window from cache or Redis
   */
  static async get(roomId: string): Promise<MessageWindow | null> {
    // Check in-memory cache first
    const cached = windowCache.get(roomId);
    if (cached) {
      return cached;
    }

    // Try to load from Redis
    try {
      const { redisWrapper } = await import('../redis-client');
      const key = `window:${roomId}`;
      const data = await redisWrapper.client.get(key);
      if (data) {
        const window = JSON.parse(data);
        // Convert date strings back to Date objects
        window.lastMessageAt = new Date(window.lastMessageAt);
        window.lastAnalyzedAt = window.lastAnalyzedAt ? new Date(window.lastAnalyzedAt) : null;
        window.messages = window.messages.map((m: any) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        }));
        // Cache in memory
        windowCache.set(roomId, window);
        return window;
      }
    } catch (error) {
      console.error(`[MessageWindowModel] Error loading from Redis for room ${roomId}:`, error);
    }

    return null;
  }

  /**
   * Save window to cache and Redis
   */
  static async save(window: MessageWindow): Promise<void> {
    // Update in-memory cache
    windowCache.set(window.roomId, window);

    // Persist to Redis
    try {
      const { redisWrapper } = await import('../redis-client');
      const { REDIS_CONFIG } = await import('../config/constants');
      const key = `window:${window.roomId}`;
      const data = JSON.stringify(window);
      await redisWrapper.client.setEx(key, REDIS_CONFIG.WINDOW_TTL_SECONDS, data);
    } catch (error) {
      console.error(`[MessageWindowModel] Error saving to Redis for room ${window.roomId}:`, error);
    }
  }

  /**
   * Create a new window
   */
  static create(roomId: string): MessageWindow {
    return {
      roomId,
      messages: [],
      lastMessageAt: new Date(),
      lastAnalyzedAt: null,
      analysisCount: 0,
    };
  }

  /**
   * Clear window (remove from cache and Redis)
   */
  static async clear(roomId: string): Promise<void> {
    windowCache.delete(roomId);
    try {
      const { redisWrapper } = await import('../redis-client');
      const key = `window:${roomId}`;
      await redisWrapper.client.del(key);
    } catch (error) {
      console.error(`[MessageWindowModel] Error clearing Redis for room ${roomId}:`, error);
    }
  }
}

