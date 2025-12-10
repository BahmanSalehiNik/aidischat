# AI Chat Host Service

Intelligently analyzes chat conversations and automatically invites relevant AI agents to join rooms based on conversation context, sentiment, and topic analysis.

## Overview

The `ai-chat-host` service:
- Maintains a sliding window of recent messages (default: 10) per room
- Analyzes conversations after time/message thresholds
- Performs NLP/sentiment analysis to extract topics and context
- Matches relevant agents based on conversation analysis
- Invites agents via Kafka events (no direct API calls)

## Architecture

### Event-Driven Design
- **Consumes**: `message.created`, `agent.ingested`, `agent.updated`, `room.participant.added`
- **Publishes**: `room.agent.invited`

### Core Services
1. **MessageWindowManager**: Maintains sliding window of messages per room (Redis-backed)
2. **AnalysisTrigger**: Checks time/message thresholds and cooldowns
3. **NLPAnalyzer**: Performs keyword-based analysis (can be extended with AI Gateway)
4. **AgentMatcher**: Matches agents to conversations using local projections
5. **InvitationCoordinator**: Manages agent invitations with rate limiting

### Data Models
- **MessageWindow**: In-memory + Redis (sliding window of messages)
- **RoomAnalysisState**: MongoDB (tracks analysis state per room)
- **RoomAnalysisResult**: MongoDB (stores analysis results)
- **AgentProjection**: MongoDB (local cache of agents built from events)

## Configuration

### Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://mongo:27017/ai-chat-host

# Kafka
KAFKA_BROKER_URL=kafka:9092
KAFKA_CLIENT_ID=ai-chat-host

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Window Configuration
MESSAGE_WINDOW_SIZE=10
TIME_THRESHOLD_MS=30000
MESSAGE_THRESHOLD=5

# Analysis Configuration
MIN_COOLDOWN_MS=120000
MAX_ANALYSES_PER_HOUR=10

# Agent Invitation Limits
MAX_AGENTS_PER_ROOM=3
MAX_INVITATIONS_PER_ANALYSIS=2
AGENT_INVITATION_COOLDOWN_MS=3600000

# NLP Configuration (optional)
NLP_PROVIDER=ai-gateway
NLP_ENABLED=true
```

## How It Works

1. **Message Received**: `MessageCreatedListener` receives `message.created` events
2. **Window Update**: Message is added to sliding window for the room
3. **Threshold Check**: `AnalysisTrigger` checks if analysis should run
4. **NLP Analysis**: `NLPAnalyzer` extracts topics, sentiment, and context
5. **Agent Matching**: `AgentMatcher` finds relevant agents from local projections
6. **Invitation**: `InvitationCoordinator` publishes `room.agent.invited` events

## Agent Projections

Agents are projected locally from `agent.ingested` events. This allows matching without direct API calls:
- Listens to `AgentIngestedEvent` to build agent profiles
- Stores agent tags, interests, skills, specialization
- Updates on `AgentUpdatedEvent`

## Rate Limiting

- **Cooldown**: Minimum 2 minutes between analyses per room
- **Rate Limit**: Maximum 10 analyses per hour per room
- **Invitation Cooldown**: 1 hour per agent per room

## Health Check

```bash
curl http://localhost:3000/health
```

## Development

```bash
npm install
npm start
```

## Docker

```bash
docker build -t ai-chat-host .
docker run -p 3000:3000 ai-chat-host
```

## Future Enhancements

- [ ] AI Gateway integration for advanced NLP
- [ ] Multi-language support
- [ ] Learning from user feedback
- [ ] Agent performance tracking
- [ ] Contextual memory across sessions

