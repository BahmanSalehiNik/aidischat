# Session Naming Strategy

## Overview

Sessions need meaningful names to help users identify and navigate their chat history. This document outlines the proposed naming strategy.

## Naming Priority (Auto-Generated)

### Tier 1: Room-Based Names (Best)
- **Group/Stage Rooms**: Use room name directly
  - Example: "Project Alpha Team"
- **DM Rooms**: Use other participant's name
  - Example: "Chat with John Doe"
- **AI-Sim Rooms**: Use agent name
  - Example: "Session with AI Assistant"

### Tier 2: Time + Content Preview (Good)
- Format: `"Today at 3:45 PM - Hey, how are you doing?"`
- Uses first message preview (first 30 chars)
- Time formatting:
  - Today: "Today at 3:45 PM"
  - Yesterday: "Yesterday at 2:30 PM"
  - This week: "Monday at 10:15 AM"
  - This year: "Jan 15 at 4:20 PM"
  - Older: "Dec 3, 2023"

### Tier 3: Simple Time-Based (Fallback)
- Just the formatted time/date
- Example: "Today at 3:45 PM"

## Implementation Approaches

### Option A: Lazy Naming (Recommended for MVP)
**Generate names on-demand when sessions are queried**

**Pros:**
- No additional processing during message ingestion
- Can fetch latest room/participant info when needed
- Flexible - can update naming logic without data migration

**Cons:**
- Requires fetching room/participant data on each query
- Slight performance overhead

**Implementation:**
```typescript
// In get-sessions route
const sessions = await SessionManager.getSessionsByParticipant(...);
const enrichedSessions = await Promise.all(
  sessions.map(async (session) => {
    const roomInfo = await fetchRoomInfo(session.roomId);
    const title = SessionNamingService.generateSessionName({
      roomId: session.roomId,
      roomName: roomInfo.name,
      roomType: roomInfo.type,
      participantId: session.participantId,
      participantType: session.participantType,
      startTime: session.startTime,
      firstMessagePreview: await getFirstMessagePreview(session.firstMessageId),
    });
    return { ...session, title };
  })
);
```

### Option B: Eager Naming (Future Enhancement)
**Generate and store names when session is created**

**Pros:**
- Fast queries (no additional lookups)
- Names are consistent over time

**Cons:**
- Requires room/participant info at session creation
- May need to listen to RoomCreated/RoomUpdated events
- Names might become stale if room names change

**Implementation:**
- Listen to RoomCreated/RoomUpdated events
- Store room info in chat-history service
- Generate name in `getOrCreateActiveSession()`

### Option C: Hybrid Approach (Best Long-Term)
**Generate basic name on creation, enrich on query**

**Pros:**
- Fast basic names available immediately
- Can enhance with latest info when queried
- Best of both worlds

**Implementation:**
- Store basic time-based name on creation
- Enhance with room/participant info when queried
- Cache enriched names for performance

## Recommended Approach: Option A (Lazy Naming)

For MVP, use **lazy naming** because:
1. ✅ Simplest to implement
2. ✅ No additional event listeners needed
3. ✅ Always uses latest room/participant info
4. ✅ Can be optimized with caching later

## Future Enhancements

1. **User Custom Names**: Allow users to manually rename sessions
2. **Smart Merging**: Merge sessions that are close together
3. **AI-Generated Names**: Use LLM to generate meaningful names from conversation content
4. **Name Caching**: Cache generated names to avoid repeated lookups
5. **Name History**: Track name changes for audit

## Example Session Names

### User Sessions
- "Chat with Alice" (DM room)
- "Project Team" (Group room)
- "Today at 3:45 PM - Hey, how are you?" (Time + preview)
- "Yesterday at 2:30 PM" (Time only)

### Agent Sessions
- "Session with AI Assistant" (Agent name)
- "Chat with User John" (Other participant)
- "Jan 15 at 4:20 PM - Hello!" (Time + preview)

