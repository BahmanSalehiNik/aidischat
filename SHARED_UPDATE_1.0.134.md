# Shared Package Update to 1.0.134

## Summary

Updated and published the shared package to version 1.0.134 with the new recommendation events, then updated all services to use the latest version.

## Changes in Shared Package (1.0.134)

### New Events Added

1. **ChatRecommendationRequestedEvent**
   - Published by: `ai-chat-host` service
   - Consumed by: `recommendation` service
   - Contains: requestId, userId, roomId, topics, sentiment, intent, domain, participants, lastMessages, language, etc.

2. **ChatRecommendationsReadyEvent**
   - Published by: `recommendation` service
   - Consumed by: `ai-chat-host` service
   - Contains: requestId, agentRecommendations, utilityRecommendations, metadata

3. **Recommendation Interface**
   - Generic recommendation item supporting: agent, utility, ad, content types
   - Includes: type, agentId, action, label, score, reason, metadata

### New Subjects Added

- `ChatRecommendationRequested = 'chat.recommendation.requested'`
- `ChatRecommendationsReady = 'chat.recommendations.ready'`

## Services Updated

All services have been updated to use `@aichatwar/shared@^1.0.134`:

1. ✅ agent-learning
2. ✅ agent-manager
3. ✅ agents
4. ✅ ai-chat-host
5. ✅ api-gateway
6. ✅ chat
7. ✅ chat-history
8. ✅ eventBus
9. ✅ feedback
10. ✅ feed
11. ✅ friendship
12. ✅ friend-suggestions
13. ✅ game
14. ✅ media
15. ✅ post
16. ✅ realtime-gateway
17. ✅ recommendation
18. ✅ room
19. ✅ search
20. ✅ user
21. ✅ ai/aiGateway
22. ✅ ecommerce/aiModelCards
23. ✅ ecommerce/expiration
24. ✅ ecommerce/orders

## Installation Status

All services have been updated with `npm install @aichatwar/shared@1.0.134`.

## YAML Files

Kubernetes deployment files are already configured correctly:
- ✅ `recommendation-depl.yaml` - Configured with proper environment variables
- ✅ `ai-chat-host-depl.yaml` - Configured with proper environment variables
- ✅ `recommendation-mongo-depl.yaml` - MongoDB deployment
- ✅ `ai-chat-host-mongo-depl.yaml` - MongoDB deployment

## Next Steps

1. **Rebuild Docker Images**: Services need to be rebuilt with the new shared package
2. **Redeploy**: Services should be redeployed to Kubernetes
3. **Test**: Verify that recommendation events are working correctly

## Usage Example

### In ai-chat-host service:
```typescript
import { ChatRecommendationRequestedEvent, Subjects } from '@aichatwar/shared';

// Publish recommendation request
await publisher.publish({
  subject: Subjects.ChatRecommendationRequested,
  data: {
    requestId: '...',
    userId: '...',
    roomId: '...',
    topics: ['...'],
    // ... other fields
  }
});
```

### In recommendation service:
```typescript
import { ChatRecommendationsReadyEvent, Subjects } from '@aichatwar/shared';

// Publish recommendations ready
await publisher.publish({
  subject: Subjects.ChatRecommendationsReady,
  data: {
    requestId: '...',
    agentRecommendations: [...],
    utilityRecommendations: [...],
    metadata: { ... }
  }
});
```

## Version History

- **1.0.134**: Added recommendation events (ChatRecommendationRequested, ChatRecommendationsReady)
- **1.0.133**: Previous version

