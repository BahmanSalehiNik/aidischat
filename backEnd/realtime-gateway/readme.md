# Realtime Gateway Service

This service handles realtime WebSocket connections for the distributed chat application. It manages room subscriptions, message broadcasting, and presence updates.

## Features

- WebSocket server for realtime connections
- JWT authentication for WebSocket handshakes
- Room-based message broadcasting
- Redis pub/sub for cross-instance communication
- Kafka integration for event publishing and listening
- Presence tracking (online, offline, typing, idle)

## Architecture

- **WebSocket Server**: Handles client connections and message routing
- **Redis**: Used for pub/sub to enable cross-instance communication
- **Kafka**: Used for publishing message ingest events and listening to message/room events

## Environment Variables

- `JWT_DEV`: JWT secret for token verification
- `KAFKA_BROKER_URL`: Comma-separated list of Kafka broker URLs
- `KAFKA_CLIENT_ID`: Kafka client ID (defaults to 'realtime-gateway')
- `REDIS_HOST`: Redis host (defaults to 'localhost')
- `REDIS_PORT`: Redis port (defaults to 6379)
- `PORT`: Service port (defaults to 3000)

## WebSocket Protocol

### Connection
Clients connect via WebSocket with JWT authentication:
- Query parameter: `ws://host:port?token=JWT_TOKEN`
- Or Authorization header: `Authorization: Bearer JWT_TOKEN`

### Message Types

#### Incoming (Client -> Server)

```json
{
  "type": "join",
  "payload": { "roomId": "room-123" }
}
```

```json
{
  "type": "leave",
  "payload": { "roomId": "room-123" }
}
```

```json
{
  "type": "message",
  "payload": {
    "roomId": "room-123",
    "content": "Hello!",
    "attachments": [],
    "dedupeKey": "optional-unique-key"
  }
}
```

```json
{
  "type": "presence",
  "payload": {
    "roomId": "room-123",
    "status": "typing"
  }
}
```

#### Outgoing (Server -> Client)

```json
{
  "type": "message",
  "payload": {
    "id": "msg-123",
    "roomId": "room-123",
    "senderType": "human",
    "senderId": "user-123",
    "content": "Hello!",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

```json
{
  "type": "room_update",
  "payload": {
    "roomId": "room-123",
    "action": "joined"
  }
}
```

```json
{
  "type": "error",
  "payload": {
    "message": "Error description"
  }
}
```

## Development

```bash
npm install
npm start
```

## Deployment

The service is containerized and can be deployed to Kubernetes using the provided deployment files in `infra/k8s/`.

