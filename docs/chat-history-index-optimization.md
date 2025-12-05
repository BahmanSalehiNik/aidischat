# Chat History Service - Index Optimization for Read Performance

## Overview

The chat-history service is optimized for read operations (CQRS pattern), where writes happen through Kafka events and reads are the primary workload. This document outlines the optimized index strategy.

## Index Strategy Principles

1. **Compound indexes over single-field indexes**: Compound indexes support multiple query patterns efficiently
2. **Index order matters**: Left-to-right prefix matching - most selective fields first
3. **Include sort fields**: Include sort fields in compound indexes to avoid in-memory sorts
4. **Remove redundant indexes**: Eliminate duplicate single-field indexes covered by compound indexes

## Session Model Indexes

### Index 1: Primary Participant Query
```javascript
{ participantId: 1, participantType: 1, startTime: -1 }
```
**Covers:**
- `getSessionsByParticipant()` - Get all sessions for a participant, sorted by startTime
- Most common query pattern

**Query Example:**
```javascript
Session.find({ participantId, participantType }).sort({ startTime: -1 })
```

### Index 2: Participant + Room Query
```javascript
{ participantId: 1, participantType: 1, roomId: 1, startTime: -1 }
```
**Covers:**
- `getSessionsByParticipant()` with roomId filter
- Get sessions for a participant in a specific room

**Query Example:**
```javascript
Session.find({ participantId, participantType, roomId }).sort({ startTime: -1 })
```

### Index 3: Active Session Lookup
```javascript
{ roomId: 1, participantId: 1, participantType: 1, endTime: 1, lastActivityTime: 1 }
```
**Covers:**
- `getOrCreateActiveSession()` - Finding active sessions
- Critical for session continuation logic

**Query Example:**
```javascript
Session.find({ 
  roomId, participantId, participantType, 
  endTime: { $exists: false },
  lastActivityTime: { $gte: threshold }
})
```

### Index 4: Ended Sessions Filter
```javascript
{ participantId: 1, participantType: 1, endTime: 1, startTime: -1 }
```
**Covers:**
- `getSessionsByParticipant()` with `includeActive: false`
- Filtering for completed sessions only

**Query Example:**
```javascript
Session.find({ participantId, participantType, endTime: { $exists: true } })
  .sort({ startTime: -1 })
```

### Index 5: Message-to-Session Lookup (First)
```javascript
{ firstMessageId: 1 }
```
**Covers:**
- Finding which session a message belongs to (by first message)
- Message-to-session reverse lookup

### Index 6: Message-to-Session Lookup (Last)
```javascript
{ lastMessageId: 1 }
```
**Covers:**
- Finding which session a message belongs to (by last message)
- Message-to-session reverse lookup

### Index 7: Room-Based Queries
```javascript
{ roomId: 1, startTime: -1 }
```
**Covers:**
- Get all sessions in a room
- Room-level analytics and queries

## MessageSessionLink Model Indexes

### Index 1: Primary Session Messages Query
```javascript
{ sessionId: 1, createdAt: 1 }
```
**Covers:**
- `getMessagesBySession()` - Get messages in chronological order
- Most common query pattern

**Query Example:**
```javascript
MessageSessionLink.find({ sessionId }).sort({ createdAt: 1 })
```

### Index 2: Unique Message Constraint
```javascript
{ messageId: 1 } (unique)
```
**Covers:**
- Idempotency - one session per message
- Fast message-to-session lookup

### Index 3: Participant Messages in Room
```javascript
{ roomId: 1, participantId: 1, participantType: 1, createdAt: 1 }
```
**Covers:**
- Get all messages from a participant in a room
- Participant-based message queries

**Query Example:**
```javascript
MessageSessionLink.find({ roomId, participantId, participantType })
  .sort({ createdAt: 1 })
```

### Index 4: Reverse Chronological Order
```javascript
{ sessionId: 1, createdAt: -1 }
```
**Covers:**
- Get messages in reverse chronological order
- Alternative sorting for pagination

## Index Optimization Benefits

### Before Optimization
- ❌ Duplicate indexes (warnings in logs)
- ❌ Single-field indexes that don't support compound queries
- ❌ Missing indexes for common query patterns
- ❌ Inefficient sorting (in-memory sorts)

### After Optimization
- ✅ No duplicate indexes
- ✅ Compound indexes cover all query patterns
- ✅ Sort operations use indexes (no in-memory sorts)
- ✅ Optimal index order for query selectivity
- ✅ All common queries are index-covered

## Query Performance Impact

### Session Queries
- **Before**: Multiple index scans + in-memory sort
- **After**: Single index scan with sorted results

### Message Queries
- **Before**: Collection scan or inefficient index usage
- **After**: Direct index lookup with sorted results

### Active Session Lookup
- **Before**: Multiple queries or full collection scan
- **After**: Single compound index query

## Index Size Considerations

- **Compound indexes**: Slightly larger than single-field, but support multiple queries
- **Trade-off**: Index size vs query performance (read-optimized service prioritizes performance)
- **MongoDB**: Efficiently compresses indexes, so size impact is minimal

## Maintenance

- **Index creation**: Automatic on service startup
- **Index updates**: No manual maintenance required
- **Monitoring**: Use MongoDB explain() to verify index usage
- **Future**: Add indexes as new query patterns emerge

## Testing

All indexes are validated by the integration test:
- ✅ Session queries use optimal indexes
- ✅ Message queries use optimal indexes
- ✅ No duplicate index warnings
- ✅ All queries perform efficiently

