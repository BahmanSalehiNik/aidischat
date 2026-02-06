sketch the Recommendation Service API (v1) for chat context


Great — let’s design the **Recommendation Service API (v1)** specifically for **AI-Chat-Host**.
This API must be:

* **simple now**
* **flexible enough** to become your global recommendation platform later
* able to support **chat context**, **agent suggestions**, **ad slots**, **post suggestions**, etc.

We'll start with **exact V1 API shape**, **data flow**, **microservice structure**, and **example responses**.

---

# ⭐ 1. Recommendation Service (v1) — Core Responsibilities

For V1, the service needs to:

* Accept a **chat context** snapshot
* Generate **agent recommendations** (top N agents to invite)
* Provide **meta suggestions** (e.g., “Summarize this chat”, “Ask a question”, “Change topic”)

NOT included yet:

* Ad Server integration
* Full multi-surface content ranking
* Large ML models
* User behaviour logs
* Feature store

This keeps V1 lean and robust.

---

# ⭐ 2. High-Level Flow (AI-Chat-Host → Recommendation Service)

```
(AI-Chat-Host)
- collects last 20 messages
- aggregates topics / sentiment / embeddings
- builds ChatContextDTO
      ↓
POST /recommendations/chat
      ↓
(Recommendation Service)
- picks agents to suggest
- picks utility actions
- returns ranked items
      ↓
(AI-Chat-Host)
- converts to room suggestions UI
- publishes "chat.recommendation.available"
```

---

# ⭐ 3. API Specification (v1)

### **Endpoint**

```
POST /recommendations/chat
```

### **Request Body (ChatContextDTO)**

```json
{
  "userId": "user_123",
  "roomId": "room_789",
  "participants": [
    { "userId": "user_123", "type": "human" },
    { "userId": "agent_456", "type": "agent" }
  ],
  "agentsInRoom": ["agent_456"],
  "topics": ["travel", "japan", "food"],
  "lastMessages": [
    {
      "senderId": "user_123",
      "type": "human",
      "content": "I'm planning to visit Tokyo soon!"
    },
    {
      "senderId": "agent_456",
      "type": "agent",
      "content": "Tokyo has amazing food! Want suggestions?"
    }
  ],
  "mood": "positive",
  "language": "en"
}
```

### Fields explained:

* **participants** → used to avoid suggesting agents already present
* **topics** → extracted by AI-Chat-Host or LLM
* **lastMessages** → small context window (10–30 messages)
* **mood** → sentiment of conversation
* **language** → helps choose agents that match user’s language

---

# ⭐ 4. Response Format (v1)

### **Response Body (RecommendationResultDTO)**

```json
{
  "recommendations": [
    {
      "type": "agent",
      "agentId": "agent_999",
      "reason": "Expert in Japan travel",
      "score": 0.92
    },
    {
      "type": "agent",
      "agentId": "agent_321",
      "reason": "Popular food recommendation persona",
      "score": 0.74
    },
    {
      "type": "utility",
      "action": "summarize",
      "label": "Get a quick summary",
      "score": 0.62
    },
    {
      "type": "utility",
      "action": "sentiment_overview",
      "label": "See the emotional trend",
      "score": 0.51
    }
  ],
  "context": {
    "roomId": "room_789",
    "generatedAt": "2025-02-15T21:27:00Z"
  }
}
```

### What this means:

* **`type = "agent"`** → invite suggestion
* **`type = "utility"`** → actions like summarizing
* Each item has:

  * `score`: relevance
  * `reason`: *why* it’s suggested (great for UX transparency)

Later, when ads are added, you’ll have:

```json
{
  "type": "ad",
  "adId": "ad_555",
  "creative": { ... },
  "score": 0.81
}
```

---

# ⭐ 5. Internal Logic (v1) — What RecService actually does

Inside `/recommendations/chat`, the service performs:

### (1) **Agent Retrieval**

* query agents with tags matching `topics`
* filter by:

  * user’s preferred agents
  * language compatibility
  * not already in room
  * user’s subscription tier (limit suggestions)

### (2) **Basic Ranking Rules**

Combine weighted factors:

```
score =
  w1 * topic_similarity +
  w2 * agent_popularity +
  w3 * user-personal-preference +
  w4 * mood-fit +
  w5 * recency / freshness
```

No ML needed yet — rule-based is fine.

### (3) **Utility Suggestions**

Examples:

* summarize
* sentiment insight
* explore related rooms
* ask “suggest topic”

These can just be fixed rules + small LLM requests.

---

# ⭐ 6. Microservice Structure (folder layout)

```
recommendation-service/
  src/
    app.ts
    index.ts
    routes/
      chat-recommend.ts
    services/
      agent-recommender.ts
      topic-similarity.ts
      utility-recommender.ts
    models/
      agent-features.ts
      user-features.ts
    utils/
      embeddings.ts
      scoring.ts
    kafka/
      publishers/
      consumers/
```

### Important:

* **No full chat history inside this service**
* Only uses **light projections** → agent features, user preferences

---

# ⭐ 7. Kafka Events (optional for v1)

You *can* make it event-driven, but for v1 keep it simple.

**Optional event emitted:**

```
chat.recommendation.generated
{
  roomId: "room_789",
  recommendations: [...],
  generatedAt: ...
}
```

AI-Chat-Host would consume this event and update the UI.

But for v1 you can just return the response synchronously.

---

# ⭐ 8. Scaling Considerations (it WILL scale)

* The service is **stateless**
* No need to store sliding windows
* You can scale horizontally (HPA)
* Topic similarity usually uses **cached embeddings**
* Agent recommendations are lightweight queries

This is far easier to scale than chat.

---

# ⭐ 9. Summary — What you get in v1

Your Recommendation Service will:

* Handle chat context
* Suggest agents
* Suggest utility actions
* Work entirely from minimal inputs
* Be fully flexible for expansion
* Be used later by:

  * feed
  * explore
  * profile recommendations
  * ad placement
  * search recommendations

---

# ⭐ Next Step Options

Choose one:

A) Implement the **full Recommendation Service (v1)** in TypeScript
B) Implement the **AI-Chat-Host → RecService integration**
C) Design the **ML-assisted v2** (embeddings, semantic search, candidate generation)
D) Design the **Ad Service architecture** for future adoption
E) Add RecService to your **Kubernetes + Kafka setup**

Which one would you like next?
