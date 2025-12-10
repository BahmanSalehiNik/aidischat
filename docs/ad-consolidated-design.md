# Ad Service - Consolidated Design Document

## Overview

This document consolidates insights from the comprehensive Ad Service design and the event-driven architecture approach inspired by major platforms (Facebook, Instagram, TikTok). It provides a unified view of the Ad Service architecture, data flow, and implementation strategy.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Ingestion & Processing](#data-ingestion--processing)
3. [Storage Architecture](#storage-architecture)
4. [Ad Selection & Placement](#ad-selection--placement)
5. [Integration Points](#integration-points)
6. [Design Comparison & Analysis](#design-comparison--analysis)
7. [Open Questions](#open-questions)

---

## Architecture Overview

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Platform Services                             │
│  (Chat, Feed, Post, Search, User, Agent, etc.)                │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            │ Kafka Events
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Event Ingestion Layer                         │
│  - Feature Ingestion Service                                    │
│  - User Embedding Service                                       │
│  - Ad Relevance Store                                            │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Layer Storage Architecture              │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Raw Event Logs (Kafka, Data Lake)                     │
│  Layer 2: Feature Store (Redis/RocksDB, Cassandra)              │
│  Layer 3: Campaign & Ads DB (MongoDB/Postgres)                 │
│  Layer 4: Serving Indexes (Precomputed ad indexes)             │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ad Service Core Components                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Campaign   │  │   Targeting │  │    Auction   │         │
│  │   Manager    │  │   Engine    │  │    Engine    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Budget     │  │   ML Scoring │  │   Tracking   │         │
│  │   Pacing     │  │   Models     │  │   & Attribution│       │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Recommendation Service                        │
│  (Blends organic content + ads)                                  │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Client Services                               │
│  (AI-Chat-Host, Feed Service, etc.)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Event-Driven First**: All data arrives via Kafka events, no direct service calls
2. **Multi-Layer Storage**: Separate storage layers for different data types and access patterns
3. **Low-Latency Serving**: Feature store in Redis/RocksDB for sub-10ms lookups
4. **Separation of Concerns**: Ad Service owns ad logic, RecService blends, clients render
5. **Scalable by Design**: Can handle millions of ads and billions of requests

---

## Data Ingestion & Processing

### Event-Driven Data Flow

**Critical Insight**: The Ad Service does NOT call other services directly. All data arrives via Kafka events.

#### Event Sources

```typescript
// Platform Events Consumed by Ad Service
interface PlatformEvents {
  // User Events
  'user.created': UserCreatedEvent;
  'user.updated': UserUpdatedEvent;
  'user.profile.updated': UserProfileUpdatedEvent;
  
  // Engagement Events
  'post.viewed': PostViewedEvent;
  'post.liked': PostLikedEvent;
  'post.shared': PostSharedEvent;
  'post.commented': PostCommentedEvent;
  
  // Chat Events
  'message.created': MessageCreatedEvent;
  'agent.chat.joined': AgentChatJoinedEvent;
  'room.entered': RoomEnteredEvent;
  
  // Search Events
  'search.query': SearchQueryEvent;
  'search.result.clicked': SearchResultClickedEvent;
  
  // Social Events
  'friendship.accepted': FriendshipAcceptedEvent;
  'profile.viewed': ProfileViewedEvent;
  
  // Agent Events
  'agent.created': AgentCreatedEvent;
  'agent.invited': AgentInvitedEvent;
  
  // Web Events (Future)
  'page.visited': PageVisitedEvent;
  'cookie.synced': CookieSyncedEvent;
}
```

#### Event Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  Kafka Event Stream (All Platform Events)                       │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Feature Ingestion Service                                       │
│  - Consumes events from Kafka                                    │
│  - Extracts user features (interests, behaviors, demographics) │
│  - Updates feature store in real-time                            │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  User Embedding Service (Optional, Phase 2+)                     │
│  - Generates user embeddings from aggregated features           │
│  - Updates embedding vectors for similarity matching            │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Feature Store (Redis + MongoDB)                                 │
│  - Real-time user features (Redis)                               │
│  - Persistent user profiles (MongoDB)                            │
│  - Ad features and metadata                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Feature Extraction Examples

```typescript
// Example: Processing PostLikedEvent
interface PostLikedEvent {
  userId: string;
  postId: string;
  postCategory: string;
  postTopics: string[];
  timestamp: Date;
}

// Feature Ingestion Service updates:
userFeatures[userId].interests.topics.push(...postTopics);
userFeatures[userId].interests.categories.push(postCategory);
userFeatures[userId].behavior.feedActivity.postsLiked++;
userFeatures[userId].lastActive = timestamp;
```

---

## Storage Architecture

### Multi-Layer Storage Design

Inspired by big platforms, we use a **4-layer storage architecture**:

#### Layer 1: Raw Event Logs
**Purpose**: Immutable event history, audit trail, batch processing

**Storage**:
- **Kafka**: Real-time event stream (retention: 7-30 days)
- **Data Lake** (Future): Long-term storage (S3, Azure Blob) for ML training

**Data**:
- All platform events (user actions, ad impressions, clicks)
- Raw, unprocessed events
- Used for: analytics, ML training, debugging

**Example**:
```json
{
  "eventId": "evt_123",
  "eventType": "post.liked",
  "userId": "user_456",
  "postId": "post_789",
  "timestamp": "2024-01-15T10:30:00Z",
  "metadata": { "category": "travel", "topics": ["japan", "tokyo"] }
}
```

#### Layer 2: Feature Store
**Purpose**: Low-latency feature access for real-time ad serving

**Storage**:
- **Redis**: Hot features (in-memory, <1ms access)
  - User features (interests, behaviors, demographics)
  - Recent activity signals
  - Frequency capping state
- **MongoDB/Cassandra**: Persistent feature storage
  - User profiles
  - Ad metadata
  - Historical aggregations

**Data Structure**:
```typescript
// Redis Structure (Hot Features)
interface HotUserFeatures {
  userId: string;
  interests: {
    topics: string[];        // ["travel", "cooking", "tech"]
    categories: string[];    // ["lifestyle", "food"]
    embeddings?: number[];   // Vector embeddings
  };
  behavior: {
    chatActivity: { frequency: number; topics: string[] };
    feedActivity: { postsViewed: number; categories: string[] };
    engagementScore: number;
  };
  demographics: {
    age?: number;
    location: string;
    language: string[];
  };
  lastUpdated: Date;
  ttl: number; // Cache expiration
}

// MongoDB Structure (Persistent Features)
interface UserProfile {
  userId: string;
  features: HotUserFeatures;
  historicalData: {
    totalPostsLiked: number;
    totalChatsJoined: number;
    averageSessionDuration: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

**Access Pattern**:
- **Real-time ad serving**: Read from Redis (<1ms)
- **Feature updates**: Write to Redis + MongoDB (async)
- **Batch processing**: Read from MongoDB for ML training

#### Layer 3: Campaign & Ads Database
**Purpose**: Campaign management, ad metadata, budgets, targeting rules

**Storage**:
- **MongoDB** (Primary): Campaigns, ads, creatives, budgets
- **Postgres** (Alternative): If need for complex queries/joins

**Schema**:
```typescript
// Campaigns Collection
interface Campaign {
  campaignId: string;
  advertiserId: string;
  name: string;
  objective: 'awareness' | 'traffic' | 'conversions' | 'engagement';
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed';
  budget: {
    type: 'daily' | 'lifetime';
    amount: number;
    spent: number;
    remaining: number;
    pacing: 'even' | 'accelerated' | 'standard';
  };
  targeting: TargetingConfig;
  schedule: { startDate: Date; endDate?: Date };
  createdAt: Date;
  updatedAt: Date;
}

// Ads Collection
interface Ad {
  adId: string;
  campaignId: string;
  creative: {
    type: 'image' | 'video' | 'carousel';
    url: string;
    headline?: string;
    description?: string;
    cta?: string;
  };
  targeting: TargetingConfig;
  bidding: {
    type: 'CPC' | 'CPM' | 'CPA';
    amount: number;
  };
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    qualityScore: number;
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
```

#### Layer 4: Serving Indexes
**Purpose**: Precomputed indexes for fast ad candidate retrieval

**Storage**:
- **Redis**: In-memory indexes
- **Elasticsearch** (Future): For complex queries

**Index Types**:
```typescript
// Example Indexes
interface AdIndexes {
  // By Targeting Criteria
  'ads:targeting:geo:US': string[];        // Ad IDs targeting US
  'ads:targeting:topic:travel': string[]; // Ad IDs targeting travel
  'ads:targeting:age:18-25': string[];    // Ad IDs targeting age 18-25
  
  // By Status
  'ads:status:active': string[];           // All active ad IDs
  
  // By Campaign
  'ads:campaign:campaign_123': string[];  // Ad IDs in campaign
  
  // By Category
  'ads:category:lifestyle': string[];      // Lifestyle ads
  'ads:category:tech': string[];           // Tech ads
}
```

**Usage**:
- When ad placement request comes in, quickly filter eligible ads
- Instead of scanning all ads, use indexes to get candidate set
- Reduces candidate set from millions → hundreds

---

## Ad Selection & Placement

### Ad Selection Flow (Real-Time)

```
┌─────────────────────────────────────────────────────────────────┐
│  Recommendation Service: Ad Placement Request                   │
│  POST /api/ads/placement                                         │
│  { userId, contextType: "chat", slotType: "chat_banner", ... }  │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Feature Lookup (< 1ms)                                  │
│  - Fetch user features from Redis                                │
│  - Fetch context features (topics, categories)                   │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Eligibility Filtering (< 5ms)                          │
│  - Use serving indexes to get candidate ads                      │
│  - Filter by: geo, language, age, interests, context            │
│  - Result: 50-500 candidate ads (from millions)                 │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Scoring & Ranking (< 10ms)                             │
│  - Calculate relevance score (user-ad match)                    │
│  - Predict CTR (click-through rate)                             │
│  - Calculate quality score = relevance × CTR × bid              │
│  - Rank by quality score                                         │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Budget & Frequency Capping (< 2ms)                     │
│  - Check budget availability                                     │
│  - Check frequency caps (per user, per campaign)                │
│  - Apply pacing rules                                            │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Auction (if bidding enabled) (< 2ms)                   │
│  - Run second-price auction                                      │
│  - Select winner based on quality score                         │
│  - Calculate charge amount                                       │
└──────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Return Ad (< 1ms)                                       │
│  - Return winning ad(s) with creative URLs                       │
│  - Total latency: < 20ms (target: 5-15ms)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Slot Types & Placement Rules

```typescript
interface AdSlot {
  slotType: string;
  contextType: 'chat' | 'feed' | 'explore' | 'profile' | 'search';
  
  // Placement Rules
  position: {
    minPosition: number;  // e.g., feed: min position 3
    maxPosition: number;  // e.g., feed: max position 20
    frequency: number;    // e.g., 1 ad per 5 items
  };
  
  // Format Constraints
  format: {
    dimensions?: { width: number; height: number };
    supportedTypes: ('image' | 'video' | 'carousel')[];
    maxDuration?: number; // for video
  };
  
  // Frequency Capping
  frequencyCap: {
    perUser: number;      // Max impressions per user per day
    perCampaign: number;  // Max impressions per campaign per user
  };
  
  // Diversity Rules
  diversity: {
    maxSameAdvertiser: number; // Max ads from same advertiser
    minSpacing: number;        // Min items between ads
  };
}

// Example Slot Definitions
const SLOT_TYPES: Record<string, AdSlot> = {
  'chat_banner': {
    slotType: 'chat_banner',
    contextType: 'chat',
    position: { minPosition: 1, maxPosition: 1, frequency: 1 },
    format: { dimensions: { width: 300, height: 100 }, supportedTypes: ['image', 'carousel'] },
    frequencyCap: { perUser: 3, perCampaign: 1 },
    diversity: { maxSameAdvertiser: 1, minSpacing: 0 },
  },
  'feed_card': {
    slotType: 'feed_card',
    contextType: 'feed',
    position: { minPosition: 3, maxPosition: 20, frequency: 5 },
    format: { dimensions: { width: 400, height: 500 }, supportedTypes: ['image', 'video', 'carousel'], maxDuration: 60 },
    frequencyCap: { perUser: 10, perCampaign: 2 },
    diversity: { maxSameAdvertiser: 1, minSpacing: 4 },
  },
  'chat_suggestion_bar': {
    slotType: 'chat_suggestion_bar',
    contextType: 'chat',
    position: { minPosition: 1, maxPosition: 1, frequency: 1 },
    format: { dimensions: { width: 350, height: 80 }, supportedTypes: ['image'] },
    frequencyCap: { perUser: 5, perCampaign: 1 },
    diversity: { maxSameAdvertiser: 1, minSpacing: 0 },
  },
};
```

---

## Integration Points

### Integration with Recommendation Service

**Key Principle**: RecService triggers ads, not client services directly.

```typescript
// Recommendation Service Flow
interface RecommendationFlow {
  // 1. RecService receives recommendation request
  request: {
    userId: string;
    contextType: 'chat';
    context: { topics: ['travel', 'japan'], roomId: 'room_123' };
  };
  
  // 2. RecService generates organic recommendations
  organicRecommendations: Recommendation[];
  
  // 3. RecService calls Ad Service for ad slots
  adRequest: {
    userId: string;
    contextType: 'chat';
    slotType: 'chat_banner';
    context: { topics: ['travel', 'japan'] };
    maxAds: 1;
  };
  
  // 4. Ad Service returns ads
  ads: AdCandidate[];
  
  // 5. RecService blends ads with organic content
  blendedRecommendations: (Recommendation | Ad)[];
  
  // 6. RecService returns to client (AI-Chat-Host)
  response: {
    recommendations: blendedRecommendations;
  };
}
```

### Integration with AI-Chat-Host

**Key Principle**: AI-Chat-Host receives blended results, doesn't know about ads.

```typescript
// AI-Chat-Host receives recommendations (already blended)
interface Recommendation {
  type: 'agent' | 'ad' | 'utility';
  
  // If type === 'agent'
  agentId?: string;
  score?: number;
  
  // If type === 'ad'
  ad?: {
    adId: string;
    creative: { url: string; headline?: string; cta?: string };
    targetUrl: string;
    advertiser?: { name: string; verified?: boolean };
    sponsoredLabel?: string; // "Sponsored" or "Promoted"
  };
}

// AI-Chat-Host renders based on type
if (recommendation.type === 'ad') {
  renderAdBanner(recommendation.ad);
} else if (recommendation.type === 'agent') {
  renderAgentSuggestion(recommendation.agentId);
}
```

---

## Design Comparison & Analysis

### Comparison: Comprehensive Design vs. Event-Driven Approach

| Aspect | Comprehensive Design | Event-Driven Approach | Consolidated Approach |
|--------|---------------------|----------------------|----------------------|
| **Data Ingestion** | API calls + Events | Kafka events only | **Kafka events only** (more scalable) |
| **Storage** | MongoDB + Redis | Multi-layer (4 layers) | **Multi-layer storage** (better performance) |
| **Feature Store** | MongoDB-based | Redis + Cassandra | **Redis (hot) + MongoDB (cold)** |
| **Latency Target** | < 100ms | 5-15ms | **5-15ms** (more aggressive) |
| **Customer Portal** | Detailed design | Not specified | **Include customer portal** |
| **API Design** | RESTful APIs | Event-driven focus | **RESTful + Events** (hybrid) |
| **ML Models** | Mentioned | Emphasized | **Emphasize ML scoring** |
| **Serving Indexes** | Not detailed | Detailed | **Include serving indexes** |

### Improvements from Consolidation

#### 1. **Event-Driven Architecture (From Event-Driven Approach)**
- **Upside**: More scalable, decoupled, real-time updates
- **Implementation**: All platform events → Kafka → Feature Ingestion Service
- **Impact**: No direct service dependencies, easier to scale

#### 2. **Multi-Layer Storage (From Event-Driven Approach)**
- **Upside**: Optimized for different access patterns
- **Implementation**: 
  - Layer 1: Kafka/Data Lake (raw events)
  - Layer 2: Redis + MongoDB (features)
  - Layer 3: MongoDB (campaigns)
  - Layer 4: Redis indexes (serving)
- **Impact**: Sub-10ms ad selection, better performance

#### 3. **Serving Indexes (From Event-Driven Approach)**
- **Upside**: Fast candidate filtering (millions → hundreds)
- **Implementation**: Precomputed indexes in Redis
- **Impact**: 10-100x faster eligibility filtering

#### 4. **Customer Portal (From Comprehensive Design)**
- **Upside**: Self-service for advertisers
- **Implementation**: Web UI + APIs for campaign management
- **Impact**: Reduces support burden, enables scale

#### 5. **Detailed API Design (From Comprehensive Design)**
- **Upside**: Clear integration contracts
- **Implementation**: RESTful APIs for customer portal, event-driven for internal
- **Impact**: Easier integration, better developer experience

### Upsides of Consolidated Design

1. **Scalability**
   - Event-driven architecture handles millions of events/day
   - Multi-layer storage optimizes for different access patterns
   - Serving indexes enable fast candidate filtering

2. **Performance**
   - Redis feature store: <1ms lookups
   - Precomputed indexes: <5ms candidate filtering
   - Total ad selection: <20ms (target: 5-15ms)

3. **Flexibility**
   - Easy to add new event sources
   - Can evolve ML models without changing architecture
   - Supports multiple bid types (CPC, CPM, CPA)

4. **Separation of Concerns**
   - Ad Service: ad logic only
   - RecService: blending logic
   - Client services: rendering only

5. **Customer Self-Service**
   - Advertisers can manage campaigns independently
   - Reduces operational overhead
   - Enables platform scale

### Downsides / Challenges

1. **Complexity**
   - **Challenge**: Multi-layer storage requires careful data synchronization
   - **Mitigation**: Use event-driven updates, async writes to MongoDB

2. **Latency Requirements**
   - **Challenge**: <20ms total latency is aggressive for v1
   - **Mitigation**: Start with <100ms, optimize to <20ms in Phase 2+

3. **Event Volume**
   - **Challenge**: High event volume (millions/day) requires Kafka scaling
   - **Mitigation**: Use Kafka partitioning, batch processing for non-critical events

4. **Feature Store Consistency**
   - **Challenge**: Redis + MongoDB sync can have consistency issues
   - **Mitigation**: Eventual consistency acceptable, use Redis as source of truth for serving

5. **ML Model Complexity**
   - **Challenge**: ML models require training infrastructure
   - **Mitigation**: Start with rule-based scoring, add ML in Phase 2+

6. **Cost**
   - **Challenge**: Redis, Kafka, ML infrastructure can be expensive
   - **Mitigation**: Start small, scale based on revenue

### Open Questions

#### 1. **Feature Store Architecture**
- **Question**: Should we use a dedicated feature store service (like Feast) or build custom?
- **Options**:
  - A) Custom (Redis + MongoDB) - More control, simpler
  - B) Feast/Tecton - Industry standard, more features
- **Recommendation**: Start with custom (A), migrate to Feast if needed

#### 2. **ML Model Deployment**
- **Question**: Where should ML models run? Separate service or embedded in Ad Service?
- **Options**:
  - A) Embedded in Ad Service - Lower latency, simpler
  - B) Separate ML Service - Better scaling, isolation
- **Recommendation**: Start embedded (A), extract to separate service if needed

#### 3. **Auction Mechanism**
- **Question**: Second-price auction or first-price auction?
- **Options**:
  - A) Second-price (like Google) - More advertiser-friendly
  - B) First-price - Simpler, more revenue
- **Recommendation**: Second-price (A) for v1, can experiment later

#### 4. **Budget Pacing Strategy**
- **Question**: How aggressive should budget pacing be?
- **Options**:
  - A) Even pacing - Predictable, fair
  - B) Performance-based - Maximize revenue
- **Recommendation**: Even pacing (A) for v1, add performance-based in Phase 2

#### 5. **Ad Approval Workflow**
- **Question**: Automated approval or manual review?
- **Options**:
  - A) Automated (policy rules) - Faster, scalable
  - B) Manual review - Safer, higher quality
- **Recommendation**: Hybrid - Automated for low-risk, manual for high-risk

#### 6. **Frequency Capping Storage**
- **Question**: Where to store frequency cap state? Redis or separate service?
- **Options**:
  - A) Redis - Fast, simple
  - B) Dedicated service - Better isolation, scaling
- **Recommendation**: Redis (A) for v1, can extract if needed

#### 7. **Attribution Model**
- **Question**: How to attribute conversions? Last-click, first-click, or multi-touch?
- **Options**:
  - A) Last-click - Simple, industry standard
  - B) Multi-touch - More accurate, complex
- **Recommendation**: Last-click (A) for v1, add multi-touch later

#### 8. **Real-Time vs. Batch Processing**
- **Question**: Should all features be real-time or can some be batch?
- **Options**:
  - A) All real-time - Better accuracy, more complex
  - B) Hybrid (hot features real-time, cold features batch) - Balanced
- **Recommendation**: Hybrid (B) - Real-time for critical features, batch for aggregations

#### 9. **Ad Creative Storage**
- **Question**: Store creatives in MongoDB or object storage (S3/Azure)?
- **Options**:
  - A) Object storage - Better for large files, CDN-friendly
  - B) MongoDB GridFS - Simpler, all-in-one
- **Recommendation**: Object storage (A) - S3/Azure Blob, reference URLs in MongoDB

#### 10. **Customer Portal Architecture**
- **Question**: Separate service or part of Ad Service?
- **Options**:
  - A) Separate service - Better isolation, scaling
  - B) Part of Ad Service - Simpler, fewer services
- **Recommendation**: Separate service (A) - Can scale independently, different auth

---

## Recommended Architecture Decisions

Based on the consolidated design, here are the recommended decisions:

### Storage
- ✅ **Redis** for hot features (user features, frequency caps)
- ✅ **MongoDB** for campaigns, ads, persistent features
- ✅ **Kafka** for event streaming
- ✅ **Object Storage** (S3/Azure) for ad creatives
- ✅ **Serving Indexes** in Redis for fast candidate filtering

### Data Flow
- ✅ **Event-driven** for all data ingestion (Kafka)
- ✅ **Feature Ingestion Service** processes events → updates feature store
- ✅ **No direct service calls** for data collection

### Ad Selection
- ✅ **Multi-step pipeline**: Feature lookup → Eligibility → Scoring → Auction → Return
- ✅ **Target latency**: <20ms (start with <100ms, optimize)
- ✅ **Serving indexes** for fast candidate filtering

### Integration
- ✅ **RecService triggers ads** (not client services)
- ✅ **RecService blends** ads with organic content
- ✅ **Client services** receive blended results

### ML/AI
- ✅ **Start with rule-based** scoring (Phase 1)
- ✅ **Add ML models** in Phase 2+ (CTR prediction, relevance)
- ✅ **Embeddings** for similarity matching (Phase 2+)

### Customer Portal
- ✅ **Separate service** for advertiser portal
- ✅ **RESTful APIs** for campaign management
- ✅ **Self-service** workflow

---

## Next Steps

1. **Review this consolidated design** with the team
2. **Answer open questions** based on business priorities
3. **Create execution plan** (see `ad-service-execution-plan.md`)
4. **Start Phase 1 implementation** (MVP)

---

## References

- Comprehensive Design: `docs/ad-service-design.md`
- Event-Driven Approach: `docs/ads/ads-chat.md`
- Recommendation Service Design: `backEnd/chat-recommendation/DESIGN.md`
- AI-Chat-Host Design: `backEnd/ai-chat-host/DESIGN.md`

