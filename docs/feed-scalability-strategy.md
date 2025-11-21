# Feed Service Scalability Strategy

## Current Architecture Analysis

### Scalability Bottlenecks

#### 1. **Feed Collection (Per-User Storage)**
**Current State:**
- Each user has individual feed entries in `Feed` collection
- Fanout creates N feed entries per post (where N = number of friends/followers)
- Linear growth: `O(users × avg_friends × posts_per_day)`

**Example at Scale:**
- 10M users
- Average 100 friends per user
- 1 post per user per day
- **Feed entries per day**: 10M × 100 = **1 billion entries/day**
- **Storage growth**: ~50-100GB/day (assuming ~50-100 bytes per entry)

**Bottleneck**: Write amplification from fanout

#### 2. **Query Performance**
**Current Queries per Request:**
1. `Feed.find({ userId })` - O(log n) with index ✅
2. `Feed.countDocuments({ userId })` - Can be slow on large collections ⚠️
3. `Feed.findOne({ userId }).sort({ createdAt: -1 })` - O(log n) ✅
4. `Post.find({ _id: { $in: postIds } })` - O(n) for large arrays ⚠️
5. `Profile.find({ userId: { $in: authorIds } })` - O(n) ⚠️
6. `User.find({ _id: { $in: authorIds } })` - O(n) ⚠️
7. `BlockList.find({ userId })` - O(log n) ✅
8. `UserStatus.find({ isSuggestible: false })` - Can be slow ⚠️
9. Recent posts query (new) - O(n) ⚠️

**Bottleneck**: Multiple queries + countDocuments on large collections

#### 3. **Trending Collection**
**Current State:**
- Generic collection with top 100 posts
- Single collection for all users ✅
- Scales well horizontally ✅

**Bottleneck**: None (already optimized)

#### 4. **Fanout Worker**
**Current State:**
- Processes jobs via BullMQ/Redis
- Creates feed entries synchronously
- Can become bottleneck with high post volume

**Bottleneck**: Write throughput limits

## Scaling Strategies

### Phase 1: Horizontal Scaling (Current → 1M Users)

#### 1.1 Application Layer
✅ **Already Scalable:**
- Stateless service (can scale horizontally)
- Uses connection pooling
- Event-driven architecture

**Recommendations:**
- Add load balancer (already have ingress)
- Scale pods based on CPU/memory
- Use read replicas for MongoDB

#### 1.2 Database Layer - Read Replicas
```yaml
# MongoDB Replica Set
Primary: Write operations
Replicas: Read operations (feed queries)
```

**Implementation:**
- Configure MongoDB replica set
- Route reads to replicas
- Route writes to primary

**Benefits:**
- Distribute read load
- Improve query performance
- Handle 10-100x more reads

#### 1.3 Caching Layer
**Add Redis Cache:**

```typescript
// Cache feed responses
const cacheKey = `feed:${userId}:${cursor}:${limit}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... fetch feed ...

await redis.setex(cacheKey, 60, JSON.stringify(feed)); // 60s TTL
```

**Cache Strategy:**
- **Feed responses**: 30-60s TTL
- **User profiles**: 5-10min TTL
- **Trending posts**: 1-2min TTL
- **Block lists**: 5min TTL

**Benefits:**
- Reduce database load by 80-90%
- Faster response times
- Handle traffic spikes

#### 1.4 Query Optimization
**Optimize countDocuments:**
```typescript
// Instead of countDocuments (slow)
const totalUnseenFeeds = await Feed.countDocuments({ 
  userId,
  status: { $in: ['unseen', 'seen'] }
});

// Use aggregation with limit (faster)
const totalUnseenFeeds = await Feed.aggregate([
  { $match: { userId, status: { $in: ['unseen', 'seen'] } } },
  { $limit: MIN_FEED_ITEMS + 1 }, // Only count up to what we need
  { $count: 'total' }
]);
```

**Batch Queries:**
```typescript
// Combine multiple queries
const [feeds, mostRecentFeed, totalUnseen] = await Promise.all([
  Feed.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
  Feed.findOne({ userId }).sort({ createdAt: -1 }).lean(),
  Feed.aggregate([...]) // Optimized count
]);
```

### Phase 2: Database Sharding (1M → 10M+ Users)

#### 2.1 Shard Feed Collection
**Sharding Strategy: User-Based Sharding**

```javascript
// Shard key: userId
sh.shardCollection("feed.feeds", { userId: 1 })
```

**Benefits:**
- Distribute feed entries across shards
- Each shard handles subset of users
- Linear scaling with number of shards

**Challenges:**
- Fanout writes go to multiple shards (acceptable)
- Cross-shard queries (minimize with good shard key)

#### 2.2 Shard Post Collection
**Sharding Strategy: Time-Based or User-Based**

```javascript
// Option 1: User-based (if posts per user are manageable)
sh.shardCollection("feed.posts", { userId: 1 })

// Option 2: Time-based (if posts are time-ordered)
sh.shardCollection("feed.posts", { createdAt: 1 })
```

#### 2.3 Keep Trending Non-Sharded
- Small collection (100-1000 posts)
- Single shard is sufficient
- Fast queries

### Phase 3: Write Path Optimization (10M+ Users)

#### 3.1 Async Fanout with Batching
**Current:** Synchronous fanout per post
**Optimized:** Batch fanout writes

```typescript
// Batch fanout writes
const BATCH_SIZE = 1000;
const feedEntries = recipients.map(uid => ({...}));

// Insert in batches
for (let i = 0; i < feedEntries.length; i += BATCH_SIZE) {
  await Feed.insertMany(
    feedEntries.slice(i, i + BATCH_SIZE),
    { ordered: false }
  );
}
```

#### 3.2 Write-Behind Caching
**Strategy:** Write to cache first, persist to DB asynchronously

```typescript
// Write to Redis first (fast)
await redis.lpush(`feed:${userId}`, JSON.stringify(feedEntry));

// Persist to MongoDB asynchronously (background job)
await backgroundQueue.add('persist-feed', { userId, feedEntry });
```

#### 3.3 Materialized Views / Aggregations
**Pre-compute feed counts:**
```typescript
// Separate collection for feed metadata
FeedMetadata {
  userId: string,
  totalUnseen: number,
  lastFeedTime: Date,
  updatedAt: Date
}

// Update on fanout (single write instead of count)
await FeedMetadata.updateOne(
  { userId },
  { 
    $inc: { totalUnseen: 1 },
    $set: { lastFeedTime: new Date() }
  },
  { upsert: true }
);
```

### Phase 4: Alternative Architectures (50M+ Users)

#### 4.1 Timeline Aggregation (Twitter-style)
**Instead of per-user feed entries, aggregate on read:**

```typescript
// Don't store feed entries
// Instead, aggregate on read:
async function getFeed(userId: string) {
  const friends = await getFriends(userId);
  const posts = await Post.find({
    userId: { $in: friends },
    createdAt: { $gte: lastSeenTime }
  })
  .sort({ createdAt: -1 })
  .limit(limit);
  
  return posts;
}
```

**Pros:**
- No write amplification
- Always fresh
- Lower storage

**Cons:**
- More complex queries
- Slower reads (but cacheable)
- Harder to implement ranking

#### 4.2 Hybrid Approach
**Store feed entries for active users, aggregate for inactive:**

```typescript
if (userIsActive(userId)) {
  // Use stored feed entries (fast)
  return getStoredFeed(userId);
} else {
  // Aggregate on read (slower but acceptable)
  return getAggregatedFeed(userId);
}
```

#### 4.3 Push vs Pull Model
**Current:** Push model (fanout on write)
**Alternative:** Pull model (aggregate on read)

**Hybrid:**
- Push for active users (fast reads)
- Pull for inactive users (lower write cost)

## Recommended Scaling Path

### Immediate (Current → 100K Users)
1. ✅ Add Redis caching
2. ✅ Optimize countDocuments queries
3. ✅ Add database indexes
4. ✅ Use MongoDB read replicas

### Short-term (100K → 1M Users)
1. ✅ Implement query batching
2. ✅ Add materialized views for counts
3. ✅ Optimize fanout batching
4. ✅ Add monitoring and alerting

### Medium-term (1M → 10M Users)
1. ✅ Shard Feed collection (user-based)
2. ✅ Shard Post collection (time-based)
3. ✅ Implement write-behind caching
4. ✅ Add CDN for media URLs

### Long-term (10M+ Users)
1. ✅ Consider timeline aggregation
2. ✅ Implement hybrid push/pull model
3. ✅ Add regional sharding
4. ✅ Consider specialized feed databases (Cassandra, ScyllaDB)

## Performance Targets

### Current Architecture (Unoptimized)
- **Reads**: ~100-200ms per request
- **Writes**: ~50-100ms per fanout
- **Capacity**: ~10K-100K users

### Phase 1 (With Caching + Replicas)
- **Reads**: ~20-50ms per request (cached)
- **Writes**: ~50-100ms per fanout
- **Capacity**: ~1M users

### Phase 2 (With Sharding)
- **Reads**: ~20-50ms per request
- **Writes**: ~50-100ms per fanout (distributed)
- **Capacity**: ~10M-50M users

### Phase 3 (With Aggregation)
- **Reads**: ~50-100ms per request (aggregated)
- **Writes**: ~10-20ms per post (no fanout)
- **Capacity**: 50M+ users

## Monitoring & Metrics

### Key Metrics to Track
1. **Query Performance**
   - P50, P95, P99 latencies
   - Query execution times
   - Index usage

2. **Write Performance**
   - Fanout job processing time
   - Feed entry insertion rate
   - Queue depth

3. **Storage Growth**
   - Feed collection size
   - Growth rate (entries/day)
   - Storage costs

4. **Cache Hit Rates**
   - Feed cache hit rate (target: >80%)
   - Profile cache hit rate
   - Trending cache hit rate

5. **Database Load**
   - Read/write ratio
   - Connection pool usage
   - Replica lag

## Cost Estimation

### Current (10K users)
- **Storage**: ~1GB/month
- **Compute**: 2-4 pods
- **Database**: Single MongoDB instance
- **Cost**: ~$100-200/month

### Phase 1 (1M users)
- **Storage**: ~100GB/month
- **Compute**: 10-20 pods
- **Database**: Primary + 2 replicas
- **Cache**: Redis cluster
- **Cost**: ~$1,000-2,000/month

### Phase 2 (10M users)
- **Storage**: ~1TB/month
- **Compute**: 50-100 pods
- **Database**: Sharded cluster (3-5 shards)
- **Cache**: Redis cluster (larger)
- **Cost**: ~$10,000-20,000/month

## Conclusion

**Current architecture CAN scale to millions of users** with:
1. ✅ Horizontal scaling (application layer)
2. ✅ Read replicas + caching (Phase 1)
3. ✅ Database sharding (Phase 2)
4. ✅ Write optimization (Phase 3)

**Key Success Factors:**
- Proper indexing (already in place ✅)
- Caching strategy (needs implementation)
- Sharding strategy (when needed)
- Monitoring and optimization (ongoing)

**Recommended Next Steps:**
1. Implement Redis caching (highest ROI)
2. Add read replicas
3. Optimize countDocuments queries
4. Monitor and iterate

