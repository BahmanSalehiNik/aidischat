# AR Service Architecture Decision: Flag vs Separate Service

## Two Approaches

### Approach 1: Add `isARConversation` Flag to Existing Room Service
**Implementation:**
- Add `isARConversation: boolean` field to Room model
- Filter AR rooms out of room listings (`GET /api/rooms?excludeAR=true`)
- Use same room service, same message service
- AR-specific logic handled via conditionals

### Approach 2: Separate AR Conversations Service (Current Design)
**Implementation:**
- New `ar-conversations` service with separate models
- Separate MongoDB collection (`ar-rooms`)
- Separate API endpoints (`/api/ar-rooms`)
- Completely isolated from regular chat

---

## Comparison

### Approach 1: Flag-Based (Simpler)

**Pros:**
- ✅ **Less code**: Reuse existing room/message infrastructure
- ✅ **Faster to implement**: Just add a flag and filter
- ✅ **Single source of truth**: All rooms in one place
- ✅ **Easier queries**: Can query all rooms together if needed
- ✅ **Less infrastructure**: No new service to deploy/maintain

**Cons:**
- ❌ **Tight coupling**: AR logic mixed with regular chat logic
- ❌ **Different data models**: AR messages don't need `audioUrl`/`animationUrl` (wasted fields)
- ❌ **Different event flow**: AR uses streaming events (`ARStreamChunkEvent`), not `MessageCreatedEvent`
- ❌ **Different business rules**: AR is always 1-on-1, regular chat can be group
- ❌ **Filtering complexity**: Must remember to filter AR rooms everywhere
- ❌ **Future conflicts**: AR features might conflict with chat features
- ❌ **Scalability**: Can't scale AR independently from chat
- ❌ **Testing complexity**: Need to test both AR and chat paths in same codebase

**Code Example (Flag Approach):**
```typescript
// Room model
const roomSchema = new mongoose.Schema({
  // ... existing fields
  isARConversation: { type: Boolean, default: false },
});

// Get rooms endpoint
router.get('/api/rooms', async (req, res) => {
  const excludeAR = req.query.excludeAR === 'true';
  const query = excludeAR ? { isARConversation: { $ne: true } } : {};
  const rooms = await Room.find(query);
  // ... but what if someone forgets to filter?
});

// Message model - has unused fields for AR
const messageSchema = new mongoose.Schema({
  content: String,
  audioUrl: String,      // ❌ Not needed for AR (client-side TTS)
  animationUrl: String,  // ❌ Not needed for AR (client-side animations)
  // ... but AR messages don't use these
});

// Event handling - complex conditionals
if (room.isARConversation) {
  // Publish ARStreamChunkEvent
} else {
  // Publish MessageCreatedEvent
}
```

---

### Approach 2: Separate Service (Current Design)

**Pros:**
- ✅ **Separation of concerns**: AR logic completely isolated
- ✅ **Optimized data models**: AR messages only have what they need (text, markers)
- ✅ **Independent scaling**: Scale AR service separately from chat
- ✅ **Clear boundaries**: No risk of AR rooms appearing in chat listings
- ✅ **Different event flow**: AR uses `ARStreamChunkEvent`, chat uses `MessageCreatedEvent`
- ✅ **Future-proof**: Can add AR-specific features without affecting chat
- ✅ **Easier testing**: Test AR and chat independently
- ✅ **Team ownership**: Different teams can own different services
- ✅ **Deployment flexibility**: Deploy AR updates without touching chat

**Cons:**
- ❌ **More code**: Need to duplicate some infrastructure (room management)
- ❌ **More services**: Another service to deploy/maintain
- ❌ **Potential duplication**: Some logic might be duplicated (but can be shared via packages)
- ❌ **More complex queries**: Can't easily query "all user rooms" (but that's actually a feature)

**Code Example (Separate Service):**
```typescript
// AR Room model - optimized for AR
const arRoomSchema = new mongoose.Schema({
  userId: String,
  agentId: String,
  status: String,
  // No visibility field (always private)
  // No type field (always 1-on-1)
});

// AR Message model - only what's needed
const arMessageSchema = new mongoose.Schema({
  content: String,      // Text with markers
  markers: [Object],    // Extracted markers
  // No audioUrl, no animationUrl (client-side)
});

// Clear separation - no filtering needed
router.get('/api/ar-rooms', async (req, res) => {
  // Only returns AR rooms, no filtering needed
  const rooms = await ARRoom.find({ userId: req.userId });
});
```

---

## Key Differences

### 1. **Data Model Mismatch**

**Regular Chat Messages:**
```typescript
{
  content: "Hello",
  audioUrl: null,        // Optional, for voice messages
  animationUrl: null,    // Optional, for video messages
  attachments: [...],   // For file sharing
  reactions: [...],      // Emoji reactions
  replies: [...],        // Thread replies
}
```

**AR Messages:**
```typescript
{
  content: "[emotion:happy]Hello! [gesture:wave]",
  markers: [{ type: 'emotion', value: 'happy' }, ...],
  // No audioUrl (client calls TTS directly)
  // No animationUrl (client calls animation provider directly)
  // No attachments (AR doesn't support file sharing)
  // No reactions (AR is real-time, reactions don't make sense)
}
```

**Verdict**: Different data models = separate collections make sense

---

### 2. **Event Flow Mismatch**

**Regular Chat:**
```
User sends message
  → MessageCreatedEvent
    → Chat service stores message
    → Realtime Gateway broadcasts
    → Client receives complete message
```

**AR Chat:**
```
User sends message
  → ARMessageRequestEvent
    → AI Gateway streams response
    → ARStreamChunkEvent (multiple chunks)
    → Realtime Gateway streams chunks
    → Client processes chunks + calls TTS/animation providers
```

**Verdict**: Completely different event flow = separate service makes sense

---

### 3. **Business Rules Mismatch**

**Regular Chat:**
- Can be group chats (multiple participants)
- Can be public/private/invite-only
- Messages are complete when sent
- Supports file attachments, reactions, replies
- Listed in room list

**AR Chat:**
- Always 1-on-1 (user + agent)
- Always private (never listed)
- Messages are streamed (chunks)
- No attachments, reactions, replies
- Not listed in room list

**Verdict**: Different business rules = separate service makes sense

---

### 4. **Privacy Guarantee**

**Flag Approach:**
```typescript
// Easy to forget filtering
const rooms = await Room.find({ userId }); // ❌ Includes AR rooms!

// Must remember everywhere
const rooms = await Room.find({ 
  userId, 
  isARConversation: { $ne: true }  // Easy to forget
});
```

**Separate Service:**
```typescript
// Impossible to accidentally include AR rooms
const rooms = await Room.find({ userId }); // ✅ Only chat rooms

// AR rooms are in completely different collection
const arRooms = await ARRoom.find({ userId }); // ✅ Only AR rooms
```

**Verdict**: Separate service guarantees privacy (can't accidentally leak AR rooms)

---

## Real-World Analogy

**Flag Approach** = Putting AR rooms in the same database table as chat rooms, then filtering them out everywhere.

**Separate Service** = Having a separate "AR Conversations" app (like WhatsApp vs FaceTime).

**Question**: Would you put FaceTime calls in your WhatsApp chat list? No, because they're fundamentally different experiences.

---

## Recommendation: Separate Service

**Why?**
1. **Different data models**: AR messages don't need fields that chat messages have
2. **Different event flow**: Streaming vs complete messages
3. **Different business rules**: 1-on-1 vs group, private vs public
4. **Privacy guarantee**: Can't accidentally leak AR rooms
5. **Future-proof**: AR might need features that don't make sense for chat
6. **Scalability**: Can scale AR independently

**When Flag Approach Makes Sense:**
- If AR and chat were nearly identical (they're not)
- If you need to query "all user rooms" together (you don't)
- If you want to minimize services (but separation is worth it)

---

## Hybrid Approach (Best of Both Worlds?)

**Option**: Keep separate service, but share common utilities via `@aichatwar/shared` package.

```typescript
// Shared utilities
@aichatwar/shared
  - room-utils.ts (common room validation)
  - participant-utils.ts (common participant logic)
  - websocket-utils.ts (common WebSocket helpers)

// AR Service uses shared utilities
import { validateRoomAccess } from '@aichatwar/shared/room-utils';

// Chat Service uses same utilities
import { validateRoomAccess } from '@aichatwar/shared/room-utils';
```

**Result**: Separation of concerns + code reuse where it makes sense.

---

## Final Answer

**Use Separate Service** because:
1. AR and chat are fundamentally different experiences
2. Different data models (AR doesn't need audioUrl/animationUrl)
3. Different event flows (streaming vs complete messages)
4. Different business rules (1-on-1 vs group, private vs public)
5. Privacy guarantee (can't accidentally leak AR rooms)
6. Future-proof (can add AR features without affecting chat)

**The "flag" approach would work**, but it's a code smell - you'd be forcing two different things into the same model, then filtering them apart everywhere. That's technical debt waiting to happen.

