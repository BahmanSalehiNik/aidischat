// Listens for user disconnect events from Realtime Gateway and cleans up Redis state
import { redisRoom, redisRoomPublisher, redisRoomSubscriber, RedisKeys, RedisChannels } from './redis-room';

let isListening = false;

export async function startDisconnectListener() {
  if (isListening) {
    console.log('Disconnect listener already started');
    return;
  }

  // Ensure subscriber connection is ready before subscribing
  if (redisRoomSubscriber.status !== 'ready') {
    await new Promise((resolve, reject) => {
      if (redisRoomSubscriber.status === 'ready') {
        resolve(undefined);
        return;
      }
      
      redisRoomSubscriber.once('ready', resolve);
      redisRoomSubscriber.once('error', reject);
      
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Redis subscriber connection timeout')), 5000);
    });
  }

  // Add error handler for subscriber mode errors
  redisRoomSubscriber.on('error', (err) => {
    if (err.message.includes('subscriber mode')) {
      console.error('[Redis RoomSubscriber] Subscriber mode error - this connection should only be used for subscribing:', err.message);
    }
  });

  // Subscribe to room events channel using the dedicated subscriber connection
  redisRoomSubscriber.subscribe(RedisChannels.roomEvents, (err, count) => {
    if (err) {
      console.error('Error subscribing to room events for disconnect listener:', err);
      return;
    }
    console.log(`✅ Disconnect listener subscribed to ${RedisChannels.roomEvents}, ${count} total subscriptions`);
  });

  // Listen for user disconnect events
  redisRoomSubscriber.on('message', async (channel: string, raw: string) => {
    if (channel !== RedisChannels.roomEvents) return;

    try {
      const event = JSON.parse(raw);

      if (event.type === 'user.disconnected') {
        const { userId } = event;
        console.log(`🧹 Processing disconnect for user ${userId}`);

        // Get all rooms the user is in
        const userRooms = await redisRoom.hgetall(RedisKeys.userRooms(userId));
        const roomIds = Object.keys(userRooms);

        if (roomIds.length === 0) {
          console.log(`User ${userId} was not in any rooms`);
          return;
        }

        // Clean up each room
        for (const roomId of roomIds) {
          // Remove user from room members set
          const removed = await redisRoom.srem(RedisKeys.roomMembers(roomId), userId);
          
          if (removed > 0) {
            // Get updated member list
            const members = await redisRoom.smembers(RedisKeys.roomMembers(roomId));

            // Publish room.updated event so other services (including Realtime Gateway) know
            await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
              type: 'room.member.removed',
              roomId,
              participantId: userId,
              members,
              reason: 'disconnected',
              timestamp: event.timestamp || new Date().toISOString(),
            }));

            console.log(`✅ Removed user ${userId} from room ${roomId}, ${members.length} members remaining`);
          }
        }

        // Clean up user's room tracking
        await redisRoom.del(RedisKeys.userRooms(userId));

        console.log(`✅ Cleaned up user ${userId} from all ${roomIds.length} rooms`);
      }
    } catch (error) {
      console.error('Error processing disconnect event:', error);
    }
  });

  isListening = true;
}

