I want to create the ai-chat-host service now, but eventually I don't want to recommend only agents for invitations, I also want to make ad recommendations. Ad recommendations must also be possible based on other data like cookies(later phases), posts, comments, etc and not just in the chat. Looks like the recommendations also needs it's own service. How to design that how big apps like instagram or fb have implemented that.


You’re thinking about this exactly like a big platform would. 👍
Let’s design this so AI-Chat-Host doesn’t get painted into a corner and you can grow into full-blown ad + recommendation systems later.
I’ll break it into:


How Instagram/FB roughly structure recommendations & ads


How to carve your architecture: Chat Host vs Recommendation Service vs Ad Service


What to implement now for AI-Chat-Host so it plugs into that future cleanly



1. How “big apps” do it (simplified)
Places like Instagram / Facebook / TikTok all follow a very similar pattern:
A. Central Recommendation / Ranking Platform
Not “the feed service” or “the chat service”, but a separate infra layer that:


collects features about:


users (interests, embeddings, geolocation, device)


content (posts, videos, ads, agents, etc.)


context (where: feed, story, DM, search, chat)




runs ML models for:


candidate generation (find potentially relevant items)


ranking (score & order them)


blending (ads + organic + others)




logs impressions, clicks, likes, watch time, hides, etc.


feeds that back into training pipelines


B. Ads are a specialized recommendation problem
Ads are not just “things to recommend”.
They add:


advertisers & campaigns


budgets / pacing


targeting rules


bidding / auctions


frequency capping


policy/approval & safety


revenue optimization


So in big systems you often see:


Ad Delivery / Ad Server: runs auctions, picks which ad to show.


Relevance / Ranking: ML scores to predict click/engagement.


Inventory / Creative Store: ad objects, meta-data, status.


The feed service or chat service then calls these systems with a context:

“User X, context = feed, slot type = in-feed, page=1”
or
“User Y, context = chat, roomId=..., slot type = suggestion-bar”

and gets back:

a ranked set of organic items + ads.

So: one central recommendation platform and one (sometimes overlapping) ad delivery platform, used by many surfaces: feed, explore, stories, reels, search, etc.

2. Your architecture: split it cleanly
You’re about to build AI-Chat-Host. Later you want:


agent recommendations


chat-specific suggestions


PLUS


ad recommendations (driven also by cookies, feed behavior, etc.)


recommendations outside chat (feed, explore, etc.)


You do not want to bake all of that into AI-Chat-Host.
✅ Clean separation (high-level)


AI-Chat-Host Service


reads chat context (last N messages, room meta, participants)


calls Recommendation API with contextType="chat"


turns generic recommendations into chat-specific UX (invite agent, show banner, show suggestion modal)




Recommendation Service (Core Recommender)


takes a Context (chat, feed, profile, explore, notifications)


returns ranked items:


agent suggestions


content suggestions


maybe “system helpers”




later will call the Ad Service for ad slots and merge them




Ad Service / Ad Delivery (future)


owns:


campaigns


targeting


budgets


bidding/auction


creative selection




returns candidate ads + scores given user/context


integrates with Recommendation Service to insert ads into appropriate slots




The key idea:

AI-Chat-Host is a client of your Recommendation Platform, not the place where recommendation logic lives.


3. Concrete proposal: what to build now vs later
Phase 1: Build AI-Chat-Host + a minimal Recommendation Service
AI-Chat-Host Service (what we designed earlier):


listens to chat.message.created


keeps a sliding window per room


every 20 messages or 2 minutes → builds a “chat context summary”


calls RecommendationService.getRecommendations(context)


receives items like:
[
  { "type": "agent", "agentId": "agent_123", "score": 0.91 },
  { "type": "summary_offer", "score": 0.8 }
]



adapts them into UI:


invite button for suggested agents


“get summary” button


maybe “related room” suggestions later




Recommendation Service (v1)
Simple, no ads yet:


API:
POST /recommendations
{
  "userId": "...",
  "contextType": "chat",
  "roomId": "...",
  "topics": [...],
  "agentsInRoom": [...],
  "participants": [...]
}



logic (for now):


rule-based + maybe an LLM/embedding similarity model


pick relevant agents by:


tags / skills


recency


owner’s preferences






returns a list of agent suggestions plus maybe utility actions (summary, sentiment analysis, etc.)


At this point:


AI-Chat-Host does not know about ads


RecService only returns organic “things”



Phase 2: Evolve Recommendation Service into a general recommender
You start feeding it more contexts:


Feed:


contextType="feed" → “show posts & agents to follow”




Agent profile:


contextType="agent_profile" → “show similar agents, posts, etc.”




Explore tab:


contextType="explore" → “show trending stuff”




Internally, RecService:


uses a feature store (or at least a user profile DB)


aggregates signals from:


feed interactions (likes, shares, dwell time)


chat interactions (which agents user likes, which topics)


follows / friendships


agent feedback (for “favorite companions” suggestions)




Ads still aren’t here yet. This keeps it simple.

Phase 3: Add Ad Service and integrate it
Now you introduce ad-specific infrastructure:
Ad Service:


ads table:


adId, campaignId, targeting, creative, budget, status




campaigns table:


campaignId, owner, dailyBudget, bids, start/end, goals




user_ad_events logs:


impressions, clicks, views, hides, etc.




Ad Service provides an API like:
POST /adslots/fill
{
  "userId": "...",
  "contextType": "chat",
  "slotType": "chat_banner",
  "topics": [...],
  "device": "...",
  "locale": "...",
  "cookies": {...} // later
}

Returns:
{
  "slot": "chat_banner",
  "ad": {
    "adId": "ad_123",
    "creativeUrl": "...",
    "headline": "...",
    "cta": "Learn more",
    "targetUrl": "..."
  }
}

Now your Recommendation Service gets smarter:


It knows which slots can show ads (chat_banner, feed_card, etc.)


For each slot, it decides:


should we show organic content?


should we show an ad?


what mix (e.g., 1 ad out of every 5 suggestions)?




So a RecService call might now internally:


Generate organic candidates (agents, posts, suggestions)


Call Ad Service for matching ad slots


Merge lists with a blending/hybrid ranking (e.g. “ad if > threshold and not too frequent”)


AI-Chat-Host simply consumes the blended result.

Where cookies / web behaviour fit
Later, you add:


web tracking → writes to user_events / web_events


this populates user features like:


categories browsed


time-of-day patterns


regions


device




Ad Service + Recommendation Service both use those features as input into:


relevance models


auctions


candidate filtering




But those are inputs into Rec/Ad services, not AI-Chat-Host itself.

4. Does Recommendation Service need projections?
Yes — but not full chat history.
It will need:


user profile features:


userId, age range, locale, rough interests, embedding


recency of use, engagement levels, etc.




agent profile features:


archetype, tags, popularity, rating, RLHF-derived traits




content features (for posts, media, rooms):


embeddings


topics


popularity


freshness




These can live in:


a feature store (later)


or just well-indexed DB tables (now)


But Recommendation Service does not directly store all posts/messages; it just needs indexed, compact features.
The heavy-lifting storage is in:


Chat Service & History Service (for messages)


Feed/Posts Service (for posts/media)


Agent Service (for agents)


Ad Service (for ads)


RecService pulls features from them or from a shared feature store.

5. What to do right now for you
Given where you are:
Step 1 — Implement AI-Chat-Host as we discussed:


sliding windows per room


triggers every 20 messages or 2 minutes


calls a minimal Recommendation Service


Step 2 — Implement Recommendation Service v1:


No ads yet.


Focus on:


agent suggestions for chat


maybe “summary offer”




Basic data:


agent tags


owner’s relationship with agents


chat topics




Very simple rule-based + maybe an LLM if you want.


Step 3 — Keep the RecService API clean and generic:
Design it so you can later add:


contextType


slotType


userFeatures


cookies/session info


This way, when you add ads, you plug in an AdService without rewriting AI-Chat-Host.

6. Short answer to your main question

“Should recommendations (agents + ads + other) be a separate service?”

✅ Yes.
You want a Recommendation Service as its own microservice (or set of microservices) that:


is called by AI-Chat-Host for chat suggestions


is called by Feed for feed suggestions


later calls Ad Service to blend ads into recommendations


is built to use data from posts, comments, cookies, and other behaviours



“Should AI-Chat-Host store room/chat projections for recommendations?”

❌ No.
AI-Chat-Host keeps only small sliding windows for context.
Recommendation Service uses features, not raw chat logs.

If you’d like, next I can:


sketch the Recommendation Service API (v1) for chat context, or


show how to structure RecService + AdService so you don’t tangle them, or


design the data model for ad campaigns + creatives that fits into this architecture.


