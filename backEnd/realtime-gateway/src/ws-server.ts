import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { redisPublisher, redisSubscriber, redisRoom, redisRoomSubscriber, redisRoomPublisher, RedisRoomKeys, RedisChannels } from './redis';
import { MessageIngestPublisher } from './events/publishers/message-ingest-publisher';
import { MessageReactionIngestPublisher } from './events/publishers/message-reaction-ingest-publisher';
import { MessageReplyIngestPublisher } from './events/publishers/message-reply-ingest-publisher';
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

// Diagnostic function to check socket mapping state
function logSocketMappingState() {
  console.log(`📊 [WS Server] Socket Mapping Diagnostic:`, {
    totalRooms: roomMembers.size,
    rooms: Array.from(roomMembers.entries()).map(([roomId, sockets]) => ({
      roomId,
      socketCount: sockets.size,
      openSockets: Array.from(sockets).filter(ws => ws.readyState === WebSocket.OPEN).length,
      closedSockets: Array.from(sockets).filter(ws => ws.readyState !== WebSocket.OPEN).length,
      socketStates: Array.from(sockets).map((ws: WebSocket & { user?: { id: string; type?: string } }) => ({
        readyState: ws.readyState,
        hasUser: !!ws.user,
        userId: ws.user?.id,
      })),
    })),
    totalConnectedUsers: connectedUsers.size,
    connectedUserIds: Array.from(connectedUsers.keys()),
  });
}

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
  console.log('🔧 [WS Server] Setting up Redis subscriber message handler...');
  console.log('🔧 [WS Server] Redis subscriber ready state:', redisSubscriber.status);
  
  redisSubscriber.on('message', (channel: string, raw: string) => {
    // Handle both regular rooms and AR rooms
    let roomId: string;
    let isARRoom = false;
    
    if (channel.startsWith('ar-room:')) {
      // AR room channel
      roomId = channel.replace('ar-room:', '').trim();
      isARRoom = true;
    } else {
      // Regular room channel
      roomId = channel.replace('room:', '').trim();
    }
    
    const sockets = roomMembers.get(roomId);
    
    console.log(`📡 [Redis→WS] Received message on channel "${channel}", extracted roomId: "${roomId}", sockets in room: ${sockets?.size || 0}`);
    console.log(`📡 [Redis→WS] Current roomMembers map state:`, {
      totalRooms: roomMembers.size,
      allRoomIds: Array.from(roomMembers.keys()),
      targetRoomId: roomId,
      hasSockets: !!sockets,
      socketCount: sockets?.size || 0,
    });
    
    // Debug: Log all roomIds in roomMembers map to detect mismatches
    if (!sockets || sockets.size === 0) {
      const allRoomIds = Array.from(roomMembers.keys());
      console.log(`📡 [Redis→WS] DEBUG - No sockets for roomId "${roomId}". Available roomIds in roomMembers:`, allRoomIds);
      // Check for potential matches with different formatting
      const potentialMatch = allRoomIds.find(id => id.trim() === roomId || id === roomId.trim());
      if (potentialMatch) {
        console.warn(`📡 [Redis→WS] ⚠️ Found potential roomId mismatch: received "${roomId}" but have "${potentialMatch}"`);
      }
    }
    
    // If this pod has no sockets in this room, ignore (another pod will handle it)
    if (!sockets || sockets.size === 0) {
      console.log(`📡 [Redis→WS] ⚠️ No sockets in room ${roomId} on this pod, skipping (another pod will handle it)`);
      return;
    }
    
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch (error) {
      console.error(`❌ [Redis→WS] Failed to parse message from Redis channel ${channel}:`, error);
      return;
    }
    
    let sentCount = 0;
    
    // Determine message type based on event structure
    let wsMessageType = 'message';
    if (msg.type === 'ar-stream-chunk') {
      wsMessageType = 'ar-stream-chunk';
    } else if (msg.type === 'message.reaction.created') {
      wsMessageType = 'message.reaction.created';
    } else if (msg.type === 'message.reaction.removed') {
      wsMessageType = 'message.reaction.removed';
    } else if (msg.type === 'message.reply.created') {
      wsMessageType = 'message.reply.created';
    }
    
    // Validate message data before sending
    // For regular messages, ensure required fields are present
    // Note: content can be empty (e.g., messages with only attachments)
    if (wsMessageType === 'message' && (!msg.id || !msg.senderId)) {
      console.warn(`⚠️ [Redis→WS] Invalid message data, skipping:`, {
        hasId: !!msg.id,
        hasContent: !!msg.content,
        hasSenderId: !!msg.senderId,
        roomId: msg.roomId,
      });
      return;
    }
    
    // For AR stream chunks, validate required fields
    if (wsMessageType === 'ar-stream-chunk') {
      if (!msg.streamId || !msg.messageId || !msg.roomId) {
        console.warn(`⚠️ [Redis→WS] Invalid AR stream chunk data, skipping:`, {
          hasStreamId: !!msg.streamId,
          hasMessageId: !!msg.messageId,
          hasRoomId: !!msg.roomId,
          type: msg.type,
          roomId: channel,
        });
        return;
      }
      console.log(`📡 [Redis→WS] Broadcasting ${wsMessageType} for stream ${msg.streamId} (chunk ${msg.chunkIndex}) in room ${msg.roomId} to ${sockets.size} socket(s)`);
    }
    
    // For reaction events, validate required fields
    if (wsMessageType === 'message.reaction.created' || wsMessageType === 'message.reaction.removed') {
      if (!msg.messageId || !msg.roomId) {
        console.warn(`⚠️ [Redis→WS] Invalid reaction event data, skipping:`, {
          hasMessageId: !!msg.messageId,
          hasRoomId: !!msg.roomId,
          type: msg.type,
          roomId: channel,
        });
        return;
      }
      console.log(`📡 [Redis→WS] Broadcasting ${wsMessageType} for message ${msg.messageId} in room ${msg.roomId} to ${sockets.size} socket(s)`);
    }
    
    // Send only to sockets on THIS pod
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        // For reaction events, send the data structure expected by the client
        const payload = wsMessageType === 'message.reaction.created' || wsMessageType === 'message.reaction.removed'
          ? { type: wsMessageType, data: msg } // Client expects { type, data: { messageId, roomId, reaction, reactionsSummary } }
          : { type: wsMessageType, data: msg }; // Regular messages also use same structure
        
        ws.send(JSON.stringify(payload));
        sentCount++;
      } else {
        console.log(`⚠️ [Redis→WS] Socket in room ${roomId} is not OPEN (state: ${ws.readyState})`);
      }
    }
    
    if (sentCount > 0) {
      console.log(`📡 [Redis→WS] ✅ Broadcast ${wsMessageType} to ${sentCount} socket(s) in room ${roomId} on this pod`);
    } else {
      console.warn(`⚠️ [Redis→WS] ❌ No sockets sent message in room ${roomId} (${sockets.size} sockets but ${sentCount} sent - check socket states)`);
      // Log socket states for debugging
      let openCount = 0;
      let closedCount = 0;
      const socketDetails: any[] = [];
      sockets.forEach((ws: any) => {
        if (ws.readyState === WebSocket.OPEN) {
          openCount++;
        } else {
          closedCount++;
        }
        socketDetails.push({
          readyState: ws.readyState,
          readyStateName: ws.readyState === WebSocket.OPEN ? 'OPEN' : ws.readyState === WebSocket.CONNECTING ? 'CONNECTING' : ws.readyState === WebSocket.CLOSING ? 'CLOSING' : 'CLOSED',
          hasUser: !!ws.user,
          userId: ws.user?.id,
        });
      });
      console.warn(`📡 [Redis→WS] Socket states: ${openCount} OPEN, ${closedCount} not OPEN`);
      console.warn(`📡 [Redis→WS] Socket details:`, socketDetails);
      
      // Log full socket mapping state when message delivery fails
      logSocketMappingState();
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
        const roomIds = Object.keys(userRooms).map(id => id.trim()); // Normalize roomIds
        console.log(`📡 [WS] Auto-subscribing user ${userPayload.id} to ${roomIds.length} rooms:`, roomIds);
        
        for (const roomId of roomIds) {
          const set = roomMembers.get(roomId) || new Set();
          const wasFirstSocket = set.size === 0;
          set.add(ws);
          roomMembers.set(roomId, set);
          
          console.log(`📡 [WS] Adding socket to room ${roomId} for user ${userPayload.id}:`, {
            wasFirstSocket,
            socketCountBefore: wasFirstSocket ? 0 : set.size - 1,
            socketCountAfter: set.size,
            roomId,
          });
          
          // Subscribe to message pub/sub for this room (only if first socket on this pod)
          if (wasFirstSocket) {
            const channel = `room:${roomId}`;
            try {
              await redisSubscriber.subscribe(channel);
              console.log(`📡 [WS] ✅ Auto-subscribed to Redis channel "${channel}" for user ${userPayload.id} (first socket on this pod)`);
            } catch (subErr) {
              console.error(`❌ [WS] Failed to auto-subscribe to Redis channel "${channel}":`, subErr);
            }
          } else {
            console.log(`📡 [WS] Socket added to room ${roomId} for user ${userPayload.id} (${set.size} total sockets, already subscribed)`);
          }
        }
        console.log(`✅ [WS] User ${userPayload.id} connected, auto-subscribed to ${roomIds.length} rooms. RoomMembers map now has ${roomMembers.size} rooms.`);
      } catch (error) {
        console.error('❌ [WS] Error auto-subscribing to user rooms:', error);
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
        const { roomId: rawRoomId } = msg;
        // Normalize roomId (trim whitespace) to ensure consistency
        const roomId = rawRoomId?.trim();
        
        if (!roomId) {
          console.error(`❌ [WS] Invalid roomId in join message:`, rawRoomId);
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid roomId' } }));
          return;
        }
        
        console.log(`🔗 [WS] User ${ws.user?.id} attempting to join room "${roomId}" (normalized from "${rawRoomId}")`);
        
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
        
        // Log current roomMembers state for debugging
        console.log(`📊 [WS] RoomMembers map state after join:`, {
          roomId,
          socketsInRoom: set.size,
          totalRooms: roomMembers.size,
          allRoomIds: Array.from(roomMembers.keys()),
        });
        
        // Subscribe to Redis channel when first socket joins this room on this pod
        // This enables receiving messages from other pods via Redis pub/sub fan-out
        if (wasFirstSocket) {
          try {
            const channel = `room:${roomId}`;
            console.log(`📡 [WS] Attempting to subscribe to Redis channel "${channel}"...`);
            await redisSubscriber.subscribe(channel);
            console.log(`📡 [WS] ✅ Successfully subscribed to Redis channel "${channel}" for fan-out (first socket on this pod)`);
            
            // Verify subscription by checking active channels
            try {
              const subscribedChannels = await redisSubscriber.pubsub('CHANNELS', `room:${roomId}`);
              console.log(`📡 [WS] Verified subscription - active channels matching "room:${roomId}":`, subscribedChannels);
            } catch (verifyError) {
              console.warn(`⚠️ [WS] Could not verify subscription (non-critical):`, verifyError);
            }
          } catch (error) {
            console.error(`❌ [WS] Failed to subscribe to Redis channel "room:${roomId}":`, error);
            console.error(`❌ [WS] Error details:`, {
              message: (error as Error).message,
              stack: (error as Error).stack,
              roomId,
              channel: `room:${roomId}`,
            });
          }
          
          // Also subscribe to AR room channel if this is an AR room
          // Client can indicate via msg.isARRoom, or we can check room type from Room Service
          const isARRoom = msg.isARRoom || false; // TODO: Fetch from Room Service to verify room type
          if (isARRoom) {
            const arChannel = `ar-room:${roomId}`;
            try {
              await redisSubscriber.subscribe(arChannel);
              console.log(`📡 [WS] ✅ Subscribed to AR Redis channel "${arChannel}" (first socket on this pod)`);
            } catch (error) {
              console.error(`❌ [WS] Failed to subscribe to AR Redis channel "${arChannel}":`, error);
            }
          }
        } else {
          console.log(`📡 [WS] Socket added to room ${roomId} (${set.size} total sockets on this pod, already subscribed)`);
        }
        
        // Send confirmation with room members list
        const members = await redisRoom.smembers(RedisRoomKeys.roomMembers(roomId));
        ws.send(JSON.stringify({
          type: 'room.joined',
          payload: { roomId, members },
        }));
        console.log(`✅ [WS] User ${ws.user?.id} joined room ${roomId}, ${members.length} total members`);
        
        // Log socket mapping state after join for debugging
        logSocketMappingState();
      }

      if (msg.type === 'message.send') {
        // Normalize roomId
        const roomId = msg.roomId?.trim();
        if (!roomId) {
          console.error(`❌ [WS] Invalid roomId in message.send:`, msg.roomId);
          return;
        }
        
        console.log(`📤 [WS] Publishing message.send to Kafka: roomId=${roomId}, content=${msg.content?.substring(0, 50) || 'empty'}, senderId=${ws.user?.id}`);
        
        const publisher = new MessageIngestPublisher(kafkaProducer);
        await publisher.publish({
          roomId,
          content: msg.content,
          senderId: ws.user?.id || '',
          senderType: ws.user?.type || 'human',
          tempId: msg.tempId,
          replyToMessageId: msg.replyToMessageId, // Support replies
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

      if (msg.type === 'message.reaction') {
        // Normalize roomId
        const roomId = msg.roomId?.trim();
        if (!roomId) {
          console.error(`❌ [WS] Invalid roomId in message.reaction:`, msg.roomId);
          return;
        }
        
        const publisher = new MessageReactionIngestPublisher(kafkaProducer);
        await publisher.publish({
          roomId,
          messageId: msg.messageId,
          userId: ws.user?.id || '',
          emoji: msg.emoji,
          action: msg.action, // 'add' or 'remove'
        });
        
        // Refresh TTL when user is active
        if (ws.user?.id) {
          try {
            await redisRoom.expire(RedisRoomKeys.userRooms(ws.user.id), 300);
          } catch (error) {
            // Silently fail
          }
        }
      }

      if (msg.type === 'message.reply') {
        // Normalize roomId
        const roomId = msg.roomId?.trim();
        if (!roomId) {
          console.error(`❌ [WS] Invalid roomId in message.reply:`, msg.roomId);
          return;
        }
        
        const publisher = new MessageReplyIngestPublisher(kafkaProducer);
        await publisher.publish({
          roomId,
          senderId: ws.user?.id || '',
          senderType: (ws.user?.type || 'human') as 'human' | 'agent',
          content: msg.content,
          replyToMessageId: msg.replyToMessageId,
          attachments: msg.attachments,
          senderName: msg.senderName,
          dedupeKey: msg.tempId,
        });
        
        // Refresh TTL when user is active
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
      console.log(`🔌 [WS] Cleaning up room memberships for user ${userId}. Current roomMembers map:`, {
        totalRooms: roomMembers.size,
        roomIds: Array.from(roomMembers.keys()),
      });
      
      for (const [roomId, sockets] of roomMembers.entries()) {
        const hadSocket = sockets.has(ws);
        sockets.delete(ws);
        const remainingSockets = sockets.size;
        
        if (hadSocket) {
          console.log(`🔌 [WS] Removed socket from room ${roomId}. Remaining sockets: ${remainingSockets}`);
        }
        
        // Unsubscribe from Redis channel when last socket leaves this room on this pod
        if (remainingSockets === 0) {
          try {
            await redisSubscriber.unsubscribe(`room:${roomId}`);
            console.log(`📡 [WS] Unsubscribed from Redis channel "room:${roomId}" (no more sockets on this pod)`);
            // Remove empty room from map
            roomMembers.delete(roomId);
          } catch (unsubErr) {
            console.error(`❌ [WS] Error unsubscribing from Redis channel "room:${roomId}":`, unsubErr);
          }
        }
      }
      
      console.log(`🔌 [WS] After cleanup, roomMembers map has ${roomMembers.size} rooms`);
      
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

