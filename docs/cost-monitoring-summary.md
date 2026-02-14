# Cost Monitoring & User Caps - Executive Summary

**Date:** 2026-02-10  
**Project:** AI Chat Application with Multi-Agent Support

---

## 🎯 Objective

Implement comprehensive cost monitoring and usage caps to:
- Track AI API costs per user and per agent
- Prevent cost overruns through tiered limits
- Enable sustainable freemium-to-enterprise pricing
- Provide transparency and control to users

---

## 💰 Cost Drivers

| Component | Cost Range | Impact |
|-----------|------------|--------|
| **AI API Tokens** | $0.50-$60 per 1M tokens | **HIGH** - Primary cost driver |
| **Multi-Agent Calls** | 5-20x multiplier per request | **HIGH** - Cascading effect |
| **Kubernetes Pods** | $0.01-$0.50 per pod-hour | **MEDIUM** |
| **Database Storage** | $0.09-$0.30 per GB-month | **LOW** |
| **Network Egress** | $0.09 per GB | **LOW** (text chat) |

**Key Insight:** A single multi-agent user request can cost $0.05-$0.50 depending on model selection and agent complexity.

---

## 📊 Subscription Tiers

| Tier | Price | Monthly Limit | Cap Type | Target User |
|------|-------|---------------|----------|-------------|
| **Free** | $0 | 50 messages/day<br>25K tokens/day | Hard cap | Trial users |
| **Basic** | $9.99 | 1,000 messages<br>500K tokens | Soft cap + warnings | Individual users |
| **Pro** | $29.99 | 5,000 messages<br>2.5M tokens | Soft cap + overage | Power users |
| **Enterprise** | Custom | Custom budgets | Pooled + alerts | Organizations |

**Actual Cost to Provide:**
- Free: $0.10-$0.50/month per user
- Basic: $2-$5/month per user
- Pro: $10-$25/month per user
- Enterprise: $50-$200/month per user

---

## 🏗️ Technical Architecture

### Core Components

1. **Cost Tracking Middleware**
   - Wraps every AI API call
   - Logs: user ID, agent ID, tokens, cost, timestamp
   - Real-time cost calculation

2. **Database Schema**
   - `llm_interactions` - Token-level tracking (partitioned by month)
   - `user_cost_summary` - Aggregated usage per user
   - `subscription_tiers` - Limits and pricing
   - `cost_alerts` - Alert history

3. **Monitoring & Alerts**
   - Real-time usage dashboards
   - Automated alerts at 80%, 90%, 100% thresholds
   - Predictive alerts based on usage trends
   - Admin anomaly detection

4. **Multi-Agent Attribution**
   - Hierarchical tracking: User → Agent → Workflow
   - Cost breakdown by agent type
   - Tool usage cost tracking

---

## 💵 Token rates, model changes, and cost totals (implementation detail)

### How token rates are stored

In `aiGateway`, token pricing is stored in Mongo in the `TokenRate` collection:

- **Key**: `{ provider, modelName, effectiveDate }`
- **Values**: `inputCostPerMillionMicros`, `outputCostPerMillionMicros` (USD micros per 1,000,000 tokens)

This allows **multiple prices over time** for the same model/provider (provider pricing changes).

### How cost is calculated

For each LLM call (`LlmInteraction`), we compute:

$$cost = round(promptTokens \\times inputRate/1{,}000{,}000) + round(completionTokens \\times outputRate/1{,}000{,}000)$$

Where the selected rate is the **latest `TokenRate`** whose `effectiveDate` is **<= the interaction timestamp**.

### Why “rate changes” automatically sum correctly

Because we persist `estimatedCostMicros` per call, totals (per user/day/agent) naturally include mixed pricing.

Example:
- 230 tokens at rate $0.023/token (older effective date)
- later, model/rate changes to $0.30/token
- 340 tokens at the new rate

These become **two interactions** (or two sets of interactions) with different effective rates; the total is simply the sum of their `estimatedCostMicros`.

### Seeding OpenAI default rates (script)

For now (before admin UI / periodic sync), seed OpenAI model pricing into Mongo using:

- `backEnd/ai/aiGateway/scripts/seed-openai-token-rates.js`

It inserts `TokenRate` rows for an `effectiveDate` (idempotent).

---

## 📡 Usage APIs (Phase 2)

Usage is exposed via `aiGateway` (proxied through `api-gateway`).

### User visibility (self-service)

- A **regular user** can only see **their own** usage/limits/costs (backed by their JWT `id`).
- Later, these values can be translated to **credits** in the UI (for easier interpretation), while internally we keep storing USD micros for accuracy.

Endpoints (new user-friendly paths):

- `GET /api/usage/current`
- `GET /api/usage/history?days=30`
- `GET /api/usage/breakdown?from=<iso>&to=<iso>&limit=50`
- `GET /api/usage/forecast`
- `GET /api/alerts?days=7`

Compatibility (old paths still work):

- `GET /api/ai-gateway/usage/current`
- `GET /api/ai-gateway/usage/history?days=30`
- `GET /api/ai-gateway/usage/breakdown?from=<iso>&to=<iso>&limit=50`
- `GET /api/ai-gateway/usage/forecast`
- `GET /api/ai-gateway/alerts?days=7`

### Admin visibility

- An **admin** should be able to see platform-wide cost/usage across all users/agents.
- Admin endpoints are planned next (RBAC + `/api/admin/costs/*` style routes).

### MVP note

- For the **MVP**, we assume only two roles exist: **user** and **admin**.

---

## 📱 Mobile app placement (where users see usage/cost)

For the MVP, usage/cost is surfaced in two places:

- **My Profile** (`ProfileScreen`): shows **Usage & limits** (today + month-to-date + forecast).
- **Agent Details** (`AgentDetailScreen`): shows **Usage (last 30 days)** for that specific agent.

---

## 🚨 Alert Strategy

| Threshold | Action | Channels |
|-----------|--------|----------|
| **80%** | Info notification | In-app |
| **90%** | Warning + upgrade prompt | In-app + Email |
| **100%** | Hard stop (Free) / Overage (Paid) | In-app + Email + Slack (admin) |
| **Anomaly** | Admin alert | Slack |

---

## 🛠️ Implementation Phases

### Phase 1: Foundation (2 weeks)
- Database schema setup
- Cost tracking middleware
- Basic tier limits (hard caps)

### Phase 2: Monitoring (2 weeks)
- Real-time aggregation
- Alert system
- User dashboard

### Phase 3: Advanced (2 weeks)
- Multi-agent attribution
- Infrastructure cost allocation
- Optimization tools

### Phase 4: Enterprise (2 weeks)
- Department budgets
- Advanced analytics
- Billing integration

**Total Timeline:** 8 weeks

---

## 📈 Expected Outcomes

### Business Impact
- **Revenue Protection:** Prevent users from consuming more than tier value
- **Conversion:** 15-25% free-to-paid conversion through usage prompts
- **Retention:** Transparency builds trust
- **Scalability:** Sustainable unit economics

### Technical Benefits
- **Visibility:** Real-time cost tracking per user
- **Control:** Automated enforcement of limits
- **Optimization:** Identify high-cost patterns
- **Forecasting:** Predict infrastructure needs

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Cost Attribution Accuracy** | >95% | Compare tracked vs actual cloud bills |
| **Alert Response Time** | <1 minute | Time from threshold to notification |
| **User Awareness** | 100% | All users see current usage |
| **Cost Overrun Prevention** | <2% | Users exceeding limits without detection |
| **Free Tier Conversion** | 15-25% | Free users upgrading to paid |

---

## 🔧 Recommended Tools

### AI Cost Monitoring
- **Helicone** - LLM observability
- **LangSmith** - Multi-agent tracing
- **OpenCost** - Open source alternative

### Cloud Infrastructure
- **Kubecost** - Kubernetes cost monitoring
- **Prometheus + Grafana** - Metrics & visualization
- **CloudZero** - Multi-cloud attribution

### Database
- **Datadog** - Full-stack monitoring
- **Native cloud tools** - AWS/Azure cost management

---

## ⚠️ Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Inaccurate cost tracking** | High | Validate against cloud bills weekly |
| **Performance overhead** | Medium | Use async logging, materialized views |
| **User frustration** | High | Graceful degradation, clear warnings |
| **Database growth** | Medium | Partition tables, archive old data |
| **Alert fatigue** | Low | Smart thresholds, consolidate notifications |

---

## 💡 Quick Wins

1. **Start tracking tokens today** - Even without limits, visibility is valuable
2. **Implement free tier hard caps** - Protect against abuse immediately
3. **Add usage dashboard** - Users want to see their consumption
4. **Set up admin alerts** - Monitor high-cost users manually first

---

## 📋 Next Steps

1. **Review & approve** this approach with stakeholders
2. **Prioritize features** based on business needs
3. **Allocate resources** - 1-2 backend engineers for 8 weeks
4. **Start Phase 1** - Database schema and basic tracking
5. **Iterate based on data** - Adjust limits and pricing as needed

---

**Contact:** Engineering Team  
**Last Updated:** 2026-02-10  
**Related Docs:** [Full Investigation](./cost-monitoring-investigation.md)
