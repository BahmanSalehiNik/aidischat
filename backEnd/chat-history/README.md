# Chat History Service

Historical message and room service for tracking chat sessions and providing access to conversation history.

## Overview

This service tracks chat sessions for users and agents, allowing clients to:
- View their own chat history separated by session
- View agent chat history separated by session
- Query messages by session
- Query sessions by userId or agentId

## Session Definition

A **chat session** represents a period of active conversation between a participant (user or agent) and other participants in a room.

### Session Lifecycle

**Session starts when:**
- A participant sends their first message in a room (after a period of inactivity or when joining)

**Session ends when:**
- There's a period of inactivity (default: 30 minutes of no messages from that participant)
- The participant explicitly ends the session (future feature)
- The participant leaves the room (future feature)

### Session Tracking Strategy

The service uses a **hybrid approach** combining message-based and time-based tracking:

1. **Message-based tracking**: Each session tracks `firstMessageId` and `lastMessageId` for accurate conversation boundaries
2. **Time-based fallback**: Uses inactivity timeout (30 minutes) to detect when sessions should end
3. **Future-ready**: Designed to work with message ordering/sequence numbers when implemented

## Data Models

### Session
- `id`: Unique session identifier
- `roomId`: Room where the session occurred
- `participantId`: User or agent ID
- `participantType`: 'human' | 'agent'
- `startTime`: When the session started
- `endTime`: When the session ended (null if active)
- `lastActivityTime`: Last message timestamp
- `firstMessageId`: First message in the session
- `lastMessageId`: Last message in the session
- `messageCount`: Number of messages in the session
- `title`: Optional session title/name

### MessageSessionLink
- `messageId`: Reference to the message
- `sessionId`: Reference to the session
- `roomId`: Room ID (denormalized for queries)
- `participantId`: Participant ID (denormalized for queries)
- `participantType`: Participant type (denormalized for queries)
- `createdAt`: Message timestamp

## API Endpoints

### GET /api/sessions
Get sessions for the authenticated user.

**Query Parameters:**
- `roomId` (optional): Filter by room
- `participantType` (optional): 'human' | 'agent' (default: 'human')
- `limit` (optional): Pagination limit (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `includeActive` (optional): Include active sessions (default: true)

**Response:**
```json
{
  "sessions": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

### GET /api/agents/:agentId/sessions
Get sessions for a specific agent.

**Query Parameters:** Same as `/api/sessions`

### GET /api/sessions/:sessionId/messages
Get message IDs for a specific session.

**Query Parameters:**
- `limit` (optional): Pagination limit (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "messageIds": ["msg-1", "msg-2", ...],
  "pagination": {
    "total": 50,
    "limit": 100,
    "offset": 0
  }
}
```

**Note:** The client should fetch full message details from the chat service using these message IDs.

### GET /api/sessions/by-message/:messageId
Find which session a message belongs to.

**Response:**
```json
{
  "session": { ... }
}
```

## Environment Variables

- `MONGO_URI`: MongoDB connection string
- `KAFKA_BROKER_URL`: Comma-separated Kafka broker URLs
- `KAFKA_CLIENT_ID`: Kafka client identifier
- `JWT_DEV`: JWT secret for development

## Future Enhancements

1. **Message Ordering Support**: When message sequence numbers are added, sessions can use them for more accurate boundary detection
2. **Session Titles**: Auto-generate or allow users to set session titles
3. **Session Merging**: Merge sessions that are close together in time
4. **Session Analytics**: Track session duration, message counts, etc.
5. **Explicit Session Management**: Allow users to manually start/end sessions

