# Realtime Gateway - Disconnect Detection System

## Overview

The Realtime Gateway implements a robust disconnection detection system that handles user disconnections gracefully, even when users disappear without saying goodbye.

## Architecture

### 1. **User Tracking**
- **Multi-device support**: Tracks all WebSocket connections per user (`connectedUsers` map)
- **Grace period**: 10-second window before considering a user truly disconnected
- **Reconnection handling**: Cancels pending disconnect if user reconnects during grace period

### 2. **Heartbeat System**
- **Server-side ping**: Every 30 seconds, server pings all clients
- **Client pong**: Clients must respond to keep connection alive
- **Zombie detection**: Connections that don't respond are terminated

### 3. **TTL-based Cleanup**
- **Redis TTL**: User room tracking keys have 5-minute TTL
- **TTL refresh**: Automatically refreshed on:
  - User connects
  - User sends messages
  - User sends ping
- **Failsafe**: If disconnect event is missed, Redis key expires and can trigger cleanup

### 4. **Disconnect Event Flow**

```
User closes app / loses connection
  ↓
WebSocket 'close' event fires
  ↓
Remove from connectedUsers tracking
  ↓
Wait 10 seconds (grace period)
  ↓
Check if user reconnected (if yes, cancel)
  ↓
Publish 'user.disconnected' to Redis pub/sub
  ↓
Room Service consumes event
  ↓
Room Service removes user from all rooms in Redis
  ↓
Room Service publishes 'room.member.removed' event
  ↓
Realtime Gateway broadcasts to room clients
```

## Features

### Grace Period
- Default: 10 seconds
- Configurable via `DISCONNECT_GRACE_PERIOD` constant
- Gives users time to reconnect after temporary network issues

### Heartbeat
- Default interval: 30 seconds
- Configurable via `HEARTBEAT_INTERVAL` constant
- Detects zombie connections that don't properly close

### TTL Refresh
- Automatically refreshes Redis TTL on any user activity
- Ensures active users don't get cleaned up accidentally
- 5-minute TTL acts as ultimate failsafe

## Message Types

### Client → Server
- `ping`: Client heartbeat (optional, server also pings)
- `join`: Join a room
- `message.send`: Send a message

### Server → Client
- `pong`: Response to client ping
- `room.joined`: Confirmation of room join
- `room.membership`: Room membership change notification
- `room.deleted`: Room was deleted
- `message`: New message in room
- `error`: Error message

## Configuration

### Environment Variables
- `REDIS_URL`: Redis for message pub/sub
- `REDIS_ROOM_URL`: Redis for room membership (shared with Room Service)
- `KAFKA_BROKER`: Kafka broker URL

### Constants (in ws-server.ts)
- `DISCONNECT_GRACE_PERIOD`: 10000ms (10 seconds)
- `HEARTBEAT_INTERVAL`: 30000ms (30 seconds)
- Redis TTL: 300 seconds (5 minutes)

## Advanced: Redis Keyspace Notifications (Optional)

For ultimate failsafe, you can enable Redis keyspace notifications:

```bash
# In Redis
CONFIG SET notify-keyspace-events Ex
```

Then subscribe to expiration events:

```typescript
redisRoomSubscriber.psubscribe('__keyevent@0__:expired');
redisRoomSubscriber.on('pmessage', (pattern, channel, key) => {
  if (key.startsWith('user:')) {
    const userId = key.replace('user:', '').replace(':room', '');
    // Handle user timeout
  }
});
```

## Troubleshooting

### Users not being cleaned up
1. Check if disconnect events are being published
2. Verify Room Service disconnect listener is running
3. Check Redis TTL expiration (should be 5 minutes)
4. Verify Redis pub/sub is working

### False disconnects
- Increase `DISCONNECT_GRACE_PERIOD` if network is unreliable
- Check heartbeat responses are working
- Verify WebSocket proxy timeout settings

