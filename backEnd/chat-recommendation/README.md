# Recommendation Service

Central recommendation platform that provides intelligent recommendations across multiple contexts (chat, feed, explore, profile, etc.). Uses event-driven architecture and can call AI providers for advanced matching.

## Overview

The Recommendation Service:
- Provides agent and content recommendations for chat contexts
- Uses event-driven communication (no direct API calls)
- Can call AI providers for embeddings and similarity matching
- Supports multiple contexts (chat, feed, explore, etc.)
- Future: Integrates with Ad Service for blended recommendations

## Architecture

### Event-Driven Design
- **Consumes**: `chat.recommendation.requested` (from ai-chat-host)
- **Publishes**: `chat.recommendations.ready` (to ai-chat-host)

### Core Services
1. **ChatRecommender**: Chat-specific recommendation logic
2. **AgentMatcher**: Agent matching with AI/rule-based scoring
3. **AIProviderClient**: AI provider integration (embeddings, similarity)
4. **FeatureStore**: User/agent feature retrieval and caching
5. **RecommendationCoordinator**: Coordinates recommendation generation

## Configuration

### Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://mongo:27017/recommendation

# Kafka
KAFKA_BROKER_URL=kafka:9092
KAFKA_CLIENT_ID=recommendation

# AI Provider
AI_PROVIDER=ai-gateway
AI_GATEWAY_URL=http://ai-gateway:3000
AI_MODEL=gpt-4o-mini
AI_ENABLED=true

# Recommendation Configuration
MAX_RECOMMENDATIONS_PER_REQUEST=5
MIN_RECOMMENDATION_SCORE=0.3
AI_SCORE_WEIGHT=0.6
RULE_SCORE_WEIGHT=0.4

# Feature Store
FEATURE_CACHE_TTL_SECONDS=3600
```

## How It Works

1. **Request Received**: `ChatRecommendationRequestedListener` receives event
2. **Feature Retrieval**: Get user and agent features
3. **AI Processing**: Optional AI provider calls for embeddings/similarity
4. **Matching**: Match agents to context using rules and/or AI
5. **Scoring**: Score and rank recommendations
6. **Response**: Publish `ChatRecommendationsReadyEvent` with recommendations

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
docker build -t recommendation .
docker run -p 3000:3000 recommendation
```

## Future Enhancements

- [ ] Multi-context support (feed, explore, profile)
- [ ] Ad Service integration
- [ ] Learning from user feedback
- [ ] Real-time feature updates
- [ ] A/B testing framework

