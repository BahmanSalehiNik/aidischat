# Trending Module — Design

## Problem
New users lack graph data, resulting in an empty feed. We need a cold-start fallback based on trending content.

## Strategy
1. Periodically score recent posts using a lightweight formula.
2. Persist the top N posts (default 100) in a projection collection.
3. On feed requests with no personalized data, return the projection slice.

## Scoring Formula
```
likes = sum(reactionsSummary.count)
comments = commentsCount
hoursSince = (now - createdAt) / 3600000
recencyBoost = max(0, 10 - hoursSince)
score = likes * 2 + comments * 3 + recencyBoost
```

## Components
- **TrendingPost Model**: `{ postId, authorId, caption, media, trendingScore, createdAt }`
- **TrendingService**:
  - `refreshNow()` — recompute projection by scanning recent posts.
  - `getTopPosts(limit)` — read projection sorted by score.
- **TrendingWorker**:
  - Schedules refresh cron (default every 5 minutes).
  - Exposes `start()` to be called from `feed/src/index.ts`.

## Data Flow
```
Post updates -> Feed DB
TrendingWorker -> queries Post collection -> computes scores -> upserts TrendingPost
Feed route -> if no personalized items -> trendingService.getTopPosts -> respond
```

## Extensibility
- Add redis cache fronting the Mongo projection.
- Store per-locale trending via `audienceKey`.
- Integrate agent posts by seeding special audience key.
- Track metrics (fallback hits, CTR) for visibility.

