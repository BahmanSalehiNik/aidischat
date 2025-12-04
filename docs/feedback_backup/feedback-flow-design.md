# Feedback Flow Design

## Overview

The feedback system collects implicit signals from chat interactions (replies and reactions to agent messages) and converts them into structured feedback for the RLHF service.

## Data Flow

```
Chat Service (message-reply/reaction-ingested listeners)
    ↓
Detects if original message is from agent (senderType === 'agent')
    ↓
Publishes: feedback.reply.received OR feedback.reaction.received
    ↓
Feedback Service (listeners)
    ↓
Creates/updates Feedback records in MongoDB
    ↓
Immediately publishes: feedback.created
    ↓
RLHF Service (agent-learning)
    ↓
Processes feedback, updates projections, emits policy updates
```

## Event Flow Details

### 1. Reply to Agent Message

**Trigger**: User (human or AI) replies to a message created by an agent

**Chat Service** (`message-reply-ingested-listener.ts`):
- Receives `chat.message.reply.ingested` event
- Loads original message from DB
- Checks if `originalMessage.senderType === 'agent'`
- If yes, publishes `feedback.reply.received` with:
  - `agentId`: The agent who created the original message
  - `agentMessageContent`: Content of the agent's message
  - `replySenderId`, `replySenderType`: Who replied (human/agent)
  - `replyContent`: Content of the reply

**Feedback Service** (`feedback-reply-received-listener.ts`):
- Receives `feedback.reply.received` event
- Calculates reward: `0.4` (positive engagement signal)
- Creates/updates Feedback record:
  - `feedbackType: 'implicit'`
  - `source: 'chat'`
  - `sourceId: messageId` (the reply message ID)
  - `value: 0.4`
- Immediately publishes `feedback.created` event for RLHF service

### 2. Reaction to Agent Message

**Trigger**: User (human or AI) reacts to a message created by an agent

**Chat Service** (`message-reaction-ingested-listener.ts`):
- Receives `chat.message.reaction.ingested` event
- Loads message from DB
- Checks if `message.senderType === 'agent'`
- If yes, publishes `feedback.reaction.received` with:
  - `agentId`: The agent who created the message
  - `agentMessageContent`: Content of the agent's message
  - `reactionUserId`, `reactionUserType`: Who reacted
  - `emoji`: The reaction emoji

**Feedback Service** (`feedback-reaction-received-listener.ts`):
- Receives `feedback.reaction.received` event
- Maps emoji to reward value:
  - `👍` (like): `0.6`
  - `❤️` (love): `0.8`
  - `😂` (laugh): `0.7`
  - `😮` (wow): `0.5`
  - `😢` (sad): `-0.3`
  - `👎` (dislike): `-0.6`
- Creates/updates Feedback record:
  - `feedbackType: 'reaction'`
  - `source: 'chat'`
  - `sourceId: messageId` (the agent message ID)
  - `value`: Based on emoji
- Immediately publishes `feedback.created` event for RLHF service

## Key Design Decisions

1. **No intermediate "ingested" events**: Feedback service processes and immediately publishes `feedback.created`, skipping unnecessary intermediate events.

2. **Immediate processing**: Feedback is processed and published immediately, not batched. The RLHF service handles batching and threshold logic.

3. **Deduplication**: Feedback service checks for existing feedback records using `(userId, agentId, sourceId)` to prevent duplicates.

4. **Reward calculation**: Simple mapping in feedback service; more sophisticated reward calculation happens in RLHF service's RewardCalculator.

5. **Chat service responsibility**: Chat service is responsible for detecting agent messages and publishing feedback events. This keeps the feedback detection logic close to the message handling logic.

## Future Enhancements

- Add explicit feedback collection (thumbs up/down, ratings) via REST API
- Support feedback from posts/comments (not just chat)
- Add rate limiting to prevent feedback spam
- Add feedback aggregation/threshold logic before publishing to RLHF

