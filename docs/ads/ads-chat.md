lets proceed with the ad service, the ad service will be one of the main lines of revenue incorporated in everything like fb and insta. How is it designed in big apps? Is it correct to say the ad services receives data form all sources like the posts, user activity, cookies, public chat, pages and followers, friendship graphs, etc.. how does it receive the data, processes it, where does it store the ads requested to be on the platform and how does it decide where to put which ad?
ChatGPT said:

Below is a clear, deep, accurate, real-world-inspired explanation of how a full-scale Ad Service / Ad Delivery Platform is built in companies like Facebook, Instagram, TikTok, Google, Twitter, Snapchat, and how that architecture translates to your system.

I’ll give you the blueprint of how the “big players” do it, then translate it into a microservice design for your platform.

⭐ 1. High-Level Architecture in Big Apps

Let’s start with the big picture used by FB/IG/TikTok:

User Activity → Event Logs → Feature Store
                            → ML Models
Ad Server ← Campaigns ← Advertisers
          ↕
Ranking / Auction Engine
          ↕
Recommendation Layer (Feed, Chat, Stories, Explore)
          ↕
Client UI


The ad system is not one service, but a platform with multiple components:

Core Components:

Ad Server / Delivery Engine (real-time decision maker)

Campaign Manager / Advertiser UI

Targeting & Eligibility Engine

Feature Store + Event Collection

Ranking / Prediction Models

Auction System (if bidding)

Tracking + Attribution

Billing / Budget Pacing

Let’s break these down so you understand what each part does.

⭐ 2. What does the Ad Service actually do?

The Ad Service answers one question:

“Given user X in context Y, which ad should we show right now?”

To answer that, it must:

✔ Receive user activity signals

(from feed, messages, chat, explore, friends, agents, cookies, etc.)

✔ Evaluate all ads that are eligible

(based on targeting rules)

✔ Score each eligible ad

(using ML models: CTR prediction, relevance, quality)

✔ Run an auction or prioritization

(who wins the slot?)

✔ Return the winning ad

with the creative + call-to-action.

⭐ 3. How does the Ad Service receive data from all sources?
It does NOT call other services directly.

It uses event ingestion and behavior logs, just like FB/IG.

Data comes in via:
1) Kafka (real-time signals)

Everything emits events:

post.viewed

post.liked

post.shared

agent.chat.joined

chat.message.created

profile.viewed

friendship.accepted

search.query

page.visited

room.entered

story.viewed

These are consumed by:

Feature Ingestion Service

User Embedding Service

Ad Relevance Store

2) Batches from Data Lake

Daily/Hourly aggregations for ML:

user vectors

ad vectors

interest clusters

trending topics

lookalike audiences

3) Cookies (Web only)

Sent via client → API Gateway → Event pipeline.

⭐ 4. Data Storage Layers (VERY IMPORTANT)

Big platforms do not store everything in one DB.

They use a multi-layer storage architecture:
Layer 1 — Raw logs (Kafka, Data Lake)

All events go here first.

This includes messages like:

user123 clicked ad987
user234 viewed post555
user999 searched “cats”


This is immutable.

Layer 2 — Feature Store

Real-time & batch features for:

user profiles

age group

interests

embedding vector

device

browsing patterns

recent topics

chat sentiment

language

subscription type

ad profiles

target segments

embedding

category

CTR history

quality score

creative metadata

Think of:

Redis / RocksDB (low-latency)

Cassandra / Bigtable / DynamoDB (profile storage)

Layer 3 — Campaign & Ads DB

Stores:

campaigns

ads

creatives

budgets

pacing

approvals

targeting rules

This is like:

Postgres

Dynamo

Casandra

Not huge, but high integrity.

Layer 4 — Serving Indexes

Precomputed indexes:

ads by target segment

ads by category

ads by geo

ads by language

ads by demographic filters

These power fast ad retrieval.

⭐ 5. How Does Ad Selection Work?
Step 1 — Eligibility Filtering

From millions of ads → reduce to maybe 50–500.

Filter by:

geo

language

age group

interests

chat topic

user preferences

safety (blocked categories)

subscription level

agent involvement

content type (stories vs feed vs chat)

Step 2 — Scoring & Ranking

Use ML models to compute:

CTR prediction

Conversion likelihood

Relevance to topic

Relevance to user

Past user engagement

Ad quality (bad ads get penalized)

Model examples:

Deep neural networks

Gradient boosting models

Embedding similarity

Step 3 — Auction (if bidding model)

Ads with bid + predicted CTR give:

score = bid * predicted_ctr


Winner = highest score.

Step 4 — Budget & Pacing

Don’t show ad too often; respect:

daily budget

cap per user

cap per hour

global pacing

fairness

campaign priority

Step 5 — Return final ad to the client
⭐ 6. “Where does the Ad live?”

Ads are stored in Ad Storage:

Ads table

Campaigns table

Creatives table

Targeting metadata

Budget table

Pacing state

Approval/Moderation

Sample schema:

adId
campaignId
headline
creativeUrl
cta
targetCriteria
status
budgetRemaining
startDate
endDate
qualityScore

⭐ 7. How does the Ad Service decide where to show ads?

This is an extremely important part.

Ads are placed into slots.

Examples in your app:

Feed:

every N posts

between image-content

in stories

in explore

Chat:

above messages

below messages

inside AI recommendations area

mid-chat recommendation strip

in agent profiles

in utility drawer

in "You may like" modal

Agents:

when opening agent profile

when training agent

when browsing marketplaces

Recommendation Service triggers ads

The RecService calls the Ad Service:

POST /adslots/fill
{
  "userId": "...",
  "contextType": "chat",
  "slotType": "chat_suggestion_bar",
  "topics": ["travel", "japan"],
  "device": "ios",
  "language": "en",
  ...
}


Ad Service returns:

{
  "slot": "chat_suggestion_bar",
  "ad": { ... }
}

⭐ 8. How is ad delivery integrated with chat?

Your AI-Chat-Host does:

Get recommendations from RecService

See if RecService returned “ad slots”

If needed, call Ad Service

Render ads in the suggestion area like:

“sponsored suggestion”

“recommended by partner”

“promoted expert agent”

“travel deal sponsored”

Example:

The chat topic is Tokyo, the user is planning a trip, so:

RecService identifies "travel" + "japan" from chat window

Calls Ad Service for travel ads

Returns ads for hotels, tours, flights, etc.

Chat UI displays a subtle, non-intrusive, topic-relevant ad.

This is how Instagram stories & TikTok do ads seamlessly.

⭐ 9. How does the Ad Service receive all signals?

This is important:

It does NOT call your other services.

It receives everything via Kafka events + streams.

Every service emits:

feed events → AdService Feature Ingestor

chat events → AdService

agent events → AdService

profile events → AdService

friendship events → AdService

cookies/events → Web Ingestor → Kafka → AdService

This is how FB’s “Ads Delivery” team receives global signals.

⭐ 10. How do big apps keep it real-time?

They rely on:

Kafka for streaming

RocksDB or Redis for in-memory features

Cassandra / BigTable for persistent user profiles

Scoring models running in a low-latency inference cluster

Fast candidate selection indexes

High-performance caching

Latency target:

5–15ms for ad selection  
50–100ms end-to-end  


You don’t need that in v1 — but can grow toward it.

⭐ 11. Your Final Architecture (Phase 1 → Phase 3)
Phase 1 (MVP)

Store campaigns + ads in Postgres/Mongo

Manual targeting fields

RecService → AdService matching

No auction

No pacing

Simple rules

Real-time events via Kafka

Phase 2

Add ML scoring

Add pacing

Add budgets & frequency capping

Add embedding similarity

Add multi-slot ad blending

Phase 3

Full bidding/auction

Advanced user & ad embeddings

Real-time feature store

Multi-surface unified ad delivery

Click attribution

Budget optimization

Agent-specific ad formats

This becomes a revenue engine for your platform.

⭐ Summary (Short)

Big apps use an Ad Delivery Platform, not a single service.

Key components:

Ad Server

Campaign Manager

Targeting Engine

Feature Store

ML Models

Auction System

Event Logs

Billing

Data arrives via Kafka streams, not direct calls.

Ads are chosen based on:

eligibility

targeting

scoring

budget/pacing

ranking/auction

Ads are stored in campaign tables with creatives, budgets, rules.

RecService triggers ads, not the chat service.

Chat UI is just a slot that receives ads.

⭐ Want the implementation next?

Pick one:

A) Full microservice architecture of your Ad Platform
B) Campaign DB schema (ads, creatives, budgets, pacing)
C) Ad selection algorithm (v1, v2, v3)
D) How RecService integrates with the AdService
E) Kubernetes + Kafka setup for the Ad Platform
F) AdService API design (in TypeScript)

Tell me which one to build.