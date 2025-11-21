# Handling Blocked, Restricted, Removed, and Deleted Accounts in Friendship Projection

## Overview

The friend-suggestions service must filter out and handle:
1. **Blocked users** - Users who have blocked the requester or vice versa
2. **Removed friendships** - Friendships that were removed (not just declined)
3. **Deleted users** - Accounts that have been deleted
4. **Deleted profiles** - Profiles that have been deleted
5. **Restricted accounts** - Users with restricted status (if applicable)

## Event-Driven Approach ✅

All filtering is done via Kafka events - **no direct service calls**.

## Events to Handle

### 1. User Deletion
- **Event**: `UserDeletedEvent`
- **Action**: Remove all friendship edges involving this user
- **Impact**: User cannot be suggested, cannot appear in mutual friend calculations

### 2. Profile Deletion
- **Event**: `ProfileDeletedEvent`
- **Action**: Remove user from suggestions (but keep friendship edges for mutual calculations)
- **Impact**: User cannot be suggested, but existing friendships remain for mutual calculations

### 3. Friendship Blocked/Removed
- **Event**: `FriendshipUpdatedEvent` with `status: 'blocked'` or `status: 'removed'`
- **Action**: Remove friendship edges, add to block list
- **Impact**: Blocked users cannot be suggested, cannot appear in mutual calculations

### 4. User Status Changes
- **Event**: `UserUpdatedEvent` with `status: 'deleted'` or `status: 'restricted'`
- **Action**: Mark user as non-suggestible, filter from results
- **Impact**: User filtered from suggestions but edges remain (for cleanup)

## Data Model Extensions

### FriendshipEdge Model (Enhanced)
```typescript
interface FriendshipEdge {
  userId: string;           // Indexed
  friendId: string;         // Indexed
  status: 'accepted' | 'blocked' | 'removed';
  createdAt: Date;
  deletedAt?: Date;         // Soft delete for cleanup
}
```

### UserStatus Projection
```typescript
interface UserStatusProjection {
  userId: string;           // Indexed, unique
  status: 'active' | 'deleted' | 'restricted';
  isDeleted: boolean;
  isSuggestible: boolean;   // Computed: !isDeleted && status !== 'restricted'
  deletedAt?: Date;
  updatedAt: Date;
}
```

### ProfileStatus Projection
```typescript
interface ProfileStatusProjection {
  userId: string;           // Indexed, unique
  profileId: string;
  isDeleted: boolean;
  isSuggestible: boolean;   // Computed: !isDeleted
  deletedAt?: Date;
  updatedAt: Date;
}
```

### BlockList Projection
```typescript
interface BlockListProjection {
  userId: string;           // Indexed
  blockedUserId: string;   // Indexed
  blockedAt: Date;
  // Index: {userId: 1, blockedUserId: 1} unique
}
```

## Event Listeners

### 1. UserDeletedListener
```typescript
async onMessage(data: UserDeletedEvent['data']) {
  // Remove all friendship edges where this user is involved
  await Promise.all([
    FriendshipEdge.deleteMany({ userId: data.id }),
    FriendshipEdge.deleteMany({ friendId: data.id }),
    UserStatusProjection.updateOne(
      { userId: data.id },
      { $set: { status: 'deleted', isDeleted: true, isSuggestible: false, deletedAt: new Date() } },
      { upsert: true }
    ),
    // Remove from all projections
    PopularUser.deleteMany({ userId: data.id }),
    NewUser.deleteMany({ userId: data.id }),
    MutualSuggestion.deleteMany({ $or: [{ userId: data.id }, { candidateId: data.id }] }),
  ]);
}
```

### 2. ProfileDeletedListener
```typescript
async onMessage(data: ProfileDeletedEvent['data']) {
  // Mark profile as deleted, but keep friendship edges for mutual calculations
  await ProfileStatusProjection.updateOne(
    { userId: data.user }, // Assuming event has user field
    { $set: { isDeleted: true, isSuggestible: false, deletedAt: new Date() } },
    { upsert: true }
  );
  
  // Remove from suggestion projections
  await Promise.all([
    PopularUser.deleteMany({ userId: data.user }),
    NewUser.deleteMany({ userId: data.user }),
    MutualSuggestion.deleteMany({ $or: [{ userId: data.user }, { candidateId: data.user }] }),
  ]);
}
```

### 3. FriendshipUpdatedListener (Enhanced)
```typescript
async onMessage(data: FriendshipUpdatedEvent['data']) {
  if (data.status === 'blocked' || data.status === 'removed') {
    // Remove friendship edges
    await Promise.all([
      FriendshipEdge.deleteMany({
        $or: [
          { userId: data.requester, friendId: data.recipient },
          { userId: data.recipient, friendId: data.requester },
        ],
      }),
      // Add to block list (bidirectional for safety)
      BlockListProjection.updateOne(
        { userId: data.requester, blockedUserId: data.recipient },
        { $set: { blockedAt: new Date() } },
        { upsert: true }
      ),
      BlockListProjection.updateOne(
        { userId: data.recipient, blockedUserId: data.requester },
        { $set: { blockedAt: new Date() } },
        { upsert: true }
      ),
      // Remove from mutual suggestions
      MutualSuggestion.deleteMany({
        $or: [
          { userId: data.requester, candidateId: data.recipient },
          { userId: data.recipient, candidateId: data.requester },
        ],
      }),
    ]);
  } else if (data.status === 'accepted') {
    // Add friendship edges (bidirectional)
    await Promise.all([
      FriendshipEdge.updateOne(
        { userId: data.requester, friendId: data.recipient },
        { $set: { status: 'accepted', createdAt: new Date() } },
        { upsert: true }
      ),
      FriendshipEdge.updateOne(
        { userId: data.recipient, friendId: data.requester },
        { $set: { status: 'accepted', createdAt: new Date() } },
        { upsert: true }
      ),
      // Remove from block list if exists
      BlockListProjection.deleteMany({
        $or: [
          { userId: data.requester, blockedUserId: data.recipient },
          { userId: data.recipient, blockedUserId: data.requester },
        ],
      }),
    ]);
  }
}
```

### 4. UserUpdatedListener (Enhanced)
```typescript
async onMessage(data: UserUpdatedEvent['data']) {
  const isSuggestible = data.status !== 'deleted' && data.status !== 'restricted';
  
  await UserStatusProjection.updateOne(
    { userId: data.id },
    {
      $set: {
        status: data.status,
        isDeleted: data.status === 'deleted',
        isSuggestible,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  
  // If user becomes non-suggestible, remove from suggestion projections
  if (!isSuggestible) {
    await Promise.all([
      PopularUser.deleteMany({ userId: data.id }),
      NewUser.deleteMany({ userId: data.id }),
      MutualSuggestion.deleteMany({ $or: [{ userId: data.id }, { candidateId: data.id }] }),
    ]);
  }
}
```

## Filtering in Ranking Engine

### Enhanced getSuggestions Method
```typescript
async getSuggestions(userId: string, options: RankingOptions): Promise<Suggestion[]> {
  // Get block list for this user
  const blockedUsers = await BlockListProjection.find({ userId }).select('blockedUserId').lean();
  const blockedSet = new Set(blockedUsers.map(b => b.blockedUserId));
  
  // Get non-suggestible users
  const nonSuggestibleUsers = await UserStatusProjection.find({ isSuggestible: false }).select('userId').lean();
  const nonSuggestibleSet = new Set(nonSuggestibleUsers.map(u => u.userId));
  
  const nonSuggestibleProfiles = await ProfileStatusProjection.find({ isSuggestible: false }).select('userId').lean();
  nonSuggestibleProfiles.forEach(p => nonSuggestibleSet.add(p.userId));
  
  // Combined exclusion set
  const excludeSet = new Set([...blockedSet, ...nonSuggestibleSet]);
  
  const suggestions: Suggestion[] = [];
  
  if (options.includeMutuals) {
    const mutuals = await MutualSuggestion.find({ userId })
      .sort({ mutualCount: -1 })
      .limit(20)
      .lean();
    
    // Filter out blocked/non-suggestible users
    mutuals
      .filter(m => !excludeSet.has(m.candidateId))
      .forEach((mutual) => {
        suggestions.push({
          userId: mutual.candidateId,
          reason: 'mutual',
          mutualCount: mutual.mutualCount,
          username: mutual.username,
          fullName: mutual.fullName,
          profilePicture: mutual.profilePicture,
        });
      });
  }
  
  if (suggestions.length === 0 && options.includePopularUsers) {
    const popular = await PopularUser.find()
      .sort({ score: -1 })
      .limit(10)
      .lean();
    
    popular
      .filter(p => !excludeSet.has(p.userId))
      .forEach((p) => {
        suggestions.push({
          userId: p.userId,
          reason: 'popular',
          username: p.username,
          fullName: p.fullName,
          profilePicture: p.profilePicture,
        });
      });
  }
  
  if (suggestions.length < 20 && options.includeNewUsers) {
    const already = new Set(suggestions.map((s) => s.userId));
    const needed = 20 - suggestions.length;
    
    if (needed > 0) {
      const newUsers = await NewUser.find()
        .sort({ createdAtMs: -1 })
        .limit(needed * 2) // Fetch extra to account for filtering
        .lean();
      
      newUsers
        .filter(n => !already.has(n.userId) && !excludeSet.has(n.userId))
        .slice(0, needed)
        .forEach((n) => {
          suggestions.push({
            userId: n.userId,
            reason: 'new',
            username: n.username,
            fullName: n.fullName,
          });
        });
    }
  }
  
  return suggestions;
}
```

## Mutual Friend Computation (Filtered)

```typescript
async getMutualCount(userId: string, candidateId: string): Promise<number> {
  // Check if either user is blocked or non-suggestible
  const [userStatus, candidateStatus] = await Promise.all([
    UserStatusProjection.findOne({ userId }),
    UserStatusProjection.findOne({ userId: candidateId }),
  ]);
  
  if (!userStatus?.isSuggestible || !candidateStatus?.isSuggestible) {
    return 0;
  }
  
  // Check block list
  const isBlocked = await BlockListProjection.findOne({
    $or: [
      { userId, blockedUserId: candidateId },
      { userId: candidateId, blockedUserId: userId },
    ],
  });
  
  if (isBlocked) {
    return 0;
  }
  
  // Compute mutual friends (only from active, non-blocked friendships)
  const [userFriends, candidateFriends] = await Promise.all([
    FriendshipEdge.find({ userId, status: 'accepted' }).select('friendId').lean(),
    FriendshipEdge.find({ userId: candidateId, status: 'accepted' }).select('friendId').lean(),
  ]);
  
  const userFriendSet = new Set(userFriends.map(f => f.friendId));
  return candidateFriends.filter(f => userFriendSet.has(f.friendId)).length;
}
```

## Indexes

```typescript
// FriendshipEdge
{ userId: 1, friendId: 1 } // Unique compound index
{ userId: 1, status: 1 }
{ friendId: 1, status: 1 }

// UserStatusProjection
{ userId: 1 } // Unique
{ isSuggestible: 1 }

// ProfileStatusProjection
{ userId: 1 } // Unique
{ isSuggestible: 1 }

// BlockListProjection
{ userId: 1, blockedUserId: 1 } // Unique compound index
{ userId: 1 }
{ blockedUserId: 1 }
```

## Cleanup Jobs (Optional)

Periodic cleanup to remove soft-deleted edges:
```typescript
// Run daily
async function cleanupDeletedEdges() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // 30 days retention
  
  await FriendshipEdge.deleteMany({
    deletedAt: { $exists: true, $lt: cutoff },
  });
}
```

## Summary

✅ **Event-Driven**: All filtering via Kafka events, no service calls  
✅ **Comprehensive**: Handles deleted users, deleted profiles, blocked, removed  
✅ **Efficient**: Indexed lookups, batch filtering  
✅ **Safe**: Bidirectional block lists, soft deletes for audit  
✅ **Scalable**: Can handle millions of users with proper indexes

