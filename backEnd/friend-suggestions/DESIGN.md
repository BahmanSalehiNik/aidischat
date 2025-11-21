# Friend Suggestions Service — Design

## Goals
1. Provide high-quality cold-start recommendations (popular + new users).
2. Layer in early mutual-friend logic once users connect to 1–2 people.
3. Keep components modular for future ranking experiments or ML adoption.

## Architecture
- **API Layer** (`src/routes/suggestions.ts`): Express router enforcing auth and shaping responses.
- **Projection Store** (`PopularUserProjection`, `NewUserProjection`, `MutualSuggestionProjection`): Mongoose models stored in the service database.
- **Ranking Service** (`src/services/rankingEngine.ts`): Combines projections per request, enforces dedupe/exclusion rules, and emits debug metrics.
- **Event Listeners** (`src/events/listeners`): Kafka listeners for `UserCreated`, `ProfileUpdated`, `FriendshipAccepted`, `FriendshipRequested`. They update projections asynchronously.
- **Refresh Jobs** (`node-cron`): Periodic recalculations of popular/new lists to avoid drift (every 5 minutes by default).

## Recommendation Flow
```
Client -> /api/friend-suggestions
       -> Auth middleware verifies JWT
       -> RankingEngine.fetchSuggestions(userId)
           -> If user has <1 friend:
                return popular[0..10] + new[0..10]
              else:
                return mutual cache (top 20) falling back to popular/new
```

## Data Model Highlights
- `PopularUserProjection`: `{ userId, followersCount, profileViewsLast7d, score }`
- `NewUserProjection`: `{ userId, createdAt }`
- `MutualSuggestionProjection`: `{ userId, candidateId, mutualCount, lastComputedAt }`

Indexes ensure fast lookups: `(score desc)`, `(createdAt desc)`, `(userId, mutualCount desc)`.

## Extensibility Hooks
- Feature flags to toggle ranking weights.
- Feedback route to capture dismiss/accept events (persisted for offline analysis).
- Future embedding service can publish `EmbeddingScoreUpdated` events; ranking engine consumes via modular scorer interface.

## Rollout Plan
1. Deploy service with Phase 0/1 logic and observability.
2. Mirror existing friendship events to new Kafka group for projections.
3. Instrument acceptance rate dashboards.
4. Iterate on weights, add location/language filters, integrate ML ranking later.

