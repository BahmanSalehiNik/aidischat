# Search & Trending Feed Filtering Analysis

## Current State

### Search Service
- ❌ **No filtering** for blocked/deleted/restricted users
- ❌ **No filtering** for posts from blocked/deleted users
- ✅ Has search projections (UserSearch, PostSearch, AgentSearch, PageSearch)
- ❌ No event listeners - purely read-only
- ❌ No user status tracking

### Trending Feeds
- ✅ Filters by `visibility: 'public'`
- ✅ Filters posts with media
- ❌ **No filtering** by user status (deleted/blocked/restricted)
- ❌ **No filtering** posts from blocked users
- ❌ No user status tracking

## Requirements

### Search Service
1. **User Search**: Filter out deleted/blocked/restricted users
2. **Post Search**: Filter out posts from deleted/blocked/restricted users
3. **Personalized Blocking**: Don't show users who blocked the searcher (or vice versa)
4. **Event-Driven**: Maintain projections via Kafka events

### Trending Feeds
1. **User Status**: Exclude posts from deleted/blocked/restricted users
2. **Personalized Blocking**: Don't show posts from users who blocked the viewer (or vice versa)
3. **Event-Driven**: Filter during refresh and at query time

## Design Decisions

### Option 1: Lightweight Status Projections (Recommended)
**Approach**: Each service maintains minimal status projections
- **Search Service**: `UserStatus`, `BlockList` (user-specific)
- **Feed Service**: `UserStatus`, `BlockList` (user-specific)

**Pros**:
- ✅ Event-driven, no service calls
- ✅ Minimal storage (only status flags)
- ✅ Fast filtering (indexed lookups)
- ✅ Personalized blocking per user

**Cons**:
- ⚠️ Some data duplication (but minimal - just status flags)
- ⚠️ Must process all user/block events

### Option 2: Query-Time Filtering Only
**Approach**: Filter at query time by checking status in search/trending collections

**Pros**:
- ✅ No additional projections
- ✅ Simple implementation

**Cons**:
- ❌ Requires adding status fields to search/trending models
- ❌ Can't handle personalized blocking (would need block list per user)
- ❌ Less efficient (can't use indexes effectively)

### Option 3: Shared Status Service
**Approach**: Query a shared status service

**Cons**:
- ❌ Direct service calls (violates architecture)
- ❌ Network latency
- ❌ Coupling between services

## Recommended Solution: Option 1 (Lightweight Projections)

### Search Service Implementation

#### Models Needed
1. **UserStatusProjection** (same as friend-suggestions)
   - `userId`, `status`, `isDeleted`, `isSuggestible`
   
2. **BlockListProjection** (same as friend-suggestions)
   - `userId`, `blockedUserId`
   - **Note**: For search, we need to check if searcher is blocked by result user

3. **PostAuthorStatus** (new - tracks post author status)
   - `postId`, `authorId`, `isAuthorDeleted`, `isAuthorBlocked`
   - Updated via PostCreated/PostUpdated events

#### Event Listeners
- `UserCreatedListener` - Initialize status
- `UserUpdatedListener` - Update status
- `UserDeletedListener` - Mark as deleted
- `ProfileDeletedListener` - Mark profile as deleted
- `FriendshipUpdatedListener` - Track blocks (status: 'blocked')
- `PostCreatedListener` - Track post author
- `PostUpdatedListener` - Update post author status

#### Filtering Logic
```typescript
// In searchUsers()
const excludeSet = await getExclusionSet(searcherUserId);
const results = await UserSearch.find({ $text: { $search: query } })
  .where('userId').nin(Array.from(excludeSet))
  .limit(limit);

// In searchPosts()
const excludeSet = await getExclusionSet(searcherUserId);
const results = await PostSearch.find({ $text: { $search: query } })
  .populate('authorId') // or join
  .where('authorId').nin(Array.from(excludeSet))
  .limit(limit);
```

### Trending Feeds Implementation

#### Models Needed
1. **UserStatusProjection** (same as search)
2. **BlockListProjection** (same as search)

#### Event Listeners
- Same as search service (user status, blocks)

#### Filtering Logic
```typescript
// In refreshTrendingProjection()
const excludeUserIds = await UserStatus.find({ 
  isSuggestible: false 
}).select('userId').lean();
const excludeSet = new Set(excludeUserIds.map(u => u.userId));

const posts = await Post.find({ 
  visibility: 'public',
  userId: { $nin: Array.from(excludeSet) }
})
  .sort({ createdAt: -1 })
  .limit(500)
  .lean();

// In getTopPosts() - also filter by viewer's block list
async function getTopPosts(limit: number, viewerUserId?: string) {
  let query: any = {};
  
  if (viewerUserId) {
    const blockedUsers = await BlockList.find({ userId: viewerUserId })
      .select('blockedUserId').lean();
    const blockedSet = new Set(blockedUsers.map(b => b.blockedUserId));
    
    // Get posts, then filter by blocked authors
    const posts = await TrendingPost.find()
      .sort({ trendingScore: -1 })
      .limit(limit * 2) // Fetch extra for filtering
      .lean();
    
    return posts
      .filter(p => !blockedSet.has(p.authorId))
      .slice(0, limit);
  }
  
  return TrendingPost.find(query)
    .sort({ trendingScore: -1 })
    .limit(limit)
    .lean();
}
```

## Implementation Plan

### Search Service
1. ✅ Create `UserStatus` and `BlockList` models
2. ✅ Add event listeners for user/profile/friendship events
3. ✅ Update `searchEngine.ts` with filtering logic
4. ✅ Add `getExclusionSet()` method (similar to friend-suggestions)
5. ✅ Filter user search results
6. ✅ Filter post search results (by author status)

### Trending Feeds
1. ✅ Create `UserStatus` and `BlockList` models in feed service
2. ✅ Add event listeners for user/profile/friendship events
3. ✅ Update `trendingService.ts` to filter during refresh
4. ✅ Update `getTopPosts()` to filter by viewer's block list
5. ✅ Pass `viewerUserId` from `getFeed.ts` to `getTopPosts()`

## Storage Considerations

### Search Service
- UserStatus: ~1KB per user (minimal)
- BlockList: ~50 bytes per block relationship
- For 1M users: ~1GB (manageable)

### Feed Service
- Same as search service
- For 1M users: ~1GB (manageable)

## Performance Considerations

### Search Service
- Exclusion set lookup: ~10ms (indexed)
- Filtering in queries: Minimal overhead (MongoDB `$nin` is efficient)
- Impact: <5% query time increase

### Trending Feeds
- Refresh filtering: Minimal (already scanning posts)
- Query-time filtering: ~5ms for block list lookup
- Impact: <2% response time increase

## Edge Cases

1. **User blocks someone after post is trending**
   - Solution: Filter at query time (getTopPosts with viewerUserId)

2. **User deletes account after post is trending**
   - Solution: Event listener removes from trending projection on next refresh

3. **User status changes (suspended → active)**
   - Solution: Event listener updates status, next refresh includes their posts

4. **Block is removed**
   - Solution: Event listener removes from block list, next query includes user

## Summary

✅ **Both services need filtering**:
- Search: Filter users and posts from blocked/deleted users
- Trending: Filter posts from blocked/deleted users

✅ **Event-driven approach**:
- Maintain lightweight status projections
- No direct service calls
- Consistent with friend-suggestions architecture

✅ **Personalized blocking**:
- Block list per user
- Filter at query time for personalized results

