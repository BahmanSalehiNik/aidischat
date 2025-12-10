# Ad Service - Execution Plan

## Overview

This execution plan provides a detailed, phased approach to implementing the Ad Service based on the consolidated design. It breaks down the implementation into manageable phases with specific tasks, timelines, and dependencies.

**Reference Documents**:
- Consolidated Design: `docs/ad-consolidated-design.md`
- Comprehensive Design: `docs/ad-service-design.md`
- Event-Driven Approach: `docs/ads/ads-chat.md`

---

## Implementation Phases Summary

| Phase | Duration | Focus | Key Deliverables |
|-------|----------|-------|------------------|
| **Phase 0: Foundation** | 2 weeks | Infrastructure setup | Service skeleton, Kafka integration, MongoDB setup |
| **Phase 1: MVP** | 6-8 weeks | Basic ad serving | Campaign CRUD, simple targeting, ad placement API |
| **Phase 2: Targeting & Scoring** | 4-6 weeks | Advanced targeting | Feature store, relevance scoring, behavioral targeting |
| **Phase 3: Auction & Bidding** | 4-6 weeks | Revenue optimization | Auction engine, bidding, budget pacing |
| **Phase 4: Integration** | 3-4 weeks | Platform integration | RecService integration, client service updates |
| **Phase 5: Customer Portal** | 6-8 weeks | Self-service | Advertiser portal, campaign management UI |
| **Phase 6: Advanced Features** | 8-10 weeks | Enterprise features | ML models, analytics, fraud detection |

**Total Timeline**: ~33-46 weeks (~8-11 months)

---

## Phase 0: Foundation (Weeks 1-2)

### Goals
- Set up service infrastructure
- Establish event-driven architecture
- Create basic data models

### Tasks

#### Week 1: Service Setup
- [ ] **Create Ad Service repository structure**
  - [ ] Initialize TypeScript project
  - [ ] Set up Express server
  - [ ] Configure TypeScript, ESLint, Prettier
  - [ ] Add Dockerfile
  - [ ] Create Kubernetes deployment files
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

- [ ] **Set up MongoDB**
  - [ ] Create MongoDB deployment (Kubernetes)
  - [ ] Design database schema (campaigns, ads, creatives)
  - [ ] Set up indexes
  - [ ] Create Mongoose models
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

- [ ] **Set up Redis**
  - [ ] Create Redis deployment (Kubernetes)
  - [ ] Configure Redis client
  - [ ] Design feature store structure
  - [ ] **Owner**: Backend Team
  - **Estimate**: 1 day

#### Week 2: Event Integration
- [ ] **Kafka Integration**
  - [ ] Set up Kafka client (kafkajs)
  - [ ] Create event listener base classes
  - [ ] Implement event publisher base classes
  - [ ] Test event publishing/consuming
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

- [ ] **Feature Ingestion Service (Basic)**
  - [ ] Create FeatureIngestionService
  - [ ] Implement event listeners for:
    - [ ] UserCreatedEvent
    - [ ] PostLikedEvent
    - [ ] MessageCreatedEvent
  - [ ] Basic feature extraction logic
  - [ ] Update Redis feature store
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

- [ ] **Health Check & Monitoring**
  - [ ] Add health check endpoint
  - [ ] Set up basic logging
  - [ ] Add metrics collection (Prometheus)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 1 day

### Deliverables
- ✅ Ad Service service running in Kubernetes
- ✅ MongoDB with basic schemas
- ✅ Redis feature store
- ✅ Kafka event listeners consuming platform events
- ✅ Basic feature extraction working

### Dependencies
- Kafka cluster running
- MongoDB cluster running
- Redis cluster running
- Platform services emitting events

---

## Phase 1: MVP (Weeks 3-10)

### Goals
- Basic campaign management
- Simple ad placement API
- Manual targeting
- Impression tracking

### Tasks

#### Week 3-4: Campaign Management
- [ ] **Campaign CRUD APIs**
  - [ ] POST /api/ads/campaigns (create)
  - [ ] GET /api/ads/campaigns/:id (get)
  - [ ] PUT /api/ads/campaigns/:id (update)
  - [ ] DELETE /api/ads/campaigns/:id (delete)
  - [ ] GET /api/ads/campaigns (list)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Campaign Data Models**
  - [ ] Campaign model (Mongoose)
  - [ ] Campaign status workflow (draft → pending → active)
  - [ ] Budget tracking (daily/lifetime)
  - [ ] Schedule management (start/end dates)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

- [ ] **Ad Creative Management**
  - [ ] POST /api/ads/creatives (upload)
  - [ ] GET /api/ads/creatives/:id
  - [ ] Creative storage (Azure Blob / S3)
  - [ ] Creative validation (size, format)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

#### Week 5-6: Targeting & Eligibility
- [ ] **Basic Targeting Engine**
  - [ ] Demographic targeting (age, gender, location)
  - [ ] Interest targeting (topics, categories)
  - [ ] Targeting rule evaluation
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Eligibility Filtering**
  - [ ] Filter ads by targeting rules
  - [ ] Filter by campaign status (active only)
  - [ ] Filter by budget availability
  - [ ] Filter by schedule (start/end dates)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

- [ ] **Serving Indexes (Basic)**
  - [ ] Create Redis indexes for:
    - [ ] Active campaigns
    - [ ] Ads by geo
    - [ ] Ads by topic
  - [ ] Index update on campaign/ad changes
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

#### Week 7-8: Ad Placement API
- [ ] **Ad Placement Endpoint**
  - [ ] POST /api/ads/placement
  - [ ] Request validation
  - [ ] User feature lookup (Redis)
  - [ ] Candidate ad generation
  - [ ] Simple relevance scoring (rule-based)
  - [ ] Return top N ads
  - [ ] **Owner**: Backend Team
  - **Estimate**: 6 days

- [ ] **Slot Type Definitions**
  - [ ] Define slot types (chat_banner, feed_card, etc.)
  - [ ] Slot format validation
  - [ ] Slot position rules
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

#### Week 9-10: Tracking & Analytics
- [ ] **Impression Tracking**
  - [ ] POST /api/ads/impressions
  - [ ] Store impressions in MongoDB
  - [ ] Update campaign performance metrics
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

- [ ] **Click Tracking**
  - [ ] POST /api/ads/clicks
  - [ ] Store clicks in MongoDB
  - [ ] Update campaign CTR
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

- [ ] **Basic Analytics API**
  - [ ] GET /api/ads/campaigns/:id/performance
  - [ ] Calculate metrics (impressions, clicks, CTR, spend)
  - [ ] Return performance data
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

### Deliverables
- ✅ Campaign CRUD APIs working
- ✅ Creative upload and storage
- ✅ Basic targeting (demographics, interests)
- ✅ Ad placement API returning ads
- ✅ Impression and click tracking
- ✅ Basic analytics

### Success Metrics
- Ad placement API latency: < 100ms (p95)
- Can create and manage campaigns
- Can serve ads based on basic targeting
- Tracks impressions and clicks

---

## Phase 2: Targeting & Scoring (Weeks 11-16)

### Goals
- Advanced targeting capabilities
- Relevance scoring
- Behavioral targeting
- Feature store enhancements

### Tasks

#### Week 11-12: Feature Store Enhancement
- [ ] **Enhanced Feature Extraction**
  - [ ] Process all platform events:
    - [ ] PostViewedEvent
    - [ ] PostSharedEvent
    - [ ] SearchQueryEvent
    - [ ] FriendshipAcceptedEvent
  - [ ] Aggregate behavioral signals
  - [ ] Update user features in Redis
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Feature Store Persistence**
  - [ ] Sync Redis → MongoDB (async)
  - [ ] User profile persistence
  - [ ] Feature history tracking
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

- [ ] **Feature Store APIs**
  - [ ] GET /api/ads/features/user/:userId
  - [ ] Manual feature update (admin)
  - [ ] Feature validation
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

#### Week 13-14: Advanced Targeting
- [ ] **Behavioral Targeting**
  - [ ] Engagement level targeting
  - [ ] Device type targeting
  - [ ] Time-of-day targeting
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

- [ ] **Contextual Targeting**
  - [ ] Context type targeting (chat, feed, etc.)
  - [ ] Content topic matching
  - [ ] Content category matching
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

- [ ] **Custom Audiences**
  - [ ] Create custom audience lists
  - [ ] Upload audience (CSV, API)
  - [ ] Audience targeting in campaigns
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

#### Week 15-16: Relevance Scoring
- [ ] **Relevance Scoring Engine**
  - [ ] Topic similarity scoring
  - [ ] Interest match scoring
  - [ ] Behavioral fit scoring
  - [ ] Context fit scoring
  - [ ] Combined relevance score (0-1)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 6 days

- [ ] **Scoring Model Integration**
  - [ ] Rule-based scoring (v1)
  - [ ] Scoring weights configuration
  - [ ] A/B testing framework (basic)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

### Deliverables
- ✅ Enhanced feature store with all platform events
- ✅ Behavioral and contextual targeting
- ✅ Custom audiences
- ✅ Relevance scoring engine
- ✅ Rule-based scoring working

### Success Metrics
- Feature store updates in < 100ms
- Relevance scores correlate with user engagement
- Targeting accuracy improves CTR

---

## Phase 3: Auction & Bidding (Weeks 17-22)

### Goals
- Real-time auction system
- Multiple bid types (CPC, CPM, CPA)
- Budget pacing
- Frequency capping

### Tasks

#### Week 17-18: Auction Engine
- [ ] **Auction System**
  - [ ] Second-price auction implementation
  - [ ] Quality score calculation (relevance × bid)
  - [ ] Ad ranking by quality score
  - [ ] Winner selection
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Bid Types**
  - [ ] CPC (Cost Per Click) support
  - [ ] CPM (Cost Per Mille) support
  - [ ] CPA (Cost Per Action) support
  - [ ] Bid validation
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

- [ ] **Charge Calculation**
  - [ ] Calculate charge for winner
  - [ ] Update campaign spend
  - [ ] Budget deduction
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

#### Week 19-20: Budget Management
- [ ] **Budget Pacing**
  - [ ] Even pacing strategy
  - [ ] Daily budget tracking
  - [ ] Lifetime budget tracking
  - [ ] Budget exhaustion handling
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Budget Alerts**
  - [ ] Budget threshold alerts
  - [ ] Budget exhausted events
  - [ ] Campaign auto-pause on budget exhaustion
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

#### Week 21-22: Frequency Capping
- [ ] **Frequency Capping**
  - [ ] Per-user frequency caps
  - [ ] Per-campaign frequency caps
  - [ ] Per-slot frequency caps
  - [ ] Frequency cap storage (Redis)
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Diversity Rules**
  - [ ] Max same advertiser per slot
  - [ ] Min spacing between ads
  - [ ] Diversity enforcement
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

### Deliverables
- ✅ Auction engine working
- ✅ CPC, CPM, CPA bid types
- ✅ Budget pacing (even strategy)
- ✅ Frequency capping
- ✅ Diversity rules

### Success Metrics
- Auction completes in < 10ms
- Budget pacing accurate (within 5%)
- Frequency caps enforced correctly

---

## Phase 4: Integration (Weeks 23-26)

### Goals
- Integrate with Recommendation Service
- Update client services
- End-to-end ad serving

### Tasks

#### Week 23-24: Recommendation Service Integration
- [ ] **RecService Ad Integration**
  - [ ] RecService calls Ad Service placement API
  - [ ] Ad Service returns candidate ads
  - [ ] RecService blends ads with organic content
  - [ ] Blending strategy (interleave, top, bottom)
  - [ ] **Owner**: Backend Team (RecService + Ad Service)
  - **Estimate**: 6 days

- [ ] **Slot Type Integration**
  - [ ] Define slot types in RecService
  - [ ] Slot type mapping
  - [ ] Context-aware slot selection
  - [ ] **Owner**: Backend Team
  - **Estimate**: 2 days

#### Week 25: Client Service Updates
- [ ] **AI-Chat-Host Updates**
  - [ ] Handle ad recommendations in UI
  - [ ] Render ad banners
  - [ ] Track ad impressions/clicks
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 4 days

- [ ] **Feed Service Updates**
  - [ ] Handle ad recommendations in feed
  - [ ] Render ad cards
  - [ ] Track ad impressions/clicks
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 4 days

#### Week 26: End-to-End Testing
- [ ] **Integration Testing**
  - [ ] Test ad flow: RecService → Ad Service → Client
  - [ ] Test ad rendering in chat
  - [ ] Test ad rendering in feed
  - [ ] Test impression/click tracking
  - [ ] **Owner**: QA Team
  - **Estimate**: 5 days

- [ ] **Performance Testing**
  - [ ] Load testing ad placement API
  - [ ] Latency testing (< 100ms target)
  - [ ] Throughput testing
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

### Deliverables
- ✅ RecService integrated with Ad Service
- ✅ Ads showing in chat and feed
- ✅ Impression/click tracking working
- ✅ End-to-end flow tested

### Success Metrics
- Ads appear in chat and feed
- Impression/click tracking accurate
- Ad placement latency < 100ms

---

## Phase 5: Customer Portal (Weeks 27-34)

### Goals
- Self-service advertiser portal
- Campaign management UI
- Analytics dashboard

### Tasks

#### Week 27-28: Advertiser Authentication
- [ ] **Advertiser Account Management**
  - [ ] Advertiser registration
  - [ ] Advertiser authentication (JWT)
  - [ ] Advertiser profile management
  - [ ] Payment method setup
  - [ ] **Owner**: Backend Team
  - **Estimate**: 5 days

- [ ] **Authorization**
  - [ ] Role-based access control (RBAC)
  - [ ] Campaign ownership validation
  - [ ] API authentication middleware
  - [ ] **Owner**: Backend Team
  - **Estimate**: 3 days

#### Week 29-30: Campaign Management UI
- [ ] **Campaign Creation UI**
  - [ ] Campaign creation form
  - [ ] Budget configuration
  - [ ] Schedule configuration
  - [ ] Targeting configuration UI
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 6 days

- [ ] **Creative Upload UI**
  - [ ] File upload component
  - [ ] Image preview
  - [ ] Creative validation
  - [ ] Creative management (list, edit, delete)
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 4 days

#### Week 31-32: Campaign Management Features
- [ ] **Campaign List & Dashboard**
  - [ ] Campaign list view
  - [ ] Campaign filters (status, date, performance)
  - [ ] Campaign actions (pause, resume, delete)
  - [ ] Campaign overview cards
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 5 days

- [ ] **Campaign Details Page**
  - [ ] Campaign information display
  - [ ] Performance metrics
  - [ ] Ad creative preview
  - [ ] Targeting summary
  - [ ] Budget and pacing display
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 5 days

#### Week 33-34: Analytics Dashboard
- [ ] **Analytics UI**
  - [ ] Performance metrics display
  - [ ] Charts and graphs (impressions, clicks, CTR)
  - [ ] Date range selector
  - [ ] Audience insights
  - [ ] **Owner**: Frontend Team
  - **Estimate**: 6 days

- [ ] **Reporting**
  - [ ] Export reports (CSV, PDF)
  - [ ] Scheduled reports
  - [ ] Report templates
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

### Deliverables
- ✅ Advertiser portal (web UI)
- ✅ Campaign creation and management
- ✅ Creative upload and management
- ✅ Analytics dashboard
- ✅ Reporting features

### Success Metrics
- Advertisers can create campaigns independently
- Campaign management UI intuitive
- Analytics dashboard shows accurate data

---

## Phase 6: Advanced Features (Weeks 35-44)

### Goals
- ML models for scoring
- Advanced analytics
- Fraud detection
- Policy enforcement

### Tasks

#### Week 35-36: ML Model Integration
- [ ] **CTR Prediction Model**
  - [ ] Train CTR prediction model
  - [ ] Model deployment
  - [ ] Model inference in ad placement
  - [ ] Model performance monitoring
  - [ ] **Owner**: ML Team
  - **Estimate**: 8 days

- [ ] **Relevance Model**
  - [ ] Train relevance model
  - [ ] Model deployment
  - [ ] Replace rule-based scoring
  - [ ] A/B testing framework
  - [ ] **Owner**: ML Team
  - **Estimate**: 6 days

#### Week 37-38: Embeddings & Similarity
- [ ] **User Embeddings**
  - [ ] Generate user embeddings from features
  - [ ] Store embeddings in feature store
  - [ ] Update embeddings on new events
  - [ ] **Owner**: ML Team
  - **Estimate**: 5 days

- [ ] **Ad Embeddings**
  - [ ] Generate ad embeddings from creative + targeting
  - [ ] Store ad embeddings
  - [ ] Similarity matching (user-ad)
  - [ ] **Owner**: ML Team
  - **Estimate**: 5 days

#### Week 39-40: Advanced Analytics
- [ ] **Attribution Modeling**
  - [ ] Last-click attribution
  - [ ] Multi-touch attribution (future)
  - [ ] Conversion tracking
  - [ ] **Owner**: Backend Team
  - **Estimate**: 6 days

- [ ] **Advanced Metrics**
  - [ ] ROAS (Return on Ad Spend)
  - [ ] LTV (Lifetime Value)
  - [ ] Funnel analysis
  - [ ] Cohort analysis
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

#### Week 41-42: Policy & Safety
- [ ] **Content Review**
  - [ ] Automated content scanning
  - [ ] Policy rule engine
  - [ ] Manual review workflow
  - [ ] Approval/rejection system
  - [ ] **Owner**: Backend Team
  - **Estimate**: 6 days

- [ ] **Fraud Detection**
  - [ ] Click fraud detection
  - [ ] Impression fraud detection
  - [ ] Bot detection
  - [ ] Fraud alerts
  - [ ] **Owner**: Backend Team
  - **Estimate**: 4 days

#### Week 43-44: Optimization & Performance
- [ ] **Performance Optimization**
  - [ ] Ad placement latency optimization (< 20ms)
  - [ ] Feature store optimization
  - [ ] Index optimization
  - [ ] Caching strategies
  - [ ] **Owner**: Backend Team
  - **Estimate**: 6 days

- [ ] **Monitoring & Alerting**
  - [ ] Advanced monitoring (Prometheus, Grafana)
  - [ ] Alerting rules
  - [ ] Performance dashboards
  - [ ] Error tracking
  - [ ] **Owner**: DevOps Team
  - **Estimate**: 4 days

### Deliverables
- ✅ ML models for CTR and relevance prediction
- ✅ User and ad embeddings
- ✅ Advanced analytics and attribution
- ✅ Policy and fraud detection
- ✅ Optimized performance (< 20ms)

### Success Metrics
- ML models improve CTR by 20%+
- Ad placement latency < 20ms (p95)
- Fraud detection accuracy > 95%
- Policy violations caught automatically

---

## Technical Stack

### Backend
- **Language**: TypeScript/Node.js
- **Framework**: Express.js
- **Database**: MongoDB (campaigns, ads, features)
- **Cache**: Redis (feature store, indexes, frequency caps)
- **Message Queue**: Kafka (events)
- **File Storage**: Azure Blob Storage / S3 (creatives)
- **ML/AI**: TensorFlow.js or external ML service

### Frontend (Customer Portal)
- **Framework**: React / Next.js
- **State Management**: Redux / Zustand
- **UI Library**: Material-UI / Ant Design
- **Charts**: Chart.js / Recharts

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

---

## Risk Management

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **High latency** | High | Start with < 100ms, optimize incrementally |
| **Event volume** | Medium | Use Kafka partitioning, batch processing |
| **Feature store consistency** | Medium | Accept eventual consistency, Redis as source of truth |
| **ML model complexity** | Medium | Start with rule-based, add ML incrementally |
| **Cost of infrastructure** | Medium | Start small, scale based on revenue |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Low advertiser adoption** | High | Focus on easy onboarding, good UX |
| **Ad quality issues** | Medium | Strong content review, policy enforcement |
| **Fraud** | High | Implement fraud detection early |
| **Competition** | Medium | Focus on unique targeting (chat context) |

---

## Success Criteria

### Phase 1 (MVP)
- ✅ Can create and manage campaigns
- ✅ Can serve ads based on basic targeting
- ✅ Tracks impressions and clicks
- ✅ Ad placement API latency < 100ms

### Phase 2-3 (Core Features)
- ✅ Advanced targeting working
- ✅ Relevance scoring improves CTR
- ✅ Auction system working
- ✅ Budget pacing accurate

### Phase 4 (Integration)
- ✅ Ads showing in chat and feed
- ✅ End-to-end flow working
- ✅ Tracking accurate

### Phase 5 (Customer Portal)
- ✅ Advertisers can self-serve
- ✅ Campaign management intuitive
- ✅ Analytics accurate

### Phase 6 (Advanced)
- ✅ ML models improve performance
- ✅ Latency < 20ms
- ✅ Fraud detection working
- ✅ Policy enforcement automated

---

## Next Steps

1. **Review this execution plan** with the team
2. **Prioritize phases** based on business needs
3. **Assign owners** for each phase
4. **Start Phase 0** (Foundation)
5. **Set up project tracking** (Jira, GitHub Projects, etc.)

---

## Appendix: Detailed Task Breakdown

### Phase 1 Detailed Tasks

#### Campaign Management (Week 3-4)
```
- Create Campaign API
  - Request validation
  - Campaign creation
  - Status: draft
  - Return campaignId
  
- Get Campaign API
  - Fetch from MongoDB
  - Return campaign data
  
- Update Campaign API
  - Partial updates
  - Status transitions
  - Validation
  
- List Campaigns API
  - Filtering (status, advertiser, date)
  - Pagination
  - Sorting
  
- Delete Campaign API
  - Soft delete (status: deleted)
  - Cascade to ads
```

#### Ad Placement (Week 7-8)
```
- Ad Placement Request
  - Validate request
  - Extract user features (Redis)
  - Get candidate ads (indexes)
  - Filter by eligibility
  - Score ads (relevance)
  - Rank ads
  - Return top N
  
- Slot Type Validation
  - Check slot type exists
  - Validate format
  - Check position rules
```

### Phase 2 Detailed Tasks

#### Feature Store (Week 11-12)
```
- Event Processing
  - Consume events from Kafka
  - Extract features
  - Update Redis
  - Async write to MongoDB
  
- Feature Aggregation
  - Aggregate behavioral signals
  - Calculate engagement scores
  - Update interest vectors
```

#### Relevance Scoring (Week 15-16)
```
- Scoring Components
  - Topic similarity (0-1)
  - Interest match (0-1)
  - Behavioral fit (0-1)
  - Context fit (0-1)
  
- Combined Score
  - Weighted combination
  - Normalize to 0-1
  - Cache scores
```

---

## Notes

- **Flexibility**: This plan is a guide. Adjust timelines and priorities based on business needs.
- **Parallel Work**: Some phases can be worked on in parallel (e.g., Customer Portal can start after Phase 1).
- **Incremental Delivery**: Each phase should deliver working features, not just code.
- **Testing**: Include testing in each phase, not as a separate phase.
- **Documentation**: Document as you build, not after.

