# Chat History Service Design

## Overview

The Chat History Service provides historical message and room tracking with session-based organization. It allows clients to view chat history separated by sessions for both users and agents.

## Session Definition

A **chat session** represents a period of active conversation between a participant (user or agent) and other participants in a room.

### Session Lifecycle

**Session starts when:**
- A participant sends their first message in a room (after a period of inactivity or when joining)

**Session ends when:**
- There's a period of inactivity (default: 30 minutes of no messages from that participant)
- The participant explicitly ends the session (future feature)
- The participant leaves the room (future feature)

## Design Decision: MessageId-Based Session Tracking

### Why MessageId Instead of Just Time?

We chose a **hybrid approach** that uses message IDs as the primary tracking mechanism with time as a fallback:

#### 1. **Accuracy with Message Ordering**
When message ordering/sequence numbers are added, sessions can be accurately tracked based on message sequences rather than just timestamps. This prevents issues with:
- Out-of-order message delivery
- Clock skew between services
- Network delays affecting timestamps

#### 2. **Clear Session Boundaries**
Each session tracks:
- `firstMessageId`: The first message that started the session
- `lastMessageId`: The most recent message in the session

This provides clear, queryable boundaries for sessions.

#### 3. **Future-Proof Design**
The design is ready for message ordering:
```typescript
// Future enhancement when message ordering is added:
interface Session {
  firstMessageId: string;
  lastMessageId: string;
  firstMessageSequence?: number; // When ordering is available
  lastMessageSequence?: number;   // When ordering is available
}
```

#### 4. **Time as Fallback**
Time-based tracking is still used for:
- Inactivity detection (30-minute timeout)
- Session end detection
- Fallback when message ordering is not available

### Session Tracking Flow

```
Message Created Event
    ↓
Check for Active Session
    ↓
[Active Session Found?]
    ├─ Yes → Check inactivity timeout
    │         ├─ Within timeout → Continue session (update lastMessageId)
    │         └─ Timed out → End session, create new
    └─ No → Create new session (set firstMessageId = messageId)
```

## Data Models

### Session Model

```typescript
interface Session {
  id: string;
  roomId: string;
  participantId: string;
  participantType: 'human' | 'agent';
  startTime: Date;              // When session started
  endTime?: Date;                 // When session ended (null if active)
  lastActivityTime: Date;         // Last message timestamp
  firstMessageId: string;         // First message in session
  lastMessageId: string;          // Last message in session
  messageCount: number;           // Number of messages
  title?: string;                 // Optional session title
}
```

**Key Indexes:**
- `{ participantId, participantType, startTime }` - Query sessions by participant
- `{ firstMessageId }` - Find session by first message
- `{ lastMessageId }` - Find session by last message
- `{ lastActivityTime }` - Find active sessions

### MessageSessionLink Model

```typescript
interface MessageSessionLink {
  messageId: string;              // Reference to message
  sessionId: string;               // Reference to session
  roomId: string;                  // Denormalized for queries
  participantId: string;           // Denormalized for queries
  participantType: 'human' | 'agent';
  createdAt: Date;                 // Message timestamp
}
```

**Key Indexes:**
- `{ sessionId, createdAt }` - Get messages in session order
- `{ messageId }` (unique) - One session per message
- `{ roomId, participantId, participantType }` - Query by room/participant

## API Design

### GET /api/sessions
Get sessions for authenticated user.

**Use Cases:**
- User wants to see their chat history organized by session
- Filter by room to see sessions in a specific conversation

### GET /api/agents/:agentId/sessions
Get sessions for a specific agent.

**Use Cases:**
- User wants to see their agent's conversation history
- Agent owner wants to review agent interactions

### GET /api/sessions/:sessionId/messages
Get message IDs for a session.

**Use Cases:**
- Client wants to display messages in a session
- Client fetches message IDs, then gets full message details from chat service

**Note:** Returns message IDs only. Client should fetch full messages from chat service:
```typescript
// Client flow:
const { messageIds } = await fetch('/api/sessions/123/messages');
const messages = await Promise.all(
  messageIds.map(id => fetch(`/api/rooms/${roomId}/messages/${id}`))
);
```

### GET /api/sessions/by-message/:messageId
Find which session a message belongs to.

**Use Cases:**
- Client wants to know which session a message is part of
- Useful for navigation (jump to session from message)

## Integration with Message Ordering

When message ordering is implemented, the service can be enhanced:

1. **Sequence-Based Session Detection**
   ```typescript
   // Detect session gaps based on sequence numbers
   if (messageSequence - lastMessageSequence > THRESHOLD) {
     // Gap detected - start new session
   }
   ```

2. **More Accurate Boundaries**
   - Sessions can be defined by message sequence gaps
   - Time-based timeout becomes secondary check

3. **Query by Sequence Range**
   ```typescript
   // Find sessions containing messages in sequence range
   getSessionsBySequenceRange(roomId, fromSequence, toSequence)
   ```

## Performance Considerations

1. **Indexes**: All common query patterns are indexed
2. **Denormalization**: MessageSessionLink includes roomId and participantId for fast queries
3. **Pagination**: All list endpoints support pagination
4. **Idempotency**: Message linking is idempotent (prevents duplicate links)

## Future Enhancements

1. **Message Ordering Integration**: Use sequence numbers when available
2. **Session Titles**: Auto-generate or allow manual session titles
3. **Session Merging**: Merge sessions that are close together
4. **Session Analytics**: Track metrics like duration, message counts
5. **Explicit Session Management**: Allow users to manually start/end sessions
6. **Session Search**: Full-text search within sessions

