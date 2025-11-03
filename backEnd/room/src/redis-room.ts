import Redis, { RedisOptions } from 'ioredis';

// Helper to create Redis client with error handling
function createRedisClient(url: string, name: string, options?: Partial<RedisOptions>): Redis {
  const client = new Redis(url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis ${name}] Retrying connection (attempt ${times})...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    ...options,
  });

  client.on('error', (err) => {
    // Only log if it's not a connection refused (service might not be ready yet)
    if (!err.message.includes('ECONNREFUSED')) {
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

const redisRoomUrl = process.env.REDIS_ROOM_URL || 'redis://redis-room-srv:6379';

// Regular Redis client for standard operations (sadd, hgetall, etc.)
export const redisRoom = createRedisClient(redisRoomUrl, 'Room');

// Publisher client for pub/sub publishing
export const redisRoomPublisher = createRedisClient(redisRoomUrl, 'RoomPublisher');

// Subscriber client for pub/sub subscribing (dedicated connection for subscriber mode)
export const redisRoomSubscriber = createRedisClient(redisRoomUrl, 'RoomSubscriber');

// Redis key patterns
export const RedisKeys = {
  roomMembers: (roomId: string) => `room:${roomId}:members`,
  userRooms: (userId: string) => `user:${userId}:room`,
  roomMeta: (roomId: string) => `room:${roomId}:meta`,
};

// Redis pub/sub channels
export const RedisChannels = {
  roomEvents: 'room.events',
};

