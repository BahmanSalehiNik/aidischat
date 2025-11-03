import Redis from 'ioredis';

// Helper to create Redis client with error handling
function createRedisClient(url: string, name: string): Redis {
  const client = new Redis(url, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis ${name}] Retrying connection (attempt ${times})...`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
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

// Redis for message pub/sub (cross-pod WebSocket message delivery)
const redisUrl = process.env.REDIS_URL || 'redis://realtime-redis-srv:6379';
export const redisPublisher = createRedisClient(redisUrl, 'Publisher');
export const redisSubscriber = createRedisClient(redisUrl, 'Subscriber');

// Redis for room membership (shared with Room Service)
const redisRoomUrl = process.env.REDIS_ROOM_URL || 'redis://redis-room-srv:6379';
export const redisRoom = createRedisClient(redisRoomUrl, 'Room');
export const redisRoomSubscriber = createRedisClient(redisRoomUrl, 'RoomSubscriber');
export const redisRoomPublisher = createRedisClient(redisRoomUrl, 'RoomPublisher');

// Redis key patterns for room membership
export const RedisRoomKeys = {
  roomMembers: (roomId: string) => `room:${roomId}:members`,
  userRooms: (userId: string) => `user:${userId}:room`,
  roomMeta: (roomId: string) => `room:${roomId}:meta`,
};

// Redis pub/sub channels
export const RedisChannels = {
  roomEvents: 'room.events',
};

