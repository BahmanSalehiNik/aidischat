# Ad Service - Comprehensive Design Document

## Overview

The Ad Service is a specialized microservice responsible for managing advertising campaigns, processing data from multiple platform sources, and intelligently placing ads across different contexts (chat, feed, explore, profile, etc.). It follows the architecture patterns used by major platforms like Facebook, Instagram, and Google.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Responsibilities](#core-responsibilities)
3. [Data Sources & Processing](#data-sources--processing)
4. [Customer Ad Registration](#customer-ad-registration)
5. [Ad Placement & Decision Logic](#ad-placement--decision-logic)
6. [Auction & Bidding System](#auction--bidding-system)
7. [Targeting & Personalization](#targeting--personalization)
8. [Integration with Platform Services](#integration-with-platform-services)
9. [Data Models](#data-models)
10. [API Design](#api-design)
11. [Event-Driven Architecture](#event-driven-architecture)
12. [Implementation Phases](#implementation-phases)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Platform Services                        │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Chat       │    Feed      │   Search    │   User Service     │
│   Service    │   Service    │   Service   │   (Profile Data)   │
└──────┬───────┴──────┬───────┴──────┬───────┴──────────┬─────────┘
       │              │              │                  │
       └──────────────┴──────────────┴──────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Recommendation Service                        │
│  (Blends organic content + ads for unified recommendations)      │
└──────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Ad Service                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Campaign   │  │   Targeting  │  │    Auction   │         │
│  │   Manager    │  │   Engine     │  │    Engine    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Budget     │  │   Creative   │  │   Analytics   │         │
│  │   Manager    │  │   Store      │  │   & Tracking │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Customer Ad Portal                            │
│  (Advertisers register campaigns, manage budgets, view analytics) │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles (Inspired by Facebook/Instagram)

1. **Separation of Concerns**
   - Ad Service owns: campaigns, targeting, budgets, auctions, creatives
   - Recommendation Service blends: organic content + ads
   - Client services (Chat, Feed) receive blended results

2. **Feature-Based Targeting**
   - Uses aggregated user features, not raw data
   - Processes data from multiple sources (chat, feed, posts, cookies)
   - Real-time feature updates

3. **Auction-Based Placement**
   - Real-time bidding (RTB) for ad slots
   - Revenue optimization (eCPM, eCPC)
   - Quality score balancing (relevance + bid)

4. **Multi-Context Support**
   - Same ad service works for: chat, feed, explore, profile, search
   - Context-specific slot types and formats

5. **Customer Self-Service**
   - Advertisers can register and manage campaigns
   - Real-time budget tracking and pacing
   - Performance analytics dashboard

---

## Core Responsibilities

### 1. Campaign Management
- Create, update, pause, delete campaigns
- Campaign scheduling (start/end dates)
- Campaign status (draft, active, paused, completed, rejected)

### 2. Ad Creative Management
- Store ad creatives (images, videos, text, interactive)
- Creative approval workflow
- Creative versioning and A/B testing
- Format validation (size, file type, duration)

### 3. Targeting & Audience Selection
- Demographic targeting (age, gender, location)
- Interest-based targeting (topics, categories)
- Behavioral targeting (engagement patterns, purchase history)
- Lookalike audiences
- Custom audience lists
- Exclusion lists

### 4. Budget Management & Pacing
- Daily/lifetime budgets
- Budget pacing (even, accelerated, standard)
- Budget alerts and notifications
- Automatic pausing when budget exhausted

### 5. Auction & Bidding
- Real-time auction for ad slots
- Bid calculation (CPC, CPM, CPA)
- Quality score (relevance + bid)
- Frequency capping
- Ad ranking and selection

### 6. Ad Placement Decision
- Context analysis (chat, feed, explore, etc.)
- Slot type identification (banner, card, inline, etc.)
- Candidate ad generation
- Relevance scoring
- Blending with organic content

### 7. Performance Tracking
- Impressions, clicks, conversions
- Engagement metrics (likes, shares, comments)
- Revenue tracking (eCPM, eCPC, eCPA)
- Real-time analytics

### 8. Policy & Safety
- Ad content review
- Policy compliance checking
- Fraud detection
- Brand safety filters

---

## Data Sources & Processing

### Data Sources

The Ad Service processes data from multiple platform sources:

#### 1. User Service
- **User Profile Data**
  - Demographics: age, gender, location, language
  - Account type: free, premium, business
  - Registration date, last active
  - Subscription status

#### 2. Chat Service / AI-Chat-Host
- **Chat Behavior**
  - Topics discussed in conversations
  - Agents invited/interacted with
  - Conversation frequency and duration
  - Sentiment patterns
  - Chat context summaries

#### 3. Feed Service
- **Feed Engagement**
  - Posts viewed, liked, shared, commented
  - Dwell time on posts
  - Feed scroll patterns
  - Content categories engaged with

#### 4. Post Service
- **Content Interaction**
  - Posts created, topics, categories
  - Comments made
  - Reactions given
  - Content preferences

#### 5. Search Service
- **Search Behavior**
  - Search queries
  - Search result clicks
  - Trending topics
  - Search patterns

#### 6. E-commerce Service (Future)
- **Purchase Behavior**
  - Products viewed
  - Purchase history
  - Cart abandonment
  - Price sensitivity

#### 7. Web Tracking (Future)
- **Cookie Data**
  - External website visits
  - Cross-domain tracking
  - Browser behavior
  - Device information

### Data Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Ingestion Layer                          │
│  (Kafka Events: UserCreated, PostLiked, MessageCreated, etc.)   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Feature Extraction Service                      │
│  - Extract user features from events                             │
│  - Aggregate behavioral signals                                  │
│  - Update user feature projections                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Feature Store (MongoDB/Redis)                  │
│  - User features: interests, behaviors, demographics             │
│  - Content features: topics, categories, popularity              │
│  - Real-time feature updates                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ad Targeting Engine                            │
│  - Match ads to user features                                   │
│  - Apply targeting rules                                         │
│  - Generate candidate ads                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Feature Store Schema

```typescript
interface UserFeatures {
  userId: string;
  
  // Demographics
  age?: number;
  gender?: string;
  location?: {
    country: string;
    city?: string;
    timezone: string;
  };
  language: string[];
  
  // Interests (from chat, feed, posts)
  interests: {
    topics: string[];           // e.g., ["cooking", "travel", "tech"]
    categories: string[];       // e.g., ["food", "lifestyle"]
    embeddings?: number[];       // Vector embeddings for similarity
  };
  
  // Behavioral Signals
  behavior: {
    chatActivity: {
      frequency: number;         // Messages per day
      avgSessionDuration: number;
      topicsEngaged: string[];
    };
    feedActivity: {
      postsViewed: number;
      avgDwellTime: number;
      categoriesEngaged: string[];
    };
    searchActivity: {
      queries: string[];
      resultClicks: number;
    };
    engagementScore: number;    // Overall engagement level
  };
  
  // Device & Context
  device: {
    type: 'mobile' | 'desktop' | 'tablet';
    os?: string;
    browser?: string;
  };
  
  // Timestamps
  lastActive: Date;
  featuresUpdatedAt: Date;
}
```

---

## Customer Ad Registration

### Advertiser Portal Features

#### 1. Advertiser Account Management
- **Registration & Authentication**
  - Advertiser account creation
  - Business verification
  - Payment method setup
  - Billing information

- **Account Types**
  - Self-service (small businesses)
  - Managed service (enterprise, white-glove)
  - API access (for agencies)

#### 2. Campaign Creation Workflow

```
Step 1: Campaign Setup
├── Campaign name
├── Campaign objective (awareness, traffic, conversions, engagement)
├── Budget (daily or lifetime)
├── Schedule (start/end dates, time zones)
└── Billing (payment method, billing cycle)

Step 2: Ad Creative
├── Upload creative assets
│   ├── Images (JPG, PNG, WebP)
│   ├── Videos (MP4, WebM)
│   ├── Text (headline, description, CTA)
│   └── Interactive (polls, quizzes, carousels)
├── Creative format selection
│   ├── Banner (chat, feed)
│   ├── Card (feed, explore)
│   ├── Inline (feed, search)
│   └── Modal (chat, profile)
└── Landing page URL

Step 3: Targeting
├── Demographics
│   ├── Age range
│   ├── Gender
│   └── Location (countries, cities, radius)
├── Interests
│   ├── Topics (from platform taxonomy)
│   ├── Categories
│   └── Lookalike audiences
├── Behaviors
│   ├── Engagement level
│   ├── Device type
│   └── Time of day
└── Exclusions
    ├── Custom exclusion lists
    └── Negative keywords

Step 4: Bidding
├── Bid type (CPC, CPM, CPA)
├── Bid amount
├── Budget pacing (even, accelerated)
└── Optimization goal

Step 5: Review & Submit
├── Campaign preview
├── Estimated reach
├── Estimated daily spend
└── Submit for approval
```

#### 3. Campaign Management Dashboard

- **Campaign Overview**
  - Active campaigns count
  - Total spend
  - Performance metrics (impressions, clicks, conversions)
  - Budget alerts

- **Campaign List**
  - Filter by status, date, performance
  - Bulk actions (pause, resume, delete)
  - Quick edit (budget, targeting, bids)

- **Campaign Details**
  - Performance metrics (real-time)
  - Ad creative preview
  - Targeting summary
  - Budget and pacing
  - Change history

#### 4. Analytics & Reporting

- **Performance Metrics**
  - Impressions, clicks, CTR
  - Conversions, conversion rate
  - Cost per click (CPC), cost per impression (CPM)
  - Return on ad spend (ROAS)
  - Engagement metrics (likes, shares, comments)

- **Audience Insights**
  - Demographics breakdown
  - Geographic distribution
  - Device breakdown
  - Time-of-day performance

- **Reports**
  - Daily, weekly, monthly reports
  - Custom date ranges
  - Export (CSV, PDF)
  - Scheduled reports (email)

---

## Ad Placement & Decision Logic

### Context Types

The Ad Service supports multiple contexts:

1. **Chat Context** (`contextType: "chat"`)
   - Slot types: `chat_banner`, `chat_suggestion_bar`, `chat_modal`
   - Considerations: conversation topics, participants, room type

2. **Feed Context** (`contextType: "feed"`)
   - Slot types: `feed_card`, `feed_inline`, `feed_story`
   - Considerations: feed position, content around ad, user scroll behavior

3. **Explore Context** (`contextType: "explore"`)
   - Slot types: `explore_card`, `explore_grid`
   - Considerations: trending topics, discovery patterns

4. **Profile Context** (`contextType: "profile"`)
   - Slot types: `profile_banner`, `profile_suggestion`
   - Considerations: profile owner, visitor relationship

5. **Search Context** (`contextType: "search"`)
   - Slot types: `search_result`, `search_suggestion`
   - Considerations: search query, search intent

### Ad Placement Decision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Recommendation Service requests recommendations                 │
│  { contextType: "chat", slotType: "chat_banner", ... }          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ad Service: Ad Placement Request                               │
│  1. Extract user features from Feature Store                    │
│  2. Identify eligible ad slots                                  │
│  3. Generate candidate ads                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Candidate Ad Generation                                        │
│  For each active campaign:                                      │
│  ├── Check targeting rules (demographics, interests, behaviors) │
│  ├── Check budget availability                                  │
│  ├── Check frequency capping                                    │
│  ├── Check policy compliance                                    │
│  └── If eligible → add to candidates                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Relevance Scoring                                              │
│  For each candidate ad:                                         │
│  ├── Topic similarity (chat topics vs ad topics)                │
│  ├── Interest match (user interests vs ad targeting)            │
│  ├── Behavioral fit (user behavior vs ad objective)             │
│  ├── Context fit (context type vs ad format)                    │
│  └── Calculate relevance score (0-1)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Auction & Ranking                                              │
│  For each candidate ad:                                         │
│  ├── Calculate bid (CPC, CPM, or CPA)                           │
│  ├── Calculate quality score (relevance × bid)                 │
│  └── Rank by quality score                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ad Selection & Blending                                        │
│  ├── Select top N ads (based on slot capacity)                  │
│  ├── Apply frequency capping                                    │
│  ├── Apply diversity rules (avoid same advertiser)             │
│  └── Return ads to Recommendation Service                         │
└─────────────────────────────────────────────────────────────────┘
```

### Slot Type Definitions

```typescript
interface AdSlot {
  slotType: string;
  contextType: string;
  format: {
    dimensions?: { width: number; height: number };
    supportedFormats: ('image' | 'video' | 'carousel' | 'interactive')[];
    maxDuration?: number; // for video
  };
  position: {
    minPosition: number;  // Minimum position in feed/list
    maxPosition: number;  // Maximum position
    frequency: number;    // Max ads per N items (e.g., 1 ad per 5 items)
  };
  constraints: {
    frequencyCap: {
      perUser: number;   // Max impressions per user per day
      perCampaign: number; // Max impressions per campaign per user
    };
    diversity: {
      maxSameAdvertiser: number; // Max ads from same advertiser
      minSpacing: number;        // Min items between ads
    };
  };
}

// Example slot types
const SLOT_TYPES: Record<string, AdSlot> = {
  'chat_banner': {
    slotType: 'chat_banner',
    contextType: 'chat',
    format: {
      dimensions: { width: 300, height: 100 },
      supportedFormats: ['image', 'carousel'],
    },
    position: { minPosition: 1, maxPosition: 1, frequency: 1 },
    constraints: {
      frequencyCap: { perUser: 3, perCampaign: 1 },
      diversity: { maxSameAdvertiser: 1, minSpacing: 0 },
    },
  },
  'feed_card': {
    slotType: 'feed_card',
    contextType: 'feed',
    format: {
      dimensions: { width: 400, height: 500 },
      supportedFormats: ['image', 'video', 'carousel'],
      maxDuration: 60, // seconds
    },
    position: { minPosition: 3, maxPosition: 20, frequency: 5 },
    constraints: {
      frequencyCap: { perUser: 10, perCampaign: 2 },
      diversity: { maxSameAdvertiser: 1, minSpacing: 4 },
    },
  },
  // ... more slot types
};
```

---

## Auction & Bidding System

### Bid Types

1. **CPC (Cost Per Click)**
   - Advertiser pays when user clicks
   - Bid: maximum amount per click
   - Used for: traffic, conversions

2. **CPM (Cost Per Mille / Thousand Impressions)**
   - Advertiser pays per 1000 impressions
   - Bid: maximum amount per 1000 impressions
   - Used for: awareness, reach

3. **CPA (Cost Per Action)**
   - Advertiser pays when user completes action (purchase, signup)
   - Bid: maximum amount per action
   - Used for: conversions, app installs

### Auction Mechanism

The Ad Service uses a **second-price auction** (similar to Google AdWords):

```
For each ad slot:
1. Collect all eligible candidate ads
2. Calculate quality score for each ad:
   qualityScore = relevanceScore × bidAmount
3. Rank ads by quality score (descending)
4. Select winner (highest quality score)
5. Charge winner: 
   charge = (nextHighestQualityScore / winnerRelevanceScore) + 0.01
   (ensures winner pays just enough to beat second place)
```

### Quality Score Components

```typescript
interface QualityScore {
  relevanceScore: number;    // 0-1, based on targeting match
  bidAmount: number;         // Advertiser's bid
  qualityScore: number;      // relevanceScore × bidAmount
  
  // Additional factors (optional, for advanced scoring)
  historicalCTR?: number;     // Historical click-through rate
  adQuality?: number;         // Ad creative quality score
  landingPageQuality?: number; // Landing page quality
}
```

### Budget Pacing

Budget pacing ensures campaigns spend evenly over time:

```typescript
interface BudgetPacing {
  strategy: 'even' | 'accelerated' | 'standard';
  
  // Even pacing: spend budget evenly throughout day
  even: {
    hourlyBudget: dailyBudget / 24;
    adjustBasedOnPerformance: false;
  };
  
  // Accelerated: spend faster early, slower later
  accelerated: {
    morningMultiplier: 1.5;  // Spend 50% more in morning
    afternoonMultiplier: 1.0;
    eveningMultiplier: 0.5;   // Spend 50% less in evening
  };
  
  // Standard: spend based on performance
  standard: {
    increaseIfPerforming: true;
    decreaseIfUnderperforming: true;
    performanceThreshold: 0.7; // 70% of expected performance
  };
}
```

---

## Targeting & Personalization

### Targeting Methods

#### 1. Demographic Targeting
```typescript
interface DemographicTargeting {
  age?: { min: number; max: number };
  gender?: ('male' | 'female' | 'other' | 'all')[];
  location?: {
    countries?: string[];
    cities?: string[];
    excludeCountries?: string[];
    radius?: { lat: number; lng: number; radiusKm: number };
  };
  language?: string[];
}
```

#### 2. Interest-Based Targeting
```typescript
interface InterestTargeting {
  topics?: string[];           // e.g., ["cooking", "travel"]
  categories?: string[];       // e.g., ["food", "lifestyle"]
  behaviors?: string[];        // e.g., ["frequent_chat_user", "active_feed_user"]
  customAudiences?: string[];  // Custom audience list IDs
  lookalikeAudiences?: string[]; // Lookalike audience IDs
}
```

#### 3. Behavioral Targeting
```typescript
interface BehavioralTargeting {
  engagementLevel?: ('high' | 'medium' | 'low');
  deviceType?: ('mobile' | 'desktop' | 'tablet')[];
  timeOfDay?: { start: string; end: string }[]; // e.g., ["09:00", "17:00"]
  purchaseBehavior?: {
    hasPurchased?: boolean;
    purchaseCategories?: string[];
    priceRange?: { min: number; max: number };
  };
}
```

#### 4. Contextual Targeting
```typescript
interface ContextualTargeting {
  contextType?: ('chat' | 'feed' | 'explore' | 'profile' | 'search')[];
  slotType?: string[];
  contentTopics?: string[];    // Topics in surrounding content
  contentCategories?: string[]; // Categories in surrounding content
}
```

### Personalization Engine

The personalization engine uses ML models to predict ad relevance:

```typescript
interface PersonalizationModel {
  // Input features
  userFeatures: UserFeatures;
  adFeatures: {
    topics: string[];
    categories: string[];
    creativeType: string;
    objective: string;
  };
  contextFeatures: {
    contextType: string;
    slotType: string;
    surroundingContent?: {
      topics: string[];
      sentiment: number;
    };
  };
  
  // Model prediction
  relevanceScore: number;  // 0-1, predicted relevance
  clickProbability: number; // 0-1, predicted CTR
  conversionProbability: number; // 0-1, predicted conversion rate
}
```

---

## Integration with Platform Services

### Integration with Recommendation Service

The Ad Service integrates with the Recommendation Service to blend ads with organic content:

```typescript
// Recommendation Service calls Ad Service
interface AdPlacementRequest {
  userId: string;
  contextType: 'chat' | 'feed' | 'explore' | 'profile' | 'search';
  slotType: string;
  context: {
    topics?: string[];
    categories?: string[];
    roomId?: string;        // for chat context
    feedPosition?: number;  // for feed context
    searchQuery?: string;   // for search context
  };
  userFeatures?: UserFeatures; // Optional, Ad Service can fetch if not provided
  organicItems?: OrganicItem[]; // Organic recommendations for blending
}

interface AdPlacementResponse {
  ads: AdCandidate[];
  blending: {
    strategy: 'interleave' | 'top' | 'bottom';
    positions: number[]; // Positions where ads should be inserted
  };
}

// Recommendation Service blends ads with organic content
const blendedRecommendations = blendAdsWithOrganic(
  organicItems,
  adResponse.ads,
  adResponse.blending
);
```

### Integration with Chat Service / AI-Chat-Host

Chat services receive blended recommendations (including ads) and render them:

```typescript
// AI-Chat-Host receives recommendations (already blended)
interface Recommendation {
  type: 'agent' | 'ad' | 'utility';
  // ... other fields
  
  // If type === 'ad'
  ad?: {
    adId: string;
    creative: {
      type: 'image' | 'video' | 'carousel';
      url: string;
      headline?: string;
      description?: string;
      cta?: string;
    };
    targetUrl: string;
    advertiser?: {
      name: string;
      verified?: boolean;
    };
  };
}
```

### Event Integration

The Ad Service listens to platform events to update targeting and track performance:

```typescript
// Events consumed by Ad Service
- UserCreatedEvent → Update user features
- PostLikedEvent → Update user interests
- MessageCreatedEvent → Update chat behavior
- PostViewedEvent → Update feed behavior
- SearchQueryEvent → Update search behavior
- AdImpressionEvent → Track impressions
- AdClickEvent → Track clicks
- ConversionEvent → Track conversions (purchases, signups)
```

---

## Data Models

### Campaign Model

```typescript
interface Campaign {
  campaignId: string;
  advertiserId: string;
  
  // Basic Info
  name: string;
  objective: 'awareness' | 'traffic' | 'conversions' | 'engagement';
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'rejected';
  
  // Budget
  budget: {
    type: 'daily' | 'lifetime';
    amount: number;
    currency: string;
    pacing: 'even' | 'accelerated' | 'standard';
  };
  
  // Schedule
  schedule: {
    startDate: Date;
    endDate?: Date;
    timezone: string;
  };
  
  // Targeting
  targeting: {
    demographics: DemographicTargeting;
    interests: InterestTargeting;
    behaviors: BehavioralTargeting;
    contextual: ContextualTargeting;
    exclusions: {
      customAudiences?: string[];
      keywords?: string[];
    };
  };
  
  // Bidding
  bidding: {
    type: 'CPC' | 'CPM' | 'CPA';
    amount: number;
    optimizationGoal?: 'clicks' | 'impressions' | 'conversions';
  };
  
  // Performance
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
    roas?: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
}
```

### Ad Creative Model

```typescript
interface AdCreative {
  creativeId: string;
  campaignId: string;
  
  // Creative Assets
  assets: {
    primary: {
      type: 'image' | 'video' | 'carousel';
      url: string;
      dimensions?: { width: number; height: number };
      duration?: number; // for video
    };
    headline?: string;
    description?: string;
    cta?: string;
    logo?: string;
  };
  
  // Landing Page
  landingPage: {
    url: string;
    type: 'website' | 'app' | 'deep_link';
  };
  
  // Format
  format: {
    slotTypes: string[]; // Which slot types this creative supports
    contextTypes: string[]; // Which contexts this creative supports
  };
  
  // Status
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  
  // Performance
  performance: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
}
```

### Ad Impression Model

```typescript
interface AdImpression {
  impressionId: string;
  adId: string;
  campaignId: string;
  userId: string;
  
  // Context
  context: {
    contextType: string;
    slotType: string;
    position: number;
    timestamp: Date;
  };
  
  // User Context
  userFeatures: {
    age?: number;
    location?: string;
    interests?: string[];
  };
  
  // Outcome
  clicked: boolean;
  clickedAt?: Date;
  converted: boolean;
  convertedAt?: Date;
  
  // Revenue
  revenue: number; // Amount charged to advertiser
  revenueType: 'CPC' | 'CPM' | 'CPA';
}
```

---

## API Design

### Customer-Facing APIs (Advertiser Portal)

#### 1. Campaign Management

```typescript
// Create Campaign
POST /api/ads/campaigns
Request: {
  name: string;
  objective: 'awareness' | 'traffic' | 'conversions' | 'engagement';
  budget: { type: 'daily' | 'lifetime'; amount: number };
  schedule: { startDate: Date; endDate?: Date };
  targeting: TargetingConfig;
  bidding: { type: 'CPC' | 'CPM' | 'CPA'; amount: number };
}
Response: { campaignId: string; status: 'draft' | 'pending' }

// Update Campaign
PUT /api/ads/campaigns/:campaignId
Request: { /* partial campaign update */ }
Response: { campaign: Campaign }

// Get Campaign
GET /api/ads/campaigns/:campaignId
Response: { campaign: Campaign }

// List Campaigns
GET /api/ads/campaigns?advertiserId=xxx&status=active
Response: { campaigns: Campaign[]; total: number }

// Pause/Resume Campaign
POST /api/ads/campaigns/:campaignId/pause
POST /api/ads/campaigns/:campaignId/resume
```

#### 2. Creative Management

```typescript
// Upload Creative
POST /api/ads/creatives
Request: FormData {
  file: File;
  campaignId: string;
  headline?: string;
  description?: string;
  cta?: string;
  landingPageUrl: string;
}
Response: { creativeId: string; status: 'pending' }

// Get Creative
GET /api/ads/creatives/:creativeId
Response: { creative: AdCreative }

// List Creatives
GET /api/ads/creatives?campaignId=xxx
Response: { creatives: AdCreative[] }
```

#### 3. Analytics & Reporting

```typescript
// Get Campaign Performance
GET /api/ads/campaigns/:campaignId/performance?startDate=xxx&endDate=xxx
Response: {
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  breakdown: {
    byDate: Array<{ date: string; metrics: PerformanceMetrics }>;
    byCreative: Array<{ creativeId: string; metrics: PerformanceMetrics }>;
    byAudience: {
      demographics: { age: Record<string, number>; gender: Record<string, number> };
      locations: Record<string, number>;
      devices: Record<string, number>;
    };
  };
}

// Export Report
GET /api/ads/campaigns/:campaignId/report?format=csv|pdf
Response: File download
```

### Internal APIs (Service-to-Service)

#### 1. Ad Placement API

```typescript
// Request Ad Candidates
POST /api/ads/placement
Request: {
  userId: string;
  contextType: 'chat' | 'feed' | 'explore' | 'profile' | 'search';
  slotType: string;
  context: {
    topics?: string[];
    categories?: string[];
    roomId?: string;
    feedPosition?: number;
    searchQuery?: string;
  };
  userFeatures?: UserFeatures;
  maxAds?: number;
}
Response: {
  ads: Array<{
    adId: string;
    campaignId: string;
    creative: AdCreative;
    relevanceScore: number;
    qualityScore: number;
    estimatedCTR: number;
  }>;
  blending: {
    strategy: 'interleave' | 'top' | 'bottom';
    positions: number[];
  };
}
```

#### 2. Event Tracking API

```typescript
// Track Ad Impression
POST /api/ads/impressions
Request: {
  impressionId: string;
  adId: string;
  userId: string;
  context: { contextType: string; slotType: string; position: number };
  timestamp: Date;
}
Response: { success: boolean }

// Track Ad Click
POST /api/ads/clicks
Request: {
  impressionId: string;
  adId: string;
  userId: string;
  timestamp: Date;
}
Response: { success: boolean }

// Track Conversion
POST /api/ads/conversions
Request: {
  impressionId: string;
  adId: string;
  userId: string;
  conversionType: 'purchase' | 'signup' | 'download';
  value?: number;
  timestamp: Date;
}
Response: { success: boolean }
```

---

## Event-Driven Architecture

### Events Published by Ad Service

```typescript
// Campaign Status Changed
interface CampaignStatusChangedEvent {
  topic: 'ad.campaign.status.changed';
  data: {
    campaignId: string;
    advertiserId: string;
    oldStatus: string;
    newStatus: string;
    timestamp: Date;
  };
}

// Budget Exhausted
interface BudgetExhaustedEvent {
  topic: 'ad.campaign.budget.exhausted';
  data: {
    campaignId: string;
    advertiserId: string;
    budgetType: 'daily' | 'lifetime';
    timestamp: Date;
  };
}

// Ad Approved
interface AdApprovedEvent {
  topic: 'ad.creative.approved';
  data: {
    creativeId: string;
    campaignId: string;
    timestamp: Date;
  };
}
```

### Events Consumed by Ad Service

```typescript
// User Events (for feature updates)
- 'user.created'
- 'user.updated'
- 'user.profile.updated'

// Engagement Events (for targeting)
- 'post.liked'
- 'post.viewed'
- 'post.shared'
- 'message.created'
- 'search.query'

// Conversion Events (for tracking)
- 'purchase.completed'
- 'user.signed.up'
- 'app.installed'
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
**Goal**: Basic ad service with campaign management and simple placement

- [ ] Service setup (MongoDB, Kafka, Express)
- [ ] Campaign CRUD APIs
- [ ] Creative upload and storage
- [ ] Basic targeting (demographics, interests)
- [ ] Simple ad placement API
- [ ] Impression tracking
- [ ] Basic analytics

**Timeline**: 4-6 weeks

### Phase 2: Targeting & Personalization
**Goal**: Advanced targeting and relevance scoring

- [ ] Feature store integration
- [ ] Behavioral targeting
- [ ] Contextual targeting
- [ ] Relevance scoring model
- [ ] Lookalike audiences
- [ ] Custom audiences

**Timeline**: 3-4 weeks

### Phase 3: Auction & Bidding
**Goal**: Real-time auction system

- [ ] Auction engine
- [ ] Bid types (CPC, CPM, CPA)
- [ ] Quality score calculation
- [ ] Budget pacing
- [ ] Frequency capping
- [ ] Ad ranking

**Timeline**: 3-4 weeks

### Phase 4: Integration
**Goal**: Integrate with Recommendation Service

- [ ] Recommendation Service integration
- [ ] Ad blending logic
- [ ] Slot type definitions
- [ ] Context-aware placement
- [ ] Performance optimization

**Timeline**: 2-3 weeks

### Phase 5: Customer Portal
**Goal**: Self-service advertiser portal

- [ ] Advertiser registration
- [ ] Campaign creation UI
- [ ] Creative upload UI
- [ ] Analytics dashboard
- [ ] Reporting and exports
- [ ] Payment integration

**Timeline**: 4-6 weeks

### Phase 6: Advanced Features
**Goal**: Enterprise-grade features

- [ ] Policy and safety checks
- [ ] Fraud detection
- [ ] A/B testing framework
- [ ] Advanced analytics (attribution, funnel analysis)
- [ ] API for agencies
- [ ] Web tracking integration

**Timeline**: 6-8 weeks

---

## Technology Stack

### Core Services
- **Language**: TypeScript/Node.js
- **Database**: MongoDB (campaigns, creatives, impressions)
- **Cache**: Redis (feature store, frequency capping)
- **Message Queue**: Kafka (events)
- **File Storage**: Azure Blob Storage / S3 (creative assets)

### ML/AI
- **Feature Store**: Redis + MongoDB
- **Relevance Models**: TensorFlow.js or external ML service
- **Embeddings**: OpenAI / Azure OpenAI (for similarity)

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **API Gateway**: Existing API Gateway service
- **Monitoring**: Prometheus + Grafana

---

## Success Metrics

### Business Metrics
- **Revenue**: Total ad revenue (eCPM, eCPC)
- **Fill Rate**: Percentage of ad slots filled
- **CTR**: Average click-through rate
- **Conversion Rate**: Percentage of clicks that convert
- **ROAS**: Return on ad spend for advertisers

### Technical Metrics
- **Latency**: Ad placement API response time (< 100ms p95)
- **Throughput**: Requests per second
- **Availability**: 99.9% uptime
- **Accuracy**: Targeting accuracy, relevance score accuracy

### Advertiser Metrics
- **Campaign Performance**: CTR, conversions, ROAS
- **Budget Efficiency**: Actual spend vs. budget
- **Reach**: Unique users reached
- **Engagement**: Likes, shares, comments on ads

---

## Security & Privacy

### Data Privacy
- **GDPR Compliance**: User consent for ad targeting
- **Data Minimization**: Only collect necessary data
- **Anonymization**: Aggregate user features, don't store PII
- **Opt-Out**: Allow users to opt out of personalized ads

### Security
- **Authentication**: JWT for advertiser APIs
- **Authorization**: Role-based access control (RBAC)
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **Creative Validation**: Scan for malware, inappropriate content

### Policy Enforcement
- **Content Review**: Automated + manual review
- **Policy Rules**: Enforce platform policies
- **Brand Safety**: Block ads on sensitive content
- **Fraud Detection**: Detect click fraud, invalid traffic

---

## Conclusion

This Ad Service design provides a comprehensive, scalable architecture inspired by major platforms like Facebook and Instagram. It supports:

1. **Customer Self-Service**: Advertisers can register and manage campaigns
2. **Multi-Source Data Processing**: Processes data from chat, feed, posts, search, etc.
3. **Intelligent Placement**: Context-aware ad placement decisions
4. **Auction System**: Real-time bidding for optimal revenue
5. **Advanced Targeting**: Demographic, interest, behavioral, and contextual targeting
6. **Integration**: Seamless integration with Recommendation Service and platform services

The phased implementation approach allows for incremental development while maintaining a clear path to a full-featured ad platform.

