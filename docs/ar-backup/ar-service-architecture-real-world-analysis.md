# AR Service Architecture - Real-World App Analysis

## How Big Apps Handle Video + Chat

### Microsoft Teams

**User Experience:**
- When you create a meeting, it automatically creates a chat thread
- Video and chat are in the same "meeting" context
- Users see both video and chat in the same interface

**Backend Architecture:**
- **Separate services** behind the scenes:
  - Chat Service: Handles text messages, files, reactions
  - Azure Communication Services: Handles video/audio streaming
  - Meeting Service: Coordinates both, links them together
- They're **linked** but **not the same service**

**Key Insight**: Unified at the user level, separate services at the backend level.

---

### FaceTime / iMessage

**User Experience:**
- FaceTime: Video/audio calls only (no persistent chat)
- iMessage: Text messages only (separate app)
- You can start a FaceTime call from iMessage, but they're separate experiences

**Backend Architecture:**
- **Completely separate services**
- FaceTime: Video/audio streaming service
- iMessage: Chat service
- Linked via user contacts, but no shared "room"

**Key Insight**: Different apps = different services, even if they're linked.

---

### Discord

**User Experience:**
- Server has multiple channels:
  - Text channels (chat)
  - Voice channels (voice/video)
  - They're separate channels but in the same server

**Backend Architecture:**
- **Same service** (Discord backend)
- But **different data models**:
  - Text messages: Stored in message table
  - Voice connections: Managed by voice service
  - Different endpoints, different handling

**Key Insight**: Same service, but different models and endpoints.

---

### Zoom

**User Experience:**
- Meeting has in-meeting chat
- Chat persists after meeting ends
- Video and chat in same meeting context

**Backend Architecture:**
- **Separate services**:
  - Chat Service: Text messages
  - Video Service: Video/audio streaming
  - Meeting Service: Coordinates both

**Key Insight**: Similar to Teams - linked but separate services.

---

## Key Patterns

### Pattern 1: Linked Services (Teams, Zoom)
- **User sees**: One "meeting" with video + chat
- **Backend**: Separate services that are linked
- **Data**: Different models (chat messages vs video streams)
- **Coordination**: Meeting service links them

### Pattern 2: Separate Apps (FaceTime/iMessage)
- **User sees**: Different apps
- **Backend**: Completely separate services
- **Data**: No shared data model
- **Coordination**: User contacts link them

### Pattern 3: Same Service, Different Models (Discord)
- **User sees**: Different channels in same server
- **Backend**: Same service, different endpoints
- **Data**: Different models (text vs voice)
- **Coordination**: Server/room links them

---

## What This Means for Our AR Design

### Current Design: Separate Service (Like FaceTime/iMessage)
- AR Conversations Service: Separate from Chat Service
- Different endpoints, different models
- No shared "room" concept

### Alternative 1: Linked Services (Like Teams/Zoom)
- **Same room service**, but AR rooms have different capabilities
- Chat Service manages rooms
- AR Conversations Service handles AR-specific logic
- They're linked via room ID

**Pros:**
- ✅ Unified room concept (user sees "rooms" in one place)
- ✅ Can query "all user rooms" together
- ✅ Simpler user mental model

**Cons:**
- ❌ Still need separate services (AR logic is different)
- ❌ Room service needs to know about AR capabilities
- ❌ More coupling between services

### Alternative 2: Same Service, Different Models (Like Discord)
- **Same service** (Chat Service)
- **Different endpoints**: `/api/rooms/:id/chat` vs `/api/rooms/:id/ar`
- **Different models**: Chat messages vs AR messages
- **Same room**, different capabilities

**Pros:**
- ✅ Single service to maintain
- ✅ Unified room concept
- ✅ Can share room management logic

**Cons:**
- ❌ Different event flows (streaming vs complete messages)
- ❌ Different data models (AR doesn't need audioUrl)
- ❌ Service becomes more complex

---

## Recommendation: Hybrid Approach (Linked Services)

**Best of both worlds:**

1. **Room Service** manages all rooms (including AR rooms)
   - Room has `type: 'chat' | 'ar' | 'group'`
   - Room has `capabilities: ['chat', 'ar']` (can have both)

2. **Chat Service** handles regular chat messages
   - Only processes rooms with `type: 'chat'` or `capabilities.includes('chat')`

3. **AR Conversations Service** handles AR-specific logic
   - Only processes rooms with `type: 'ar'` or `capabilities.includes('ar')`
   - Manages AR messages, streaming, tokens

4. **Room Service** links them:
   - `GET /api/rooms` returns all rooms (can filter by type)
   - `GET /api/rooms/:id` returns room with capabilities
   - Client decides which service to use based on capabilities

**Example:**
```typescript
// Room model (Room Service)
{
  id: "room-123",
  type: "ar",
  capabilities: ["ar", "chat"], // Can have both!
  userId: "user-1",
  agentId: "agent-1",
}

// Client checks capabilities
if (room.capabilities.includes('ar')) {
  // Use AR Conversations Service
  connectToAR(room.id);
}
if (room.capabilities.includes('chat')) {
  // Use Chat Service
  connectToChat(room.id);
}
```

**Benefits:**
- ✅ Unified room concept (like Teams)
- ✅ Separate services for different logic (like Teams backend)
- ✅ Can have rooms with both capabilities (future-proof)
- ✅ Clear separation of concerns

**Trade-offs:**
- ⚠️ Room Service needs to know about AR (but just metadata)
- ⚠️ More coordination between services
- ✅ But cleaner than forcing everything into one service

---

## Updated Recommendation

**Use Linked Services Pattern (Like Teams/Zoom):**

1. **Room Service**: Manages all rooms, including AR rooms
   - Room has `type` and `capabilities`
   - AR rooms have `type: 'ar'` and `capabilities: ['ar']`

2. **Chat Service**: Handles regular chat (existing)
   - Only processes rooms with chat capability

3. **AR Conversations Service**: Handles AR-specific logic (new)
   - Only processes rooms with AR capability
   - Manages AR messages, streaming, tokens

4. **Filtering**: Room Service filters AR rooms from regular listings
   - `GET /api/rooms?excludeAR=true` (default)
   - `GET /api/ar-rooms` (AR-specific endpoint)

**This gives us:**
- ✅ Unified room concept (user-friendly)
- ✅ Separate services (clean architecture)
- ✅ Privacy guarantee (filtering at room service level)
- ✅ Future-proof (can add capabilities later)

---

## Comparison

| Approach | User Experience | Backend Complexity | Privacy | Scalability |
|---------|----------------|-------------------|---------|-------------|
| **Separate Service** (Current) | Different endpoints | Simple | Guaranteed | Independent |
| **Linked Services** (Recommended) | Unified rooms | Medium | Filtered | Independent |
| **Same Service** | Unified rooms | Complex | Filtered | Shared |

**Winner**: Linked Services (like Teams/Zoom) - best balance of user experience and clean architecture.

