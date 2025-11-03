# Fan-Out Architecture: How Messages Reach All Clients

## Overview

This document explains how messages flow from a single client through Kafka, Redis, and finally to all connected WebSocket clients across multiple Gateway pods.

## The 3-Layer Fan-Out Pyramid

```
Kafka (Durable Queue) → 1 Pod
   ↓
Redis (Pub/Sub Broadcast) → All Pods  
   ↓
WebSocket (Direct Send) → Connected Clients
```

## Layer-by-Layer Breakdown

### 1️⃣ Kafka: "Once and Durable" (Inter-Service Backbone)

**Purpose**: Reliable, persistent message delivery between services

**How it works**:
- Chat Service publishes `message.created` to Kafka
- All Gateway pods have a Kafka consumer with **same `groupId`**: `realtime-gateway-group`
- Kafka guarantees: **Each message is delivered to exactly ONE consumer in the group**

**Code**:
```typescript
// kafka-wrapper.ts
this._consumer = this._kafka.consumer({ 
  groupId: 'realtime-gateway-group' // Same across all pods!
});
```

**Result**: Only ONE Gateway pod receives each `message.created` event from Kafka.

---

### 2️⃣ Redis Pub/Sub: "Fast Fan-Out" (Cross-Pod Broadcast)

**Purpose**: Ultra-fast in-memory broadcast to all Gateway pods

**How it works**:
- The ONE pod that consumed from Kafka publishes to Redis channel: `room:${roomId}`
- Redis Pub/Sub is a **broadcast mechanism** (not a queue)
- **ALL Gateway pods** subscribed to that channel receive a copy

**Code**:
```typescript
// message-created-listener.ts (runs on ONE pod)
await redisPublisher.publish(`room:${data.roomId}`, JSON.stringify(data));
```

**Result**: All Gateway pods receive the message via Redis pub/sub.

---

### 3️⃣ WebSocket: "Local Delivery" (Per-Pod Socket Management)

**Purpose**: Send messages to connected clients on each pod

**How it works**:
- Each pod maintains an in-memory map: `roomMembers: Map<roomId, Set<WebSocket>>`
- When Redis message arrives, each pod:
  1. Checks if it has any sockets for that `roomId`
  2. If yes → sends to those sockets
  3. If no → ignores (another pod handles those clients)

**Code**:
```typescript
// ws-server.ts (runs on ALL pods)
redisSubscriber.on('message', (channel, raw) => {
  const roomId = channel.replace('room:', '');
  const sockets = roomMembers.get(roomId); // LOCAL to this pod
  
  if (!sockets) return; // No clients on this pod, skip
  
  // Send only to sockets on THIS pod
  for (const ws of sockets) {
    ws.send(JSON.stringify({ type: 'message', data }));
  }
});
```

**Result**: Each client receives the message exactly once (from the pod they're connected to).

---

## Complete Flow Example

Let's say User A sends a message in Room 123:

```
[User A] → WebSocket message.send
   ↓
[Gateway Pod A] → Kafka message.ingest
   ↓
[Chat Service] → Store in DB → Kafka message.created
   ↓
[Gateway Pod B] ← Kafka consumes (only Pod B gets this message)
   ↓
[Gateway Pod B] → Redis publish("room:123", message)
   ↓
[Redis Pub/Sub] → Broadcasts to ALL pods
   ├─→ Gateway Pod A (has 2 sockets in room:123) → sends to 2 clients ✅
   ├─→ Gateway Pod B (has 1 socket in room:123) → sends to 1 client ✅
   └─→ Gateway Pod C (has 0 sockets in room:123) → ignores (no clients) ⏭️
```

**Key Points**:
- ✅ Kafka ensures only one pod processes the message
- ✅ Redis ensures all pods get notified
- ✅ Each pod only sends to its own sockets
- ✅ No duplicate messages (each client gets it once)

---

## Why This Architecture Scales

### Concern: Only one pod should store/validate
**Solution**: Kafka consumer group ensures Chat Service is the only consumer of `message.ingest`

### Concern: All pods need to broadcast to their clients
**Solution**: Redis pub/sub broadcasts to all subscribers

### Concern: Each user should get message only once
**Solution**: Each pod only sends to sockets in its local memory map

### Concern: High throughput
**Solution**: 
- Fan-out happens in-memory (Redis is ~1-2ms)
- No database queries during fan-out
- Each pod handles its own clients independently

### Concern: Pod failures
**Solution**:
- Kafka ensures message is delivered even if one pod crashes
- Redis pub/sub is resilient (if one pod fails, others continue)
- WebSocket reconnection handles client reconnection

---

## Comparison: Kafka vs Redis Pub/Sub

| Feature | Kafka | Redis Pub/Sub |
|---------|-------|---------------|
| **Persistence** | ✅ Durable (disk) | ❌ Ephemeral (memory) |
| **Delivery to Groups** | ✅ One per consumer group | ❌ All subscribers |
| **Replay Messages** | ✅ Yes (offset-based) | ❌ No |
| **Latency** | ~5-20ms | ⚡ ~1-2ms |
| **Use Case** | Inter-service backbone | Cross-pod fan-out |
| **Ordering** | ✅ Per-partition ordering | ⚠️ Best-effort |
| **Message Retention** | ✅ Configurable (days) | ❌ None (fire-and-forget) |

**Takeaway**: Kafka for reliable persistence, Redis for fast fan-out.

---

## Dynamic Room Subscription

Gateway pods subscribe to Redis channels **dynamically** based on which rooms have active sockets:

```typescript
// When first socket joins a room on this pod
if (roomMembers.get(roomId).size === 1) {
  await redisSubscriber.subscribe(`room:${roomId}`);
}

// When last socket leaves a room on this pod
if (roomMembers.get(roomId).size === 0) {
  await redisSubscriber.unsubscribe(`room:${roomId}`);
}
```

**Benefits**:
- Pods only subscribe to channels they need
- Reduces Redis overhead
- Automatic cleanup when rooms become inactive

---

## Troubleshooting

### Messages not reaching clients

1. **Check Kafka consumer group**: Ensure all pods use same `groupId`
2. **Check Redis subscription**: Verify pods are subscribed to `room:${roomId}`
3. **Check socket mapping**: Verify `roomMembers` map has sockets for that room
4. **Check WebSocket state**: Ensure sockets are in `OPEN` state

### Duplicate messages

- **Cause**: Multiple consumer groups or duplicate Redis subscriptions
- **Fix**: Ensure single `groupId` and proper channel subscription logic

### Messages delayed

- **Check Kafka lag**: High lag means Chat Service is slow
- **Check Redis pub/sub**: Redis should be <5ms latency
- **Check WebSocket**: Ensure clients are processing messages quickly

---

## Summary

**Kafka = "Slow, Safe, Once"** (One pod consumes)
- Durable persistence
- Reliable delivery
- Exactly-once semantics per consumer group

**Redis Pub/Sub = "Fast, Volatile, Many"** (All pods receive)
- Sub-millisecond latency
- Broadcast to all subscribers
- No persistence (fire-and-forget)

**WebSocket = "Direct, Local, Filtered"** (Per-pod delivery)
- In-memory socket maps
- Local filtering (pod only sends to its sockets)
- No cross-pod communication needed

This architecture is similar to what Slack, Discord, and Notion AI use for real-time message propagation.

