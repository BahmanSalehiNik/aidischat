import Redis, { RedisOptions } from 'ioredis';

// Helper to create Redis client with error handling
function createRedisClient(url: string, name: string, options?: Partial<RedisOptions>): Redis {
  const client = new Redis(url, {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis ${name}] Retrying connection (attempt ${times})...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    ...options,
  });

  client.on('error', (err: Error) => {
    if (err.message.includes('ECONNREFUSED')) {
      console.warn(`[Redis ${name}] Connection refused (service may not be ready yet):`, err.message);
    } else {
      console.error(`[Redis ${name}] Error:`, err.message);
    }
  });

  client.on('connect', () => {
    console.log(`[Redis ${name}] Connected`);
  });

  client.on('ready', () => {
    console.log(`[Redis ${name}] Ready`);
  });

  client.on('close', () => {
    console.log(`[Redis ${name}] Connection closed`);
  });

  return client;
}

// Redis for feedback batching (shared across pods)
const redisFeedbackUrl = process.env.REDIS_FEEDBACK_URL || process.env.REDIS_URL || 'redis://redis-feedback-srv:6379';
export const redisFeedback = createRedisClient(redisFeedbackUrl, 'Feedback');

// Redis key patterns for feedback sliding window
export const RedisFeedbackKeys = {
  // Sliding window: 3 items per agentId+roomId combination (configurable via SLIDING_WINDOW_SIZE)
  window: (agentId: string, roomId?: string) => {
    const roomKey = roomId || 'global';
    return `feedback:window:${agentId}:${roomKey}`;
  },
  // Batch metadata for processing
  batchMeta: (agentId: string) => `feedback:batch:${agentId}:meta`,
  batchIndex: () => 'feedback:batches:index', // Set of all active batch agentIds
};

