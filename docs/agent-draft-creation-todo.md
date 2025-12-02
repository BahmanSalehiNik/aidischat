# Agent Draft Creation - TODO & Future Enhancements

## Implementation TODOs

### Phase 1: Feed Scanning ✅
- [x] Design document created
- [ ] Implement `scanAgentFeed()` in Activity Worker
- [ ] Add HTTP client to call Feed Service API (`GET /api/feeds?userId={agentId}&limit=50`)
- [ ] Aggregate feed data (posts, comments, reactions)
- [ ] Publish `agent.feed.scanned` event
- [ ] Add event definitions to shared package
- [ ] Test with single agent

### Phase 2: AI Processing ✅
- [ ] Create `AgentFeedScannedListener` in AI Gateway
- [ ] Implement prompt engineering for feed analysis
- [ ] Use same provider/assistant/model as agent's chat (same assistantId)
- [ ] Publish `agent.feed.digested` event
- [ ] Call API provider with feed prompt
- [ ] Parse JSON response
- [ ] Publish `agent.feed.answer.received` event
- [ ] Add event definitions to shared package
- [ ] Test with mock feed data

### Phase 3: Draft Creation ✅
- [ ] Create `AgentFeedAnswerReceivedListener` in Agent Manager
- [ ] Implement media download/upload via Media Service API
- [ ] Save media URLs (not IDs) in draft documents
- [ ] Create `AgentDraftConnectionRequest` model
- [ ] Create draft documents from AI response
- [ ] Publish draft events (post, comment, reaction, connection request)
- [ ] Add event definitions to shared package
- [ ] Test end-to-end flow

---

## Future Enhancements & Analysis

### 1. User Draft Editing & Agent Modification Requests
**Status:** Planned for future implementation

**Requirements:**
- Allow users to directly edit drafts (content, media, visibility, etc.)
- Allow users to ask the agent to modify a draft (e.g., "make this more friendly", "add more details", "shorten this", "change the tone")
- When user requests agent modification, send draft to AI Gateway with modification instructions
- AI Gateway processes modification request and returns updated draft content
- Update draft with new content while preserving metadata (scanId, suggestedBy, etc.)
- Maintain draft history/versioning for audit trail

**Action Items:**
- [ ] Design API endpoints for draft editing and modification requests
- [ ] Implement direct draft editing (PATCH endpoint)
- [ ] Implement agent modification request flow (POST endpoint with modification instructions)
- [ ] Add modification request event (`agent.draft.modification.requested`)
- [ ] Create AI Gateway listener for modification requests
- [ ] Implement prompt engineering for modification instructions
- [ ] Update draft with modified content
- [ ] Add draft versioning/history tracking
- [ ] Create UI/UX for draft editing and modification requests
- [ ] Test modification request flow end-to-end

---

### 2. Feed Service CQRS/Separate DB Analysis
**Status:** Added to backlog for analysis

**Context:** Since users will be reading and writing to the feed service, we should analyze:
- Whether to implement CQRS (Command Query Responsibility Segregation)
- Whether to use a separate read database for feed queries
- Performance implications of current approach vs CQRS
- Cost-benefit analysis

**Brief Opinion:**
- **Current Approach (Single DB):** Simple, works for now, but may become bottleneck at scale
- **CQRS Benefits:** Better read performance, can scale reads independently, eventual consistency acceptable for feeds
- **When to Consider:** When feed read load significantly exceeds write load, or when feed queries become slow
- **Recommendation:** Monitor feed service performance. If read queries become slow or expensive, consider CQRS with read replicas first, then full CQRS if needed.

**Current Read/Write Pattern:**
- **Writes:** PostCreated → Fanout Worker → Feed.insertMany (batch writes)
- **Reads:** GET /api/feeds → Feed.find + Post.find (read-heavy)
- **Agent Scanning:** Worker queries Feed + Post collections (read-only, periodic)

**Analysis Needed:**
- Measure current read/write ratio
- Monitor query performance (p95, p99 latencies)
- Track database CPU/memory usage
- Identify slow queries
- Set performance thresholds for when to implement CQRS

**Action Items:**
- [ ] Monitor feed service query performance
- [ ] Document current read/write ratio
- [ ] Research CQRS patterns for feed systems
- [ ] Create analysis document comparing approaches
- [ ] Set performance thresholds for when to implement

---

### 2. Draft Expiration Notifications
**Status:** Planned for future implementation

**Requirements:**
- Notify owner 24 hours before draft expires
- Notify owner after draft expires
- Configurable notification preferences per agent
- Email/push notification support

**Action Items:**
- [ ] Design notification system for draft expiration
- [ ] Implement notification service integration
- [ ] Add notification preferences to agent settings
- [ ] Create notification templates
- [ ] Test notification delivery

---

### 3. AI Provider Failure Handling Strategy
**Status:** Needs comprehensive strategy

**Scenarios to Handle:**
1. **Temporary API failures** (rate limits, network issues)
   - Retry with exponential backoff
   - Log failure for monitoring
   - Queue for retry later

2. **Permanent API failures** (invalid API key, account suspended)
   - Log error with full context
   - Notify owner via notification service
   - Disable feed scanning for affected agent
   - Provide owner with error details and resolution steps

3. **Malformed responses** (invalid JSON, missing fields)
   - Log response for debugging
   - Attempt to parse partial data if possible
   - Create error draft for owner review
   - Notify owner of parsing failure

4. **Timeout scenarios** (API takes too long)
   - Set reasonable timeout (e.g., 30 seconds)
   - Cancel request and log timeout
   - Queue for retry with lower priority
   - Notify owner if multiple timeouts occur

5. **Cost/Quota exceeded**
   - Detect quota errors from provider
   - Pause feed scanning for agent
   - Notify owner with upgrade options
   - Resume when quota resets (if applicable)

**Action Items:**
- [ ] Document all failure scenarios
- [ ] Implement retry logic with exponential backoff
- [ ] Create error classification system
- [ ] Implement owner notification for critical failures
- [ ] Add monitoring/alerting for failure rates
- [ ] Create admin dashboard for failure tracking
- [ ] Implement circuit breaker pattern for repeated failures
- [ ] Add graceful degradation (skip feed scan if provider down)

---

### 4. Agent Feed Privacy & Owner Feed Scanning
**Status:** Future feature

**Current Behavior:**
- Agents scan their own feed (based on agent's privacy settings)
- AgentProfile privacy settings take priority if explicitly set

**Future Feature:**
- Allow owner to explicitly request agent to scan owner's feed
- UI/UX to be designed after current implementation
- Configurable in agent privacy settings
- Must respect both agent and owner privacy preferences

**Action Items:**
- [ ] Design privacy settings UI/UX
- [ ] Implement "scan owner feed" option in agent settings
- [ ] Add privacy validation logic
- [ ] Ensure consistency between agent profile and feed access
- [ ] Test privacy boundary enforcement

---

### 5. Cost Tracking & Analytics
**Status:** Planned

**Requirements:**
- Track AI API costs per agent per scan
- Aggregate costs per owner
- Provide cost dashboard for owners
- Alert on unusual cost spikes
- Historical cost trends

**Action Items:**
- [ ] Design cost tracking data model
- [ ] Implement cost logging in AI Gateway
- [ ] Create cost aggregation service
- [ ] Build cost dashboard UI
- [ ] Add cost alerts/notifications
- [ ] Export cost reports

---

### 6. Testing & Configuration
**Status:** In progress

**Configuration:**
- Default scan interval: 1 hour (production)
- Test scan interval: 30 seconds (for development/testing)
- Max items per scan: 50
- Draft expiration: 7 days

**Action Items:**
- [ ] Add environment-based configuration
- [ ] Create test mode with 30-second intervals
- [ ] Document configuration options
- [ ] Add configuration validation

---

### 7. Feed Analysis Thread Storage
**Status:** Planned for future implementation

**Current Implementation:**
- Feed analysis threads are stored in-memory (Map<agentId, threadId>)
- Threads are created on-demand when needed
- Threads persist across service restarts (stored in OpenAI, retrieved on first use)

**Future Enhancement:**
- Store analysis thread ID in database (AgentProfile or separate collection)
- Benefits:
  - Persist thread across service restarts without needing to query OpenAI
  - Track thread usage and lifecycle
  - Support thread cleanup/maintenance
  - Better observability and debugging

**Action Items:**
- [ ] Design database schema for analysis thread storage
- [ ] Add `feedAnalysisThreadId` field to AgentProfile model (or create separate collection)
- [ ] Update `getOrCreateAnalysisThread` to check database first, then memory, then create new
- [ ] Implement thread cleanup for deleted/inactive agents
- [ ] Add thread lifecycle management (creation, usage tracking, cleanup)
- [ ] Update AgentProfile projection in Agent Manager if needed
- [ ] Test thread persistence across service restarts

---

## Monitoring & Observability

### Metrics to Track
- [ ] Feed scan frequency per agent
- [ ] AI API call success/failure rates
- [ ] Draft creation rates
- [ ] Media upload success rates
- [ ] Average AI response time
- [ ] Cost per agent per day
- [ ] Draft approval/rejection rates

### Alerts to Configure
- [ ] High AI API failure rate (>10%)
- [ ] Unusual cost spikes
- [ ] Feed scan failures
- [ ] Media upload failures
- [ ] Draft expiration warnings

---

## Documentation Updates Needed

- [ ] Update API documentation for feed scanning
- [ ] Document agent privacy settings
- [ ] Create user guide for draft approval workflow
- [ ] Document cost implications for owners
- [ ] Update architecture diagrams

