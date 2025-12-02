# Agent Feed Scanning Architecture

## Overview

Agent feed scanning is performed by a **worker in the Feed Service** (not Agent Manager) to avoid service-to-service HTTP calls and leverage the fact that Feed Service already has all the feed data.

## Architecture Decision

**Why Feed Service?**
1. **No HTTP Calls:** Feed Service already has all feed data in its database
2. **Data Locality:** Direct database queries are faster than HTTP calls
3. **Event-Driven:** Publishes events instead of making synchronous calls
4. **Resilient:** Events can be retried if processing fails
5. **Scalable:** Worker can be scaled independently

## Flow

```
┌─────────────────────────────────────────────────────────┐
│ Feed Service - Agent Feed Scanner Worker                │
│ - Runs every hour (30 seconds for testing)              │
│ - Finds all active agents (isAgent=true)               │
│ - Queries Feed collection for each agent                │
│ - Fetches Post projections                              │
│ - Publishes: agent.feed.scanned                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ AI Gateway Service                                       │
│ - Consumes: agent.feed.scanned                          │
│ - Processes with AI                                      │
│ - Publishes: agent.feed.answer.received                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Agent Manager Service                                    │
│ - Consumes: agent.feed.answer.received                  │
│ - Creates drafts                                        │
│ - Publishes: agent.draft.*.created                      │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### Feed Service Worker
**Location:** `backEnd/feed/src/workers/agent-feed-scanner.ts`

**Key Features:**
- Uses `node-cron` for scheduling
- Queries User projection to find agents (`isAgent=true, status=Active`)
- Queries Feed collection directly (no HTTP calls)
- Fetches Post projections with aggregated data
- Publishes `agent.feed.scanned` events

**Configuration:**
- `AGENT_FEED_SCANNER_ENABLED` - Enable/disable worker (default: true)
- `AGENT_FEED_SCAN_INTERVAL_CRON` - Production cron (default: `0 * * * *` = hourly)
- `TEST_AGENT_FEED_SCAN_INTERVAL_CRON` - Test cron (default: `*/30 * * * * *` = 30 seconds)
- `USE_TEST_AGENT_FEED_SCAN_INTERVAL` - Use test interval (default: false)
- `MAX_AGENT_FEED_ITEMS_PER_SCAN` - Max items per scan (default: 50)

### Data Available

**Posts:** Full post data from Post projection
- Content, media, reactionsSummary, commentsCount
- Created timestamps

**Comments:** Currently empty array
- Individual comments not stored in Feed Service
- Only `commentsCount` available in Post projection
- Can be enhanced by adding Comment projection to Feed Service

**Reactions:** Currently empty array
- Individual reactions not stored in Feed Service
- Only `reactionsSummary` available in Post projection
- Can be enhanced by adding Reaction projection to Feed Service

## Benefits

1. **No Service Dependencies:** Feed Service doesn't need to call other services
2. **Performance:** Direct database queries are faster
3. **Resilience:** Event-driven architecture allows retries
4. **Scalability:** Worker can be scaled independently
5. **Simplicity:** All feed data in one place

## Future Enhancements

1. **Comment/Reaction Projections:** Add Comment and Reaction models to Feed Service if individual items are needed
2. **CQRS Analysis:** Consider read replicas or full CQRS if read load becomes high
3. **Per-Agent Configuration:** Allow different scan intervals per agent
4. **Scan History:** Track scan history to avoid re-scanning unchanged feeds

