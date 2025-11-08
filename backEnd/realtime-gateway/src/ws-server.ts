import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { redisPublisher, redisSubscriber, redisRoom, redisRoomSubscriber, redisRoomPublisher, RedisRoomKeys, RedisChannels } from './redis';
import { MessageIngestPublisher } from './events/publishers/message-ingest-publisher';
import { Producer } from 'kafkajs';
import { verifyJWT, extractJWTFromHandshake } from './auth';

const roomMembers = new Map<string, Set<WebSocket>>();
// Track connected users by userId -> Set of WebSocket connections (for multi-device support)
const connectedUsers = new Map<string, Set<WebSocket>>();
// Track pending disconnect timeouts (for grace period)
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

// Grace period before considering a user truly disconnected (milliseconds)
const DISCONNECT_GRACE_PERIOD = 10000; // 10 seconds
// Heartbeat interval (milliseconds)
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

let globalWss: WebSocketServer | null = null;

export function startWebSocketServer(server: any, kafkaProducer: Producer) {
  const wss = new WebSocketServer({ 
    server,
    verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) => {
      try {
        const token = extractJWTFromHandshake(
          info.req.url || '',
          info.req.headers as { [key: string]: string | string[] | undefined }
        );

        if (!token) {
          return false;
        }

        const payload = verifyJWT(token);
        // Store user info in request for later use
        (info.req as any).userPayload = payload;
        return true;
      } catch (error) {
        return false;
      }
    }
  });

  // Store wss globally for use in Redis message handlers
  globalWss = wss;

  /**
   * REDIS PUB/SUB FAN-OUT HANDLER
   * 
   * This is where the actual fan-out happens:
   * - One Gateway pod consumes from Kafka and publishes to Redis
   * - Redis broadcasts to ALL Gateway pods (including this one)
   * - Each pod checks its LOCAL roomMembers map
   * - Only sends to sockets that belong to this pod
   * 
   * This ensures:
   * ✅ No duplicate messages (each socket gets message once)
   * ✅ Efficient filtering (pod only checks its own sockets)
   * ✅ Horizontal scaling (each pod handles its own clients)
   */
  redisSubscriber.on('message', (channel: string, raw: string) => {
    const roomId = channel.replace('room:', '');
    const sockets = roomMembers.get(roomId);
    
    // If this pod has no sockets in this room, ignore (another pod will handle it)
    if (!sockets || sockets.size === 0) {
      console.log(`📡 [Redis→WS] No sockets in room ${roomId} on this pod, skipping`);
      return;
    }
    
    const msg = JSON.parse(raw);
    let sentCount = 0;
    
    // Send only to sockets on THIS pod
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', data: msg }));
        sentCount++;
      } else {
        console.log(`⚠️ [Redis→WS] Socket in room ${roomId} is not OPEN (state: ${ws.readyState})`);
      }
    }
    
    if (sentCount > 0) {
      console.log(`📡 [Redis→WS] Broadcast to ${sentCount} socket(s) in room ${roomId} on this pod`);
    } else {
      console.warn(`⚠️ [Redis→WS] No sockets sent message in room ${roomId} (${sockets.size} sockets but none OPEN)`);
    }
  });

  // Subscribe to room membership events from Room Service
  redisRoomSubscriber.subscribe(RedisChannels.roomEvents, (err, count) => {
    if (err) {
      console.error('Error subscribing to room events:', err);
    } else {
      console.log(`Subscribed to ${RedisChannels.roomEvents}, ${count} total subscriptions`);
    }
  });
  redisRoomSubscriber.on('message', (channel: string, raw: string) => {
    const event = JSON.parse(raw);
    
    if (event.type === 'room.member.added' || event.type === 'room.member.removed') {
      // Broadcast room membership change to all connected clients in that room
      const sockets = roomMembers.get(event.roomId);
      if (sockets) {
        const broadcast = JSON.stringify({
          type: 'room.membership',
          payload: {
            roomId: event.roomId,
            participantId: event.participantId,
            action: event.type === 'room.member.added' ? 'joined' : 'left',
            members: event.members,
          },
        });
        
        for (const ws of sockets) {
          if (ws.readyState === ws.OPEN) {
            ws.send(broadcast);
          }
        }
      }
    }
    
    if (event.type === 'room.created') {
      // Broadcast room creation to ALL connected clients (not just room members)
      // This allows all users to see new rooms in real-time
      const broadcast = JSON.stringify({
        type: 'room.created',
        payload: {
          roomId: event.roomId,
          createdBy: event.createdBy,
          members: event.members || [],
          timestamp: event.timestamp,
        },
      });
      
      // Send to all connected WebSocket clients using wss.clients
      let sentCount = 0;
      if (globalWss) {
        globalWss.clients.forEach((ws: WebSocket) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(broadcast);
            sentCount++;
          }
        });
      }
      
      console.log(`📢 Broadcasted room.created (${event.roomId}) to ${sentCount} connected clients`);
      if (sentCount === 0) {
        console.warn(`⚠️ No clients connected to receive room.created event for ${event.roomId}`);
      }
    }
    
    if (event.type === 'room.deleted') {
      // Disconnect all WebSocket connections for the deleted room
      const sockets = roomMembers.get(event.roomId);
      if (sockets) {
        const deleteMessage = JSON.stringify({
          type: 'room.deleted',
          payload: { roomId: event.roomId },
        });
        
        for (const ws of sockets) {
          if (ws.readyState === ws.OPEN) {
            ws.send(deleteMessage);
            // Optionally close the connection
            // ws.close();
          }
        }
        // Clean up the room from memory
        roomMembers.delete(event.roomId);
        // Unsubscribe from message pub/sub
        redisSubscriber.unsubscribe(`room:${event.roomId}`);
      }
      console.log(`Room deleted: ${event.roomId}, disconnected ${sockets?.size || 0} connections`);
    }
  });

  // Setup heartbeat interval to detect zombie connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean; user?: { id: string } }) => {
      if (ws.isAlive === false) {
        // Connection didn't respond to ping, terminate it
        console.log(`Terminating zombie connection for user ${ws.user?.id}`);
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', async (ws: WebSocket & { user?: { id: string; type?: string }; isAlive?: boolean }, req: IncomingMessage) => {
    const userPayload = (req as any).userPayload;
    if (userPayload) {
      ws.user = { id: userPayload.id, type: 'human' };
      ws.isAlive = true;
      
      // Track connected user
      const userSockets = connectedUsers.get(userPayload.id) || new Set();
      userSockets.add(ws);
      connectedUsers.set(userPayload.id, userSockets);
      
      // Cancel any pending disconnect timeout (user reconnected)
      const existingTimeout = disconnectTimeouts.get(userPayload.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        disconnectTimeouts.delete(userPayload.id);
        console.log(`🔄 User ${userPayload.id} reconnected, cancelled disconnect`);
      }
      
      // Set up heartbeat handlers
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Refresh TTL in Redis when user connects (indicates they're active)
      try {
        const userRooms = await redisRoom.hgetall(RedisRoomKeys.userRooms(userPayload.id));
        if (Object.keys(userRooms).length > 0) {
          // Refresh TTL for user's room tracking
          await redisRoom.expire(RedisRoomKeys.userRooms(userPayload.id), 300); // 5 min TTL
        }
      } catch (error) {
        console.error('Error refreshing user TTL:', error);
      }
      
      // Auto-subscribe to user's rooms from Redis
      try {
        const userRooms = await redisRoom.hgetall(RedisRoomKeys.userRooms(userPayload.id));
        const roomIds = Object.keys(userRooms);
        for (const roomId of roomIds) {
          const set = roomMembers.get(roomId) || new Set();
          set.add(ws);
          roomMembers.set(roomId, set);
          // Subscribe to message pub/sub for this room
          await redisSubscriber.subscribe(`room:${roomId}`);
        }
        console.log(`✅ User ${userPayload.id} connected, auto-subscribed to ${roomIds.length} rooms`);
      } catch (error) {
        console.error('Error auto-subscribing to user rooms:', error);
      }
    }
    
    ws.on('message', async (raw: Buffer) => {
      const msg = JSON.parse(raw.toString());
      
      // Handle heartbeat ping from client
      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
          // Refresh TTL when we receive activity
          if (ws.user?.id) {
            try {
              const userRooms = await redisRoom.hgetall(RedisRoomKeys.userRooms(ws.user.id));
              if (Object.keys(userRooms).length > 0) {
                await redisRoom.expire(RedisRoomKeys.userRooms(ws.user.id), 300);
              }
            } catch (error) {
              // Silently fail, not critical
            }
          }
        }
        return;
      }
      
      if (msg.type === 'join') {
        const { roomId } = msg;
        
        console.log(`🔗 [WS] User ${ws.user?.id} attempting to join room ${roomId}`);
        
        // Check if user is a member of this room in Redis
        if (ws.user?.id) {
          const isMember = await redisRoom.sismember(RedisRoomKeys.roomMembers(roomId), ws.user.id);
          console.log(`🔗 [WS] User ${ws.user.id} is member in Redis: ${isMember}`);
          
          if (!isMember) {
            console.warn(`⚠️ [WS] User ${ws.user.id} not found in Redis for room ${roomId}, but allowing join (might be race condition)`);
            // Don't block - might be a race condition where participant was just added
            // The chat service will handle authorization when loading messages
          }
          
          // Optimistically add to Redis (Room Service will reconcile)
          await redisRoom.sadd(RedisRoomKeys.roomMembers(roomId), ws.user.id);
          await redisRoom.hset(RedisRoomKeys.userRooms(ws.user.id), roomId, Date.now().toString());
        }
        
        const set = roomMembers.get(roomId) || new Set();
        const wasFirstSocket = set.size === 0;
        set.add(ws);
        roomMembers.set(roomId, set);
        
        // Subscribe to Redis channel when first socket joins this room on this pod
        // This enables receiving messages from other pods via Redis pub/sub fan-out
        if (wasFirstSocket) {
          await redisSubscriber.subscribe(`room:${roomId}`);
          console.log(`📡 [WS] Subscribed to Redis channel "room:${roomId}" for fan-out (first socket on this pod)`);
        } else {
          console.log(`📡 [WS] Socket added to room ${roomId} (${set.size} total sockets on this pod)`);
        }
        
        // Send confirmation with room members list
        const members = await redisRoom.smembers(RedisRoomKeys.roomMembers(roomId));
        ws.send(JSON.stringify({
          type: 'room.joined',
          payload: { roomId, members },
        }));
        console.log(`✅ [WS] User ${ws.user?.id} joined room ${roomId}, ${members.length} total members`);
      }

      if (msg.type === 'message.send') {
        const publisher = new MessageIngestPublisher(kafkaProducer);
        await publisher.publish({
          roomId: msg.roomId,
          content: msg.content,
          senderId: ws.user?.id || '',
          senderType: ws.user?.type || 'human',
          tempId: msg.tempId,
        });
        
        // Refresh TTL when user is active (sending messages)
        if (ws.user?.id) {
          try {
            await redisRoom.expire(RedisRoomKeys.userRooms(ws.user.id), 300);
          } catch (error) {
            // Silently fail
          }
        }
      }
    });

    // Handle WebSocket disconnect with grace period
    ws.on('close', async () => {
      if (!ws.user?.id) return;
      
      const userId = ws.user.id;
      
      // Remove this specific socket from user's connection set
      const userSockets = connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        
        // If user still has other active connections, don't disconnect
        if (userSockets.size > 0) {
          console.log(`🔌 User ${userId} closed one connection, ${userSockets.size} remaining`);
          return;
        }
        
        // No more connections for this user, remove from tracking
        connectedUsers.delete(userId);
      }
      
      // Clean up room memberships in memory
      for (const [roomId, sockets] of roomMembers.entries()) {
        sockets.delete(ws);
        // Unsubscribe from Redis channel when last socket leaves this room on this pod
        if (sockets.size === 0) {
          redisSubscriber.unsubscribe(`room:${roomId}`);
          console.log(`📡 Unsubscribed from Redis channel "room:${roomId}" (no more sockets)`);
        }
      }
      
      // Set up grace period before publishing disconnect
      // This gives the user time to reconnect if it was a temporary network issue
      const timeoutId = setTimeout(async () => {
        // Double-check user hasn't reconnected
        const stillConnected = connectedUsers.has(userId);
        if (stillConnected) {
          console.log(`🔄 User ${userId} reconnected during grace period, skipping disconnect`);
          disconnectTimeouts.delete(userId);
          return;
        }
        
        // User is truly disconnected, publish event
        try {
          await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
            type: 'user.disconnected',
            userId,
            timestamp: new Date().toISOString(),
          }));
          console.log(`🔌 Published disconnect event for user ${userId}`);
        } catch (error) {
          console.error(`Error publishing disconnect event for user ${userId}:`, error);
        }
        
        disconnectTimeouts.delete(userId);
      }, DISCONNECT_GRACE_PERIOD);
      
      disconnectTimeouts.set(userId, timeoutId);
      console.log(`⏳ User ${userId} disconnected, grace period started (${DISCONNECT_GRACE_PERIOD}ms)`);
    });
  });
}

