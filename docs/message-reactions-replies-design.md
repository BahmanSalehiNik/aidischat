# Message Reactions & Replies Design

## Overview
This document outlines the design for adding reactions and replies to chat messages, with a UX similar to WhatsApp and Telegram. The implementation will be done in two phases:
1. **Phase 1**: Mobile user reactions and replies
2. **Phase 2**: Agent replies (agents can reply to messages)

## User Experience

### Message Reactions
- Users can react to any message in a chat (similar to WhatsApp reactions)
- Reaction types: 👍 (like), ❤️ (love), 😂 (haha), 😢 (sad), 😠 (angry)
- Reactions appear as small emoji badges below the message
- Users can change their reaction by tapping a different emoji
- Users can remove their reaction by tapping the same emoji again
- Multiple users can react to the same message
- Reaction summary shows: emoji + count (e.g., "👍 3, ❤️ 1")

### Message Replies
- Users can reply to any message in the chat
- When replying, a preview card appears above the input showing:
  - Sender name/avatar
  - Message preview (text truncated to ~50 chars, or media thumbnail)
  - Timestamp
- The reply is displayed in the chat with:
  - A quoted message card (small, above the reply text)
  - The reply text below
  - Visual connection (border/background) linking reply to original
- Tapping the quoted message card scrolls to and highlights the original message
- Replies maintain thread context (can see what was replied to)

## Data Models

### Updated Message Model
**Key Principle**: Replies are messages with `replyToMessageId`. Reactions are stored on the message document (not as separate messages or collection).

```typescript
interface Message {
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  senderName?: string;
  content: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  
  // Reply support (like WhatsApp, Telegram, Discord)
  replyToMessageId?: string | null; // Reference to original message being replied to
  
  // Reactions stored directly on message (like WhatsApp, Messenger, Slack)
  reactions: Array<{
    userId: string;
    emoji: string; // '👍' | '❤️' | '😂' | '😢' | '😠'
    createdAt: Date;
  }>;
  
  // Computed/denormalized fields for API responses
  reactionsSummary?: Array<{ emoji: string; count: number }>; // Aggregated summary
  currentUserReaction?: { emoji: string }; // Current user's reaction (if any)
  
  createdAt: Date;
  editedAt?: Date;
  deliveredTo: Array<{ participantId: string; at: Date }>;
  readBy: Array<{ participantId: string; at: Date }>;
  dedupeKey: string;
}
```

**Why this approach:**
- ✅ Matches WhatsApp, Telegram, Messenger, Slack, Discord
- ✅ Replies are just messages (not separate type)
- ✅ Reactions are attributes of messages (not messages themselves)
- ✅ Simple, scalable, consistent with major apps
- ✅ Works seamlessly with AI agents

## API Endpoints

### Reactions

#### POST /api/rooms/:roomId/messages/:messageId/reactions
Add or update a reaction to a message.

**Request:**
```json
{
  "type": "like" | "love" | "haha" | "sad" | "angry"
}
```

**Response:**
```json
{
  "id": "reaction-id",
  "messageId": "message-id",
  "userId": "user-id",
  "type": "like",
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### DELETE /api/rooms/:roomId/messages/:messageId/reactions
Remove the current user's reaction from a message.

**Response:** 204 No Content

#### GET /api/rooms/:roomId/messages/:messageId/reactions
Get all reactions for a message (optional, for detailed view).

**Response:**
```json
{
  "reactions": [
    {
      "id": "reaction-id",
      "userId": "user-id",
      "type": "like",
      "user": {
        "id": "user-id",
        "name": "User Name",
        "avatarUrl": "https://..."
      }
    }
  ],
  "summary": [
    { "type": "like", "count": 3 },
    { "type": "love", "count": 1 }
  ]
}
```

### Replies

#### POST /api/rooms/:roomId/messages
Create a new message (with optional reply).

**Request:**
```json
{
  "content": "This is a reply",
  "mediaIds": ["media-id-1"],
  "replyToMessageId": "original-message-id" // Optional
}
```

**Response:**
```json
{
  "id": "message-id",
  "roomId": "room-id",
  "userId": "user-id",
  "content": "This is a reply",
  "media": [...],
  "replyTo": {
    "id": "original-message-id",
    "userId": "original-user-id",
    "content": "Original message text...",
    "media": [...],
    "author": {
      "userId": "original-user-id",
      "name": "Original User",
      "avatarUrl": "https://..."
    }
  },
  "reactionsSummary": [],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

#### GET /api/rooms/:roomId/messages/:messageId
Get a specific message with full reply context.

**Response:**
```json
{
  "id": "message-id",
  "roomId": "room-id",
  "userId": "user-id",
  "content": "Message content",
  "replyTo": {
    "id": "original-message-id",
    "content": "Original message...",
    "author": { ... }
  },
  "reactionsSummary": [...],
  "createdAt": "2025-01-01T00:00:00Z"
}
```

## Event System

**Naming Convention**: Follows the `.ingested` → `.created` pattern consistent with existing services (posts, comments, reactions).

### Flow 1: Send Normal Chat Message

**Realtime Gateway** receives message from client:
```typescript
// Event: chat.message.ingested
{
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  content: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
}
```

**Chat Service** listens to `chat.message.ingested`:
- Creates message in database
- Publishes: `chat.message.created`
```typescript
// Event: chat.message.created
{
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  content: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  createdAt: Date;
}
```

**Realtime Gateway** fans out `chat.message.created` to room participants via WebSocket.

### Flow 2: Add Reaction to Message

**Realtime Gateway** receives reaction from client:
```typescript
// Event: chat.message.reaction.ingested
{
  roomId: string;
  messageId: string;
  userId: string;
  emoji: string; // '👍' | '❤️' | '😂' | '😢' | '😠'
}
```

**Chat Service** listens to `chat.message.reaction.ingested`:
- Loads message from database
- Adds/updates reaction in `message.reactions` array
- Writes update to database
- Publishes: `chat.message.reaction.created`
```typescript
// Event: chat.message.reaction.created
{
  roomId: string;
  messageId: string;
  reaction: {
    userId: string;
    emoji: string;
  };
  reactionsSummary: Array<{ emoji: string; count: number }>; // Updated summary
}
```

**Realtime Gateway** fans out `chat.message.reaction.created` to room participants.

### Flow 3: Remove Reaction

**Realtime Gateway** receives reaction removal from client:
```typescript
// Event: chat.message.reaction.ingested (with emoji to remove)
{
  roomId: string;
  messageId: string;
  userId: string;
  emoji: string; // Emoji to remove
  action: 'remove'; // Indicates removal
}
```

**Chat Service**:
- Removes reaction from `message.reactions` array
- Publishes: `chat.message.reaction.removed`
```typescript
// Event: chat.message.reaction.removed
{
  roomId: string;
  messageId: string;
  userId: string;
  reactionsSummary: Array<{ emoji: string; count: number }>; // Updated summary
}
```

### Flow 4: Reply to Message

**Realtime Gateway** receives reply from client:
```typescript
// Event: chat.message.reply.ingested
{
  roomId: string;
  senderId: string;
  senderType: 'human' | 'agent';
  content: string;
  replyToMessageId: string; // Original message being replied to
  attachments?: Array<{ url: string; type: string; meta: any }>;
}
```

**Chat Service** listens to `chat.message.reply.ingested`:
- Validates `replyToMessageId` exists in room
- Creates message with `replyToMessageId` field populated
- Publishes: `chat.message.created` (normal message event)
- Publishes: `chat.message.reply.created` (reply-specific event)
```typescript
// Event: chat.message.created (same as normal message)
{
  id: string;
  roomId: string;
  senderType: 'human' | 'agent';
  senderId: string;
  content: string;
  replyToMessageId: string; // Populated for replies
  createdAt: Date;
}

// Event: chat.message.reply.created
{
  roomId: string;
  messageId: string;
  replyToMessageId: string;
  replyTo: {
    id: string;
    senderId: string;
    senderName?: string;
    content: string;
    // Preview of original message
  };
}
```

**Realtime Gateway** fans out both events to room participants.

### Flow 5: AI Agent Reply

**AI Gateway** generates reply:
```typescript
// Event: ai.message.reply
{
  roomId: string;
  agentId: string;
  content: string;
  replyToMessageId: string; // Human message being replied to
}
```

**Chat Service**:
- Creates message with `senderType: 'agent'` and `replyToMessageId` populated
- Publishes: `chat.message.created`
- Publishes: `chat.message.reply.created`

**Realtime Gateway** fans out to room participants.

## Database Schema

### Message Collection Updates
```javascript
{
  // ... existing fields ...
  _id: String,
  roomId: String (indexed),
  senderType: String (enum: ['human', 'agent']),
  senderId: String,
  senderName: String,
  content: String,
  attachments: Array,
  
  // NEW: Reply support
  replyToMessageId: String (indexed, optional, null by default),
  
  // NEW: Reactions stored directly on message
  reactions: [{
    userId: String,
    emoji: String, // '👍' | '❤️' | '😂' | '😢' | '😠'
    createdAt: Date
  }],
  
  createdAt: Date (indexed),
  editedAt: Date,
  deliveredTo: Array,
  readBy: Array,
  dedupeKey: String (indexed)
}

// Indexes:
// { roomId: 1, createdAt: 1 } - existing
// { replyToMessageId: 1 } - new, for finding replies to a message
// { 'reactions.userId': 1 } - new, for finding user's reactions
```

**Why reactions on message document:**
- ✅ Matches WhatsApp, Messenger, Slack, Discord
- ✅ No separate collection needed
- ✅ Fast reads (no joins)
- ✅ Atomic updates
- ✅ Simple aggregation queries

## Real-time Updates (WebSocket)

The Realtime Gateway fans out events to room participants via WebSocket after Chat Service publishes `.created` events.

### WebSocket Event Types

#### chat.message.created
Sent when a new message is created (normal or reply).
```json
{
  "type": "chat.message.created",
  "data": {
    "id": "message-id",
    "roomId": "room-id",
    "senderType": "human",
    "senderId": "user-id",
    "senderName": "User Name",
    "content": "Message content",
    "replyToMessageId": "original-message-id", // null for normal messages
    "attachments": [],
    "reactions": [],
    "reactionsSummary": [],
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

#### chat.message.reaction.created
Sent when a reaction is added/updated.
```json
{
  "type": "chat.message.reaction.created",
  "data": {
    "roomId": "room-id",
    "messageId": "message-id",
    "reaction": {
      "userId": "user-id",
      "emoji": "👍"
    },
    "reactionsSummary": [
      { "emoji": "👍", "count": 3 },
      { "emoji": "❤️", "count": 1 }
    ]
  }
}
```

#### chat.message.reaction.removed
Sent when a reaction is removed.
```json
{
  "type": "chat.message.reaction.removed",
  "data": {
    "roomId": "room-id",
    "messageId": "message-id",
    "userId": "user-id",
    "reactionsSummary": [
      { "emoji": "👍", "count": 2 }
    ]
  }
}
```

#### chat.message.reply.created
Sent when a reply message is created (in addition to `chat.message.created`).
```json
{
  "type": "chat.message.reply.created",
  "data": {
    "roomId": "room-id",
    "messageId": "reply-message-id",
    "replyToMessageId": "original-message-id",
    "replyTo": {
      "id": "original-message-id",
      "senderId": "original-user-id",
      "senderName": "Original User",
      "content": "Original message text...",
      "attachments": []
    }
  }
}
```

## Mobile UI Components

### MessageReactionButton
- Component that shows reaction picker
- Displays current user's reaction (if any)
- Shows reaction summary badges below message
- Similar to PostCard reaction button

### QuotedMessageCard
- Small card showing original message preview
- Shows above input when composing reply
- Shows in message bubble when viewing reply
- Clickable to scroll to original message
- Displays:
  - Author avatar/icon
  - Author name
  - Message preview (text or media thumbnail)
  - Timestamp

### MessageBubble (Updated)
- Enhanced to show:
  - Quoted message card (if reply)
  - Reaction badges below message
  - Visual styling for replies (border, background)

## Implementation Phases

### Phase 1: Mobile User Reactions & Replies

#### Backend Tasks

1. **Database Schema Updates**
   - Add `replyToMessageId: String` field to Message model (indexed, optional, null by default)
   - Add `reactions: Array` field to Message model (embedded array of { userId, emoji, createdAt })
   - Create index: `{ replyToMessageId: 1 }` for finding replies to a message
   - Create index: `{ 'reactions.userId': 1 }` for finding user's reactions

2. **Chat Service Event Listeners**
   - **Listener**: `chat.message.reaction.ingested`
     - Loads message from database
     - Adds/updates reaction in `message.reactions` array (replace if user already reacted)
     - Aggregates reactions into `reactionsSummary`
     - Saves message
     - Publishes: `chat.message.reaction.created`
   
   - **Listener**: `chat.message.reply.ingested`
     - Validates `replyToMessageId` exists in room
     - Creates message with `replyToMessageId` populated
     - Loads original message for reply context
     - Publishes: `chat.message.created` (normal message event)
     - Publishes: `chat.message.reply.created` (reply-specific event)

3. **Event Publishers (Chat Service)**
   - `MessageReactionCreatedPublisher` (publishes `chat.message.reaction.created`)
   - `MessageReactionRemovedPublisher` (publishes `chat.message.reaction.removed`)
   - Update `MessageCreatedPublisher` to handle `replyToMessageId`
   - `MessageReplyCreatedPublisher` (publishes `chat.message.reply.created`)

4. **Realtime Gateway Updates**
   - **Handler**: Receives `chat.message.reaction.ingested` from clients
     - Validates user is room member
     - Publishes to Kafka: `chat.message.reaction.ingested`
   
   - **Handler**: Receives `chat.message.reply.ingested` from clients
     - Validates user is room member
     - Publishes to Kafka: `chat.message.reply.ingested`
   
   - **Listener**: Listens to `chat.message.reaction.created`
     - Fans out via WebSocket: `chat.message.reaction.created`
   
   - **Listener**: Listens to `chat.message.reaction.removed`
     - Fans out via WebSocket: `chat.message.reaction.removed`
   
   - **Listener**: Listens to `chat.message.reply.created`
     - Fans out via WebSocket: `chat.message.reply.created`

5. **Shared Events**
   - Add to `shared/src/events/messageEvents.ts`:
     - `MessageReactionIngestedEvent`
     - `MessageReactionCreatedEvent`
     - `MessageReactionRemovedEvent`
     - `MessageReplyIngestedEvent`
     - `MessageReplyCreatedEvent`
   - Add to `shared/src/events/subjects.ts`:
     - `MessageReactionIngested = 'chat.message.reaction.ingested'`
     - `MessageReactionCreated = 'chat.message.reaction.created'`
     - `MessageReactionRemoved = 'chat.message.reaction.removed'`
     - `MessageReplyIngested = 'chat.message.reply.ingested'`
     - `MessageReplyCreated = 'chat.message.reply.created'`

#### Frontend Tasks

1. **Components**
   - `MessageReactionButton` component (similar to PostCard reaction button)
     - Shows reaction picker on long-press
     - Displays current user's reaction
     - Shows reaction summary badges
   
   - `QuotedMessageCard` component
     - Shows above input when composing reply
     - Shows in message bubble when viewing reply
     - Clickable to scroll to original message
     - Displays: author avatar/name, message preview, timestamp
   
   - Update `MessageBubble` component
     - Show quoted message card if `replyToMessageId` exists
     - Show reaction badges below message
     - Visual styling for replies (border, background)

2. **API Integration**
   - Update `messageApi.sendMessage()` to accept `replyToMessageId` parameter
   - Add `reactionApi.addMessageReaction(roomId, messageId, emoji)`
   - Add `reactionApi.removeMessageReaction(roomId, messageId)`
   - WebSocket handlers for:
     - `chat.message.reaction.created`
     - `chat.message.reaction.removed`
     - `chat.message.reply.created`

3. **UI/UX**
   - Long-press message → show reaction picker
   - Tap reply button → show quoted message card above input
   - Display reactions below messages (emoji + count badges)
   - Display quoted message card in reply bubbles
   - Tap quoted card → scroll to and highlight original message
   - Visual connection (border/background) linking reply to original

### Phase 2: Agent Replies

#### Backend Tasks

1. **AI Gateway Updates**
   - Update `ai.message.reply` event to include `replyToMessageId`
   - Pass reply context to AI model for better responses
   - Ensure agents can access message history for context

2. **Chat Service Updates**
   - Handle `ai.message.reply` events with `replyToMessageId`
   - Create agent messages with `senderType: 'agent'` and `replyToMessageId` populated
   - Publish both `chat.message.created` and `chat.message.reply.created`

#### Frontend Tasks

1. **Agent UI**
   - Show agent replies with quoted message cards (same as human replies)
   - Display agent reactions (if agents can react in future)
   - Visual distinction for agent messages (already implemented)

## Technical Considerations

### Performance
- Reactions stored directly on message document (embedded array)
- Aggregation happens on read: `message.reactions` → `reactionsSummary`
- Use efficient queries with proper indexes
- Consider MongoDB aggregation pipeline for reaction summaries if needed
- Cache reaction summaries for frequently accessed messages (optional)

### Scalability
- Reactions embedded in message document (matches WhatsApp, Messenger pattern)
- Array size is typically small (< 10 reactions per message)
- If message gets many reactions (> 50), consider:
  - Aggregation pipeline for summary
  - Separate reaction collection (only if needed)
  - Redis cache for hot message reactions

### Consistency
- Reactions updated via events (eventual consistency)
- Real-time updates via WebSocket for immediate UI feedback
- Fallback to polling if WebSocket fails

### Security
- Users can only react/reply to messages in rooms they're members of
- Validate room membership before allowing reactions/replies
- Rate limit reactions to prevent spam

## Edge Cases

1. **Deleted Original Message**
   - If original message is deleted, show "Message deleted" in quoted card
   - Keep reply message but mark reply context as unavailable

2. **User Left Room**
   - Reactions remain visible
   - Reply context remains visible
   - User info may be limited if user deleted account

3. **Media in Quoted Message**
   - Show thumbnail for images/videos
   - Show file icon for documents
   - Truncate long text previews

4. **Long Message Previews**
   - Truncate to ~50 characters with ellipsis
   - Show full text on tap/expand

5. **Multiple Replies to Same Message**
   - Each reply shows the same quoted message card
   - Original message shows reply count (optional)

## Future Enhancements

1. **Reaction Animations**
   - Animate reaction emoji when added
   - Show who reacted (on hover/long-press)

2. **Reply Threads**
   - Group replies visually
   - Show reply count on original message
   - Expandable reply threads

3. **Forwarding**
   - Forward messages with reply context
   - Forward entire reply chains

4. **Search**
   - Search within replies
   - Filter messages by reactions

5. **Analytics**
   - Track most reacted messages
   - Track reply engagement

## Testing Strategy

1. **Unit Tests**
   - Reaction creation/deletion logic
   - Reply message creation
   - Aggregation queries

2. **Integration Tests**
   - API endpoints
   - Event publishing
   - Real-time updates

3. **E2E Tests**
   - User reacts to message
   - User replies to message
   - View reply in chat
   - Scroll to original message

## Migration Plan

1. **Database Migration**
   - Add `replyToMessageId: String` field to Message collection (nullable, indexed)
   - Add `reactions: Array` field to Message collection (empty array by default)
   - Create index: `{ replyToMessageId: 1 }`
   - Create index: `{ 'reactions.userId': 1 }`
   - No separate MessageReaction collection needed (reactions stored on message)

2. **Backward Compatibility**
   - Existing messages without `replyToMessageId` work as before (null = normal message)
   - Existing messages without `reactions` work as before (empty array = no reactions)
   - Gradual rollout of new features
   - Old clients continue to work (ignore new fields)

3. **Rollout**
   - Deploy backend changes first (Chat Service, Realtime Gateway)
   - Deploy shared events package
   - Deploy frontend changes
   - Enable feature flag (optional)
   - Monitor for issues
   - Full rollout

## Summary: Key Architectural Decisions

### ✅ Reactions
- **Storage**: Embedded array on message document (`message.reactions`)
- **Pattern**: Matches WhatsApp, Messenger, Slack, Discord
- **Flow**: `chat.message.reaction.ingested` → Chat Service → `chat.message.reaction.created` → Realtime Gateway → WebSocket
- **Not**: Separate collection or new message types

### ✅ Replies
- **Storage**: Normal message with `replyToMessageId` field populated
- **Pattern**: Matches WhatsApp, Telegram, Discord (replies are messages, not comments)
- **Flow**: `chat.message.reply.ingested` → Chat Service → `chat.message.created` + `chat.message.reply.created` → Realtime Gateway → WebSocket
- **Not**: Separate comment/reply type or collection

### ✅ Event Naming
- **Pattern**: `.ingested` (Realtime Gateway → Chat Service) → `.created` (Chat Service → Realtime Gateway)
- **Consistent with**: `post.created`, `comment.created`, `reaction.created`
- **Events**:
  - `chat.message.ingested` → `chat.message.created`
  - `chat.message.reaction.ingested` → `chat.message.reaction.created`
  - `chat.message.reaction.removed`
  - `chat.message.reply.ingested` → `chat.message.reply.created`

### ✅ AI Agent Support
- Agents can reply using same `replyToMessageId` field
- `ai.message.reply` event → Chat Service → `chat.message.created` + `chat.message.reply.created`
- Agents treated as `senderType: 'agent'` messages
- No special handling needed (unified message model)

### ✅ Consistency
- Same patterns as posts/comments/reactions
- Same event-driven architecture
- Same real-time update mechanism
- Unified message model for humans and agents

