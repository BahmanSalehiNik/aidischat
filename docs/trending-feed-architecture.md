# Trending Feed Architecture

## Overview
Trending feeds use a **hybrid approach**: generic storage with per-user filtering at query time.

## Storage Model

### Generic Storage (Shared Collection)
Trending posts are stored in a **single, shared collection** (`TrendingPost`) that is **NOT per-user**.

```
TrendingPost Collection (Generic)
├── postId: "abc123"
├── authorId: "user1"
├── content: "Hello world"
├── media: [...]
├── trendingScore: 150
└── createdAt: 2025-11-20
```

**Key Points:**
- One collection for all users
- Contains top N posts (default: 100) globally
- Updated periodically by the worker (every 5 minutes)
- Same trending posts visible to all users (with filtering)

## Selection Process

### Step 1: Worker Refresh (`refreshTrendingProjection`)
```typescript
// 1. Query recent public posts (last 500)
const posts = await Post.find({
  visibility: 'public',
  userId: { $nin: excludeUserIds }, // Exclude deleted/blocked users
})
.sort({ createdAt: -1 })
.limit(500);

// 2. Score each post
const scored = posts.map((post) => ({
  postId: post._id,
  authorId: post.userId,
  content: post.content,
  media: post.media,
  createdAt: post.createdAt,
  trendingScore: computeTrendingScore(post), // likes*2 + comments*3 + recency
}));

// 3. Filter: Only posts with media
.filter((post) => post.media && post.media.length > 0)

// 4. Sort by score (highest first)
.sort((a, b) => b.trendingScore - a.trendingScore)

// 5. Take top N (default: 100)
.slice(0, limit);

// 6. Store in TrendingPost collection
await TrendingPost.bulkWrite(bulk);
```

### Scoring Formula
```typescript
trendingScore = (likes * 2) + (comments * 3) + recencyBoost

where:
- likes = sum of all reaction counts
- comments = commentsCount
- recencyBoost = max(0, 10 - hoursSinceCreation)
```

### Selection Criteria
1. **Visibility**: Only `public` posts
2. **Media Required**: Must have at least one media item
3. **User Status**: Excludes posts from deleted/blocked/restricted users
4. **Recency**: Considers last 500 posts (sorted by creation time)
5. **Engagement**: Prioritizes posts with more likes/comments

## Per-User Filtering (Query Time)

### When User Requests Feed
```typescript
// 1. Check if user has personalized feed entries
const feeds = await Feed.find({ userId }).limit(limit);

// 2. If NO personalized feeds, use trending fallback
if (!feeds.length) {
  const trending = await trendingService.getTopPosts(limit, userId);
  // ↑ Per-user filtering happens here
}
```

### Per-User Filtering Logic
```typescript
async function getTopPosts(limit: number, viewerUserId?: string) {
  // Fetch from generic TrendingPost collection
  const posts = await TrendingPost.find()
    .sort({ trendingScore: -1 })
    .limit(limit * 2) // Fetch extra to account for filtering
    .lean();

  // If viewer provided, filter by their block list
  if (viewerUserId) {
    const blockedUsers = await BlockList.find({ userId: viewerUserId });
    const blockedSet = new Set(blockedUsers.map(b => b.blockedUserId));
    
    // Remove posts from blocked users
    return posts
      .filter(p => !blockedSet.has(p.authorId))
      .slice(0, limit);
  }

  return posts.slice(0, limit);
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Worker Process                       │
│  (Runs every 5 minutes)                                 │
│                                                          │
│  1. Query Post collection (public posts)                │
│  2. Score posts (engagement + recency)                 │
│  3. Filter (media required, exclude bad users)         │
│  4. Sort by score                                       │
│  5. Take top 100                                        │
│  6. Store in TrendingPost collection                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│           TrendingPost Collection (Generic)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Post 1   │  │ Post 2   │  │ Post 3   │  ...        │
│  │ Score:150│  │ Score:120│  │ Score:100│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│  (Shared by ALL users)                                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              User Feed Request                          │
│                                                          │
│  1. Check Feed collection (personalized)               │
│     └─> If empty, use trending fallback                 │
│                                                          │
│  2. Query TrendingPost collection                       │
│                                                          │
│  3. Apply per-user filters:                             │
│     - Block list (remove blocked users' posts)          │
│     - Limit to requested count                          │
│                                                          │
│  4. Return filtered results                             │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Write Path (Worker)
```
Post Created/Updated
    ↓
Worker runs (every 5 min)
    ↓
Query Post collection
    ↓
Score & Filter
    ↓
Store in TrendingPost (generic)
```

### Read Path (User Request)
```
User requests feed
    ↓
Check Feed collection (personalized)
    ↓
If empty → Query TrendingPost (generic)
    ↓
Apply per-user block list filter
    ↓
Return results
```

## Key Design Decisions

### Why Generic Storage?
✅ **Efficiency**: One collection to maintain instead of per-user
✅ **Consistency**: All users see same trending posts (with filtering)
✅ **Performance**: Single query instead of per-user calculations
✅ **Scalability**: Works for millions of users without per-user storage

### Why Per-User Filtering?
✅ **Privacy**: Respects user's block list
✅ **Personalization**: Each user gets filtered results
✅ **Flexibility**: Can add more per-user filters (preferences, location, etc.)

### Trade-offs
- **Storage**: Generic (efficient) ✅
- **Filtering**: Per-user at query time (adds small overhead) ⚠️
- **Consistency**: All users see same trending (may want per-locale in future) ⚠️

## Example Scenario

### Scenario: Two New Users
1. **User A** creates a public post with media
2. **Worker** runs, scores the post, stores in `TrendingPost` (generic)
3. **User B** (new user, no friends) requests feed
4. **System** checks `Feed` collection → empty
5. **System** queries `TrendingPost` → finds User A's post
6. **System** checks User B's block list → empty (no blocks)
7. **System** returns User A's post to User B

### If User B Blocks User A
1. **User B** blocks User A
2. **User B** requests feed
3. **System** queries `TrendingPost` → finds User A's post
4. **System** checks block list → User A is blocked
5. **System** filters out User A's post
6. **System** returns remaining trending posts (or empty if none)

## Future Enhancements

### Potential Improvements
1. **Per-Locale Trending**: Store trending posts per region/language
2. **Per-Interest Trending**: Store trending posts per category/topic
3. **Caching**: Cache filtered results per user (with TTL)
4. **Real-time Updates**: Update trending for hot posts immediately
5. **A/B Testing**: Multiple trending algorithms

### Current Limitations
- All users see same trending (no personalization beyond blocking)
- No per-locale or per-interest trending
- Filtering happens at query time (could be cached)

