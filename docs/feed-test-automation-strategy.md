# Feed Service Test Automation Strategy

## Overview
This document outlines a comprehensive test automation strategy for the feed service, covering unit, integration, functional, and end-to-end (E2E) tests.

## Test Pyramid

```
        /\
       /E2E\        (Few, slow, expensive)
      /------\
     /Integration\  (Some, medium speed)
    /------------\
   /   Unit Tests  \ (Many, fast, cheap)
  /----------------\
```

## Test Categories

### 1. Unit Tests
**Scope**: Individual functions, classes, modules  
**Speed**: Fast (<100ms each)  
**Isolation**: Mocked dependencies  
**Coverage Target**: 80%+

#### Test Areas
- **Trending Service**
  - Score calculation (`computeTrendingScore`)
  - Recency boost (`computeRecencyBoost`)
  - Reaction count (`computeReactionCount`)
  - Post filtering (media required, visibility)
  - Block list filtering

- **Feed Route Handler**
  - Query building
  - Pagination logic
  - Cursor handling
  - Response formatting
  - Media URL signing

- **Models**
  - Schema validation
  - Build methods
  - Transform functions

- **Workers**
  - Cron scheduling
  - Concurrent execution prevention
  - Error handling

### 2. Integration Tests
**Scope**: Service components working together  
**Speed**: Medium (1-5s each)  
**Isolation**: Real database, mocked external services  
**Coverage Target**: Critical paths

#### Test Scenarios

##### Feed Generation
```typescript
describe('Feed Generation Integration', () => {
  - User with friends sees friend posts
  - User without friends sees trending fallback
  - Pagination works correctly
  - Cursor-based pagination
  - Filtering by visibility
  - Blocked users excluded
});
```

##### Trending Projection
```typescript
describe('Trending Projection Integration', () => {
  - Posts scored and ranked correctly
  - Top N posts selected
  - Media requirement enforced
  - Excluded users filtered
  - Projection updated on refresh
});
```

##### Event Listeners
```typescript
describe('Event Listener Integration', () => {
  - PostCreated updates feed projection
  - PostUpdated updates feed projection
  - PostDeleted removes from feed
  - UserCreated creates user projection
  - ProfileCreated creates profile projection
  - FriendshipAccepted creates feed entries
});
```

##### Fanout Worker
```typescript
describe('Fanout Worker Integration', () => {
  - Public posts fanout to all friends
  - Friends-only posts fanout to friends
  - Private posts only to author
  - Author always included
  - Duplicate prevention
});
```

### 3. Functional Tests
**Scope**: Complete user workflows  
**Speed**: Medium-Slow (5-30s each)  
**Isolation**: Real services, test database  
**Coverage Target**: All user-facing features

#### Test Scenarios

##### Cold Start Flow
```typescript
describe('Cold Start Functional Tests', () => {
  test('New user sees trending posts', async () => {
    // 1. Create two new users (no friendships)
    // 2. User1 creates public post with media
    // 3. Trigger trending refresh
    // 4. User2 fetches feed
    // 5. Assert: User2 sees User1's post via trending
  });

  test('New user with no trending sees empty feed', async () => {
    // 1. Create new user
    // 2. No posts exist
    // 3. Fetch feed
    // 4. Assert: Empty feed returned
  });
});
```

##### Feed Personalization
```typescript
describe('Feed Personalization', () => {
  test('User sees friend posts before trending', async () => {
    // 1. Create users A, B, C
    // 2. A and B are friends
    // 3. B creates post
    // 4. C creates post (trending)
    // 5. A fetches feed
    // 6. Assert: B's post appears before C's
  });

  test('Blocked user posts excluded', async () => {
    // 1. Create users A, B
    // 2. A blocks B
    // 3. B creates post
    // 4. A fetches feed
    // 5. Assert: B's post not in feed
  });
});
```

##### Visibility Rules
```typescript
describe('Post Visibility Rules', () => {
  test('Public posts visible to all', async () => {
    // 1. User A creates public post
    // 2. User B (not friend) fetches feed
    // 3. Assert: Post visible via trending
  });

  test('Friends-only posts not in trending', async () => {
    // 1. User A creates friends-only post
    // 2. User B (not friend) fetches feed
    // 3. Assert: Post not in feed
  });

  test('Private posts only to author', async () => {
    // 1. User A creates private post
    // 2. User A fetches feed
    // 3. Assert: Post visible
    // 4. User B fetches feed
    // 5. Assert: Post not visible
  });
});
```

### 4. End-to-End (E2E) Tests
**Scope**: Full system, real infrastructure  
**Speed**: Slow (30s-5min each)  
**Isolation**: Real services, staging environment  
**Coverage Target**: Critical user journeys

#### Test Scenarios

##### Complete User Journey
```typescript
describe('E2E: Complete Feed Journey', () => {
  test('User signs up, creates post, others see it', async () => {
    // 1. User1 signs up via API
    // 2. User1 creates profile
    // 3. User1 uploads media
    // 4. User1 creates post with media
    // 5. Wait for events to propagate
    // 6. Wait for trending refresh
    // 7. User2 signs up
    // 8. User2 fetches feed
    // 9. Assert: User2 sees User1's post
    // 10. Verify database state
  });
});
```

##### Multi-Service Integration
```typescript
describe('E2E: Multi-Service Integration', () => {
  test('Post creation flows through all services', async () => {
    // 1. Create post via post-service
    // 2. Verify post-service DB
    // 3. Verify feed-service received event
    // 4. Verify feed-service DB (Post projection)
    // 5. Verify fanout worker processed
    // 6. Verify feed entries created
    // 7. Verify trending projection updated
    // 8. Fetch feed and verify post appears
  });
});
```

## Test Infrastructure

### Test Database Strategy
- **Unit Tests**: In-memory MongoDB (MongoMemoryServer)
- **Integration Tests**: Dedicated test MongoDB instance
- **Functional Tests**: Isolated test database per test suite
- **E2E Tests**: Staging database (cleaned between runs)

### Test Data Management
```typescript
// Test fixtures
const testUsers = {
  user1: { id: '...', email: 'user1@test.com' },
  user2: { id: '...', email: 'user2@test.com' },
};

const testPosts = {
  publicPost: { content: '...', visibility: 'public' },
  friendsPost: { content: '...', visibility: 'friends' },
};

// Test helpers
async function createTestUser(userData) { ... }
async function createTestPost(userId, postData) { ... }
async function createTestFriendship(user1Id, user2Id) { ... }
async function waitForEventPropagation() { ... }
async function triggerTrendingRefresh() { ... }
```

### Mocking Strategy
- **Kafka**: Mock producer/consumer for unit tests
- **Azure Storage**: Mock for URL signing tests
- **External APIs**: Mock for all tests
- **Time**: Mock Date for time-dependent tests

## Test Organization

### Directory Structure
```
backEnd/feed/
├── src/
│   ├── __tests__/
│   │   ├── unit/
│   │   │   ├── trending/
│   │   │   │   ├── trendingService.test.ts
│   │   │   │   └── trendingWorker.test.ts
│   │   │   ├── routes/
│   │   │   │   └── getFeed.test.ts
│   │   │   └── models/
│   │   ├── integration/
│   │   │   ├── feed-generation.test.ts
│   │   │   ├── trending-projection.test.ts
│   │   │   ├── event-listeners.test.ts
│   │   │   └── fanout-worker.test.ts
│   │   ├── functional/
│   │   │   ├── cold-start.test.ts
│   │   │   ├── personalization.test.ts
│   │   │   └── visibility-rules.test.ts
│   │   └── e2e/
│   │       ├── complete-journey.test.ts
│   │       └── multi-service.test.ts
│   └── test/
│       ├── setup.ts
│       ├── fixtures.ts
│       ├── helpers.ts
│       └── mocks.ts
```

## Test Execution Strategy

### Local Development
```bash
# Run all tests
npm test

# Run by category
npm run test:unit
npm run test:integration
npm run test:functional
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### CI/CD Pipeline
```yaml
stages:
  - unit-tests:      # Fast feedback (< 2 min)
  - integration:     # Medium feedback (< 10 min)
  - functional:      # Before merge (< 20 min)
  - e2e:             # Nightly or on release (< 1 hour)
```

### Test Execution Order
1. **Unit Tests**: Run first, fastest feedback
2. **Integration Tests**: Run after unit tests pass
3. **Functional Tests**: Run before merge
4. **E2E Tests**: Run on schedule or release

## Specific Test Scenarios

### Cold Start Scenarios
```typescript
describe('Cold Start Test Suite', () => {
  // Scenario 1: Two new users, one posts, other sees it
  test('New users see each other posts via trending', async () => {
    const user1 = await createUser('user1@test.com');
    const user2 = await createUser('user2@test.com');
    
    const media = await createMedia(user1.id);
    const post = await createPost(user1.id, {
      content: 'Hello world',
      mediaIds: [media.id],
      visibility: 'public'
    });
    
    await waitForEventPropagation();
    await triggerTrendingRefresh();
    
    const feed = await fetchFeed(user2.id);
    expect(feed.items).toContainEqual(
      expect.objectContaining({ postId: post.id })
    );
    expect(feed.fallback).toBe('trending');
  });

  // Scenario 2: New user with no posts sees empty
  test('New user with no content sees empty feed', async () => {
    const user = await createUser('user@test.com');
    const feed = await fetchFeed(user.id);
    expect(feed.items).toEqual([]);
  });

  // Scenario 3: Trending refresh includes new posts
  test('Trending includes recently created posts', async () => {
    // Create posts
    // Trigger refresh
    // Verify trending projection
  });
});
```

### Feed Route Combinations
```typescript
describe('Feed Route Combinations', () => {
  const combinations = [
    { hasFriends: true, hasPosts: true, hasTrending: true },
    { hasFriends: false, hasPosts: true, hasTrending: true },
    { hasFriends: true, hasPosts: false, hasTrending: true },
    { hasFriends: false, hasPosts: false, hasTrending: true },
    { hasFriends: false, hasPosts: false, hasTrending: false },
  ];

  combinations.forEach(({ hasFriends, hasPosts, hasTrending }) => {
    test(`Feed with friends=${hasFriends}, posts=${hasPosts}, trending=${hasTrending}`, async () => {
      // Setup scenario
      // Fetch feed
      // Assert expected behavior
    });
  });
});
```

### Functional Combinations
```typescript
describe('Functional Combinations', () => {
  // Visibility × Friendship combinations
  test('Public post from friend appears in feed', async () => { ... });
  test('Public post from non-friend appears in trending', async () => { ... });
  test('Friends-only post from friend appears in feed', async () => { ... });
  test('Friends-only post from non-friend not in feed', async () => { ... });
  test('Private post only to author', async () => { ... });

  // Blocking combinations
  test('Blocked friend post excluded from feed', async () => { ... });
  test('Blocked user post excluded from trending', async () => { ... });

  // Media combinations
  test('Post with media appears in trending', async () => { ... });
  test('Post without media not in trending', async () => { ... });
});
```

## Test Utilities

### Helper Functions
```typescript
// test/helpers.ts
export async function createTestUser(email: string): Promise<User>
export async function createTestPost(userId: string, data: PostData): Promise<Post>
export async function createTestFriendship(user1Id: string, user2Id: string): Promise<Friendship>
export async function waitForEventPropagation(ms?: number): Promise<void>
export async function triggerTrendingRefresh(): Promise<void>
export async function fetchFeed(userId: string, cursor?: string): Promise<FeedResponse>
export async function seedTrendingPosts(posts: Post[]): Promise<void>
export async function clearAllCollections(): Promise<void>
```

### Test Fixtures
```typescript
// test/fixtures.ts
export const fixtures = {
  users: {
    alice: { email: 'alice@test.com', password: 'Password123!' },
    bob: { email: 'bob@test.com', password: 'Password123!' },
  },
  posts: {
    publicWithMedia: {
      content: 'Public post with media',
      visibility: 'public',
      media: [{ url: 'https://example.com/image.jpg', type: 'image' }],
    },
  },
};
```

## Continuous Testing

### Pre-commit Hooks
- Run unit tests
- Run linting
- Check test coverage threshold

### Pull Request Checks
- All unit tests
- Integration tests
- Functional tests (subset)

### Nightly Runs
- Full test suite
- E2E tests
- Performance tests
- Load tests

## Metrics & Reporting

### Test Metrics
- Test execution time
- Test pass/fail rate
- Code coverage percentage
- Flaky test detection

### Coverage Goals
- Unit tests: 80%+
- Integration tests: Critical paths 100%
- Functional tests: All user flows
- E2E tests: Critical journeys

## Maintenance

### Test Maintenance
- Review and update tests monthly
- Remove obsolete tests
- Refactor duplicate test code
- Update fixtures as schemas change

### Flaky Test Handling
- Identify flaky tests
- Add retry logic where appropriate
- Fix timing issues
- Document known flakiness

## Future Enhancements
1. **Property-based Testing**: Generate test cases automatically
2. **Mutation Testing**: Verify test quality
3. **Visual Regression**: Test UI components
4. **Performance Testing**: Load and stress tests
5. **Chaos Engineering**: Test failure scenarios

