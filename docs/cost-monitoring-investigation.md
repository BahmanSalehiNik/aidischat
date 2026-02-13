# Cost Monitoring & User Caps Investigation
## AI Chat Application with Multi-Agent Support

**Date:** 2026-02-10  
**Purpose:** Deep research into monitoring and capping user costs for AI-powered chat applications with agent support across different subscription tiers.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Cost Drivers for AI Chat Applications](#cost-drivers-for-ai-chat-applications)
3. [Per-User Cost Tracking Architecture](#per-user-cost-tracking-architecture)
4. [Subscription Tier Implementation](#subscription-tier-implementation)
5. [Real-Time Monitoring & Alerts](#real-time-monitoring--alerts)
6. [Cost Attribution for Multi-Agent Systems](#cost-attribution-for-multi-agent-systems)
7. [Database Schema for Cost Tracking](#database-schema-for-cost-tracking)
8. [Cloud Infrastructure Cost Monitoring](#cloud-infrastructure-cost-monitoring)
9. [Implementation Recommendations](#implementation-recommendations)
10. [Industry Best Practices](#industry-best-practices)
11. [Tools & Platforms](#tools--platforms)
12. [References](#references)

---

## Executive Summary

Monitoring and capping costs in AI-powered chat applications requires a multi-layered approach that tracks:

- **AI API costs** (token consumption per user and per agent)
- **Infrastructure costs** (compute, storage, networking)
- **WebSocket/real-time communication costs**
- **Database storage and operations**

Key findings:
- Token-level tracking is essential for AI cost attribution
- Multi-agent systems require granular logging with user ID, agent ID, and workflow ID
- Subscription tiers should implement both hard caps (freemium) and soft caps (enterprise)
- Real-time monitoring with automated alerts prevents cost overruns
- Database schema must support high-frequency writes for token tracking

---

## Cost Drivers for AI Chat Applications

### 1. AI Model API Costs

**Primary Cost Driver:** Token consumption (input + output tokens)

- **Pricing Model:** Per-token billing (e.g., $0.50-$30 per million tokens depending on model)
- **Variability Factors:**
  - Model selection (GPT-3.5 vs GPT-4 vs Claude)
  - Prompt length and complexity
  - Response length (controlled by `max_tokens`)
  - Conversation context retention
  - Multi-agent interactions (each agent call = separate API request)

**Cost Estimation:**
- Basic chat: 500-2,000 tokens per interaction
- Agent-assisted chat: 2,000-10,000 tokens per interaction (multiple agent calls)
- Cost per user per month: $0.50-$50 depending on usage and model

### 2. Infrastructure Costs

#### Compute Resources
- **Kubernetes Pods:** Cost per pod-hour based on CPU/memory allocation
- **WebSocket Servers:** Persistent connections require dedicated compute
- **Video Streaming:** High CPU usage for encoding/decoding (if applicable)

**Cost Drivers:**
- Number of concurrent connections
- Pod resource requests vs actual usage
- Auto-scaling behavior
- Idle resource waste

#### Storage Costs
- **Database Storage:** $0.09-$0.30 per GB-month (PostgreSQL/MongoDB)
- **Object Storage:** $0.023 per GB-month (AWS S3 standard)
- **Backup Storage:** $0.03-$0.095 per GB-month
- **High Availability:** Can double costs due to replication

**Per-User Storage Estimation:**
- User profile + metadata: 1-10 KB
- Chat history (1 month): 50-500 KB
- Agent interaction logs: 100 KB - 5 MB
- Total per user: 150 KB - 6 MB

#### Network/Data Transfer
- **WebSocket Data:** Minimal for text chat (1-10 KB per message)
- **Video Streaming:** 0.5-2 GB per hour per user
- **Egress Costs:** $0.09 per GB (AWS) for internet transfer
- **Multi-region:** $0.02 per GB for cross-region

### 3. Multi-Agent System Costs

**Unique Cost Drivers:**
- **Inter-agent communication:** Each agent-to-agent interaction = API call
- **Tool usage costs:** External API calls (search, databases, etc.)
- **Orchestration overhead:** Additional compute for workflow management
- **Cascading calls:** Single user request can trigger 5-20 LLM calls

**Example Scenario:**
```
User Request → Router Agent (200 tokens)
            → Research Agent (2,000 tokens)
            → Analysis Agent (1,500 tokens)
            → Synthesis Agent (1,000 tokens)
            → Response to User (500 tokens)
Total: 5,200 tokens for one user interaction
```

---

## Per-User Cost Tracking Architecture

### Core Principles

1. **Granular Logging:** Track every AI API call with user attribution
2. **Real-Time Aggregation:** Calculate running costs per user
3. **Multi-Dimensional Attribution:** User → Agent → Workflow → Model
4. **Token-Level Precision:** Track input/output tokens separately

### Implementation Strategy

#### 1. Request Middleware/Gateway

```typescript
// Pseudo-code for cost tracking middleware
async function trackAIRequest(userId: string, agentId: string, request: AIRequest) {
  const startTime = Date.now();
  
  // Make AI API call
  const response = await aiProvider.complete(request);
  
  // Extract token usage
  const { inputTokens, outputTokens, model } = response.usage;
  
  // Calculate cost
  const cost = calculateCost(model, inputTokens, outputTokens);
  
  // Log to database
  await db.llmInteractions.create({
    userId,
    agentId,
    conversationId: request.conversationId,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimatedCost: cost,
    requestTimestamp: new Date(startTime),
    responseTimestamp: new Date(),
    durationMs: Date.now() - startTime
  });
  
  // Update user's running total
  await updateUserCostTotal(userId, cost);
  
  // Check if user exceeded limits
  await checkUserLimits(userId);
  
  return response;
}
```

#### 2. Cost Calculation Service

```typescript
interface TokenRates {
  modelName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  effectiveDate: Date;
}

function calculateCost(
  model: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const rates = getTokenRates(model);
  
  const inputCost = (inputTokens / 1_000_000) * rates.inputCostPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputCostPerMillion;
  
  return inputCost + outputCost;
}
```

#### 3. User Cost Aggregation

```typescript
// Real-time cost tracking
interface UserCostSummary {
  userId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  
  // AI costs
  totalTokens: number;
  totalAICost: number;
  aiCallCount: number;
  
  // Infrastructure costs (allocated)
  computeCost: number;
  storageCost: number;
  networkCost: number;
  
  // Total
  totalCost: number;
  
  // Limits
  subscriptionTier: string;
  costLimit: number;
  remainingBudget: number;
}
```

---

## Subscription Tier Implementation

### Tier Structure

#### Free Tier
- **Purpose:** User acquisition, product demonstration
- **Cap Type:** Hard cap (usage stops when limit reached)
- **Limits:**
  - 50 AI messages per day
  - 25,000 tokens per day
  - No agent access
  - 30-day message history
  - $0.50 daily cost cap

**Implementation:**
```typescript
interface FreeTierLimits {
  dailyMessageLimit: 50;
  dailyTokenLimit: 25_000;
  dailyCostCap: 0.50;
  agentsEnabled: false;
  historyRetentionDays: 30;
  capBehavior: 'hard'; // Stop service when exceeded
}
```

#### Basic Tier ($9.99/month)
- **Purpose:** Individual users, light usage
- **Cap Type:** Soft cap with warnings
- **Limits:**
  - 1,000 AI messages per month
  - 500,000 tokens per month
  - 2 basic agents
  - 90-day message history
  - $15 monthly cost cap (soft)

**Implementation:**
```typescript
interface BasicTierLimits {
  monthlyMessageLimit: 1_000;
  monthlyTokenLimit: 500_000;
  monthlyCostCap: 15.00;
  maxAgents: 2;
  agentTypes: ['basic'];
  historyRetentionDays: 90;
  capBehavior: 'soft'; // Warn at 80%, 90%, 100%
  overageRate: 0.02; // $0.02 per 1,000 tokens over limit
}
```

#### Pro Tier ($29.99/month)
- **Purpose:** Power users, small teams
- **Cap Type:** Soft cap with overage billing
- **Limits:**
  - 5,000 AI messages per month
  - 2,500,000 tokens per month
  - 5 advanced agents
  - 1-year message history
  - $50 monthly cost cap (soft)

**Implementation:**
```typescript
interface ProTierLimits {
  monthlyMessageLimit: 5_000;
  monthlyTokenLimit: 2_500_000;
  monthlyCostCap: 50.00;
  maxAgents: 5;
  agentTypes: ['basic', 'advanced', 'custom'];
  historyRetentionDays: 365;
  capBehavior: 'soft';
  overageRate: 0.015; // $0.015 per 1,000 tokens
  prioritySupport: true;
}
```

#### Enterprise Tier (Custom Pricing)
- **Purpose:** Large organizations, custom needs
- **Cap Type:** Negotiated limits with pooled usage
- **Limits:**
  - Custom message limits
  - Custom token budgets
  - Unlimited agents
  - Unlimited history
  - Custom cost caps per department/team

**Implementation:**
```typescript
interface EnterpriseTierLimits {
  monthlyMessageLimit: null; // Unlimited
  monthlyTokenLimit: null; // Managed via budget
  monthlyCostBudget: number; // Custom negotiated
  maxAgents: null; // Unlimited
  agentTypes: ['all'];
  historyRetentionDays: null; // Unlimited
  capBehavior: 'budget'; // Managed budget with alerts
  pooledUsage: true; // Team-wide limits
  departmentLimits: Map<string, UsageLimits>;
  customRates: TokenRates[];
}
```

### Usage Cap Implementation Patterns

#### Hard Cap (Freemium)
```typescript
async function checkHardCap(userId: string): Promise<boolean> {
  const usage = await getUserUsageToday(userId);
  const limits = await getUserTierLimits(userId);
  
  if (usage.totalCost >= limits.dailyCostCap) {
    throw new Error('Daily cost limit reached. Upgrade to continue.');
  }
  
  if (usage.messageCount >= limits.dailyMessageLimit) {
    throw new Error('Daily message limit reached. Upgrade to continue.');
  }
  
  return true;
}
```

#### Soft Cap with Warnings (Premium)
```typescript
async function checkSoftCap(userId: string): Promise<CapStatus> {
  const usage = await getUserUsageThisMonth(userId);
  const limits = await getUserTierLimits(userId);
  
  const costPercentage = (usage.totalCost / limits.monthlyCostCap) * 100;
  
  if (costPercentage >= 100) {
    // Allow overage with additional charges
    await notifyUser(userId, 'You have exceeded your monthly limit. Overage charges apply.');
    return { allowed: true, overage: true, rate: limits.overageRate };
  } else if (costPercentage >= 90) {
    await notifyUser(userId, 'You have used 90% of your monthly limit.');
  } else if (costPercentage >= 80) {
    await notifyUser(userId, 'You have used 80% of your monthly limit.');
  }
  
  return { allowed: true, overage: false };
}
```

#### Budget-Based (Enterprise)
```typescript
async function checkBudgetCap(userId: string, departmentId: string): Promise<boolean> {
  const departmentUsage = await getDepartmentUsage(departmentId);
  const departmentBudget = await getDepartmentBudget(departmentId);
  
  if (departmentUsage.totalCost >= departmentBudget.monthlyLimit) {
    // Notify department admin, but allow critical users to continue
    await notifyDepartmentAdmin(departmentId, 'Department budget exceeded');
    
    const userPriority = await getUserPriority(userId);
    return userPriority === 'critical';
  }
  
  return true;
}
```

---

## Real-Time Monitoring & Alerts

### Monitoring Architecture

#### 1. Metrics Collection

**Key Metrics:**
- Cost per user (hourly, daily, monthly)
- Token consumption rate
- API call frequency
- Agent usage patterns
- Infrastructure utilization

**Collection Methods:**
- Application-level logging (every AI API call)
- Database triggers for cost aggregation
- Cloud provider APIs for infrastructure costs
- Prometheus/Grafana for visualization

#### 2. Alert Configuration

```typescript
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  recipients: string[];
  channels: ('email' | 'slack' | 'sms' | 'in-app')[];
}

const alertRules: AlertRule[] = [
  {
    name: 'User approaching daily limit',
    condition: 'user_daily_cost >= 0.8 * daily_limit',
    threshold: 0.8,
    recipients: ['user'],
    channels: ['in-app', 'email']
  },
  {
    name: 'User exceeded monthly budget',
    condition: 'user_monthly_cost > monthly_limit',
    threshold: 1.0,
    recipients: ['user', 'admin'],
    channels: ['email', 'slack']
  },
  {
    name: 'Anomalous usage detected',
    condition: 'user_hourly_cost > 3 * avg_hourly_cost',
    threshold: 3.0,
    recipients: ['admin'],
    channels: ['slack']
  },
  {
    name: 'Department budget warning',
    condition: 'dept_monthly_cost >= 0.9 * dept_budget',
    threshold: 0.9,
    recipients: ['dept_admin'],
    channels: ['email', 'slack']
  }
];
```

#### 3. Real-Time Dashboard

**User-Facing Dashboard:**
- Current usage vs limits (progress bars)
- Cost breakdown by agent
- Token consumption trends
- Projected end-of-month cost
- Upgrade recommendations

**Admin Dashboard:**
- Total platform costs
- Cost per user distribution
- High-cost users
- Agent usage statistics
- Infrastructure cost allocation
- Anomaly detection alerts

### Alert Implementation

```typescript
class CostAlertService {
  async checkAndAlert(userId: string, newCost: number) {
    const usage = await this.getUserUsage(userId);
    const limits = await this.getUserLimits(userId);
    
    // Check all alert rules
    for (const rule of alertRules) {
      if (this.evaluateRule(rule, usage, limits)) {
        await this.sendAlert(rule, userId, usage);
      }
    }
  }
  
  private evaluateRule(
    rule: AlertRule, 
    usage: UserUsage, 
    limits: TierLimits
  ): boolean {
    // Evaluate condition (simplified)
    const percentage = usage.totalCost / limits.costCap;
    return percentage >= rule.threshold;
  }
  
  private async sendAlert(
    rule: AlertRule, 
    userId: string, 
    usage: UserUsage
  ) {
    for (const channel of rule.channels) {
      switch (channel) {
        case 'email':
          await this.emailService.send({
            to: await this.getUserEmail(userId),
            subject: rule.name,
            body: this.formatAlertMessage(rule, usage)
          });
          break;
        case 'slack':
          await this.slackService.postMessage({
            channel: '#cost-alerts',
            text: this.formatAlertMessage(rule, usage)
          });
          break;
        case 'in-app':
          await this.notificationService.create({
            userId,
            type: 'warning',
            message: this.formatAlertMessage(rule, usage)
          });
          break;
      }
    }
  }
}
```

---

## Cost Attribution for Multi-Agent Systems

### Challenges

1. **Cascading Calls:** Single user request triggers multiple agent calls
2. **Shared Context:** Agents may share conversation context (token reuse)
3. **Tool Costs:** External API calls by agents
4. **Inter-Agent Communication:** Agents communicating with each other

### Attribution Strategy

#### 1. Hierarchical Cost Tracking

```typescript
interface CostAttribution {
  // Top-level
  userId: string;
  conversationId: string;
  userRequestId: string;
  
  // Agent-level
  agentId: string;
  agentName: string;
  agentRole: string; // 'router', 'researcher', 'analyst', 'synthesizer'
  
  // Workflow-level
  workflowId: string;
  workflowStep: number;
  parentCallId?: string; // For nested agent calls
  
  // Cost details
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  
  // Tool usage
  toolCalls?: ToolCall[];
  toolCosts?: number;
}

interface ToolCall {
  toolName: string;
  provider: string;
  cost: number;
  timestamp: Date;
}
```

#### 2. Cost Aggregation Views

```sql
-- User's total cost by agent
SELECT 
  user_id,
  agent_name,
  COUNT(*) as call_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(estimated_cost) as total_cost
FROM llm_interactions
WHERE user_id = ? 
  AND request_timestamp >= ?
GROUP BY user_id, agent_name;

-- User's cost by workflow
SELECT 
  user_id,
  workflow_id,
  COUNT(DISTINCT agent_id) as agents_used,
  SUM(estimated_cost) as workflow_cost
FROM llm_interactions
WHERE user_id = ?
GROUP BY user_id, workflow_id;

-- Hourly cost trend
SELECT 
  DATE_TRUNC('hour', request_timestamp) as hour,
  COUNT(*) as requests,
  SUM(estimated_cost) as hourly_cost
FROM llm_interactions
WHERE user_id = ?
  AND request_timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

#### 3. Multi-Agent Cost Example

```
User Request: "Research and summarize the latest AI trends"

1. Router Agent (GPT-3.5-turbo)
   - Input: 150 tokens (user request + system prompt)
   - Output: 50 tokens (routing decision)
   - Cost: $0.0001

2. Research Agent (GPT-4)
   - Input: 500 tokens (task + context)
   - Output: 2,000 tokens (research findings)
   - Tool: Web search API ($0.001)
   - Cost: $0.025 + $0.001 = $0.026

3. Analysis Agent (GPT-4)
   - Input: 2,500 tokens (research + analysis prompt)
   - Output: 1,500 tokens (analysis)
   - Cost: $0.020

4. Synthesis Agent (GPT-3.5-turbo)
   - Input: 4,000 tokens (all previous context)
   - Output: 500 tokens (final summary)
   - Cost: $0.0023

Total Cost for User Request: $0.0494
Total Tokens: 11,200
Agents Used: 4
```

---

## Database Schema for Cost Tracking

### Core Tables

#### 1. Users Table
```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL, -- 'free', 'basic', 'pro', 'enterprise'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Subscription details
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  billing_cycle VARCHAR(20), -- 'monthly', 'annual'
  
  -- Cost tracking
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  current_period_cost DECIMAL(10, 4) DEFAULT 0,
  
  INDEX idx_subscription_tier (subscription_tier),
  INDEX idx_email (email)
);
```

#### 2. Subscription Tiers Table
```sql
CREATE TABLE subscription_tiers (
  tier_id UUID PRIMARY KEY,
  tier_name VARCHAR(50) UNIQUE NOT NULL,
  
  -- Limits
  monthly_message_limit INTEGER,
  monthly_token_limit BIGINT,
  monthly_cost_cap DECIMAL(10, 2),
  daily_cost_cap DECIMAL(10, 2),
  
  -- Features
  max_agents INTEGER,
  agent_types TEXT[], -- Array of allowed agent types
  history_retention_days INTEGER,
  
  -- Behavior
  cap_behavior VARCHAR(20), -- 'hard', 'soft', 'budget'
  overage_rate DECIMAL(10, 6), -- Cost per 1,000 tokens over limit
  
  -- Pricing
  monthly_price DECIMAL(10, 2),
  annual_price DECIMAL(10, 2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. LLM Interactions Table (Core Cost Tracking)
```sql
CREATE TABLE llm_interactions (
  interaction_id UUID PRIMARY KEY,
  
  -- Attribution
  user_id UUID NOT NULL REFERENCES users(user_id),
  conversation_id UUID,
  agent_id VARCHAR(100),
  agent_name VARCHAR(100),
  workflow_id UUID,
  workflow_step INTEGER,
  parent_call_id UUID, -- For nested calls
  
  -- Model details
  model_name VARCHAR(100) NOT NULL,
  provider VARCHAR(50), -- 'openai', 'anthropic', 'google'
  
  -- Token usage
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cached_tokens INTEGER DEFAULT 0,
  
  -- Cost
  estimated_cost DECIMAL(10, 6) NOT NULL,
  
  -- Timing
  request_timestamp TIMESTAMP NOT NULL,
  response_timestamp TIMESTAMP NOT NULL,
  duration_ms INTEGER,
  
  -- Tool usage
  tool_calls JSONB, -- Array of tool calls
  tool_costs DECIMAL(10, 6) DEFAULT 0,
  
  -- Metadata
  request_metadata JSONB,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_user_timestamp (user_id, request_timestamp),
  INDEX idx_conversation (conversation_id),
  INDEX idx_agent (agent_name),
  INDEX idx_workflow (workflow_id),
  INDEX idx_model (model_name)
);

-- Partition by month for performance
CREATE TABLE llm_interactions_2026_02 PARTITION OF llm_interactions
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

#### 4. Token Rates Table
```sql
CREATE TABLE token_rates (
  rate_id UUID PRIMARY KEY,
  model_name VARCHAR(100) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Pricing per million tokens
  input_cost_per_million DECIMAL(10, 6) NOT NULL,
  output_cost_per_million DECIMAL(10, 6) NOT NULL,
  
  -- Effective dates
  effective_date DATE NOT NULL,
  end_date DATE,
  
  currency VARCHAR(3) DEFAULT 'USD',
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_model_date (model_name, effective_date)
);

-- Example data
INSERT INTO token_rates (model_name, provider, input_cost_per_million, output_cost_per_million, effective_date)
VALUES 
  ('gpt-3.5-turbo', 'openai', 0.50, 1.50, '2026-01-01'),
  ('gpt-4', 'openai', 30.00, 60.00, '2026-01-01'),
  ('gpt-4-turbo', 'openai', 10.00, 30.00, '2026-01-01'),
  ('claude-3-opus', 'anthropic', 15.00, 75.00, '2026-01-01'),
  ('claude-3-sonnet', 'anthropic', 3.00, 15.00, '2026-01-01');
```

#### 5. User Cost Summary Table (Materialized View)
```sql
CREATE TABLE user_cost_summary (
  summary_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  
  -- Period
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  period_type VARCHAR(20), -- 'daily', 'monthly'
  
  -- Usage metrics
  total_messages INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_ai_calls INTEGER DEFAULT 0,
  
  -- Cost breakdown
  ai_cost DECIMAL(10, 4) DEFAULT 0,
  tool_cost DECIMAL(10, 4) DEFAULT 0,
  infrastructure_cost DECIMAL(10, 4) DEFAULT 0,
  total_cost DECIMAL(10, 4) DEFAULT 0,
  
  -- Agent usage
  agents_used JSONB, -- { "agent_name": { "calls": 10, "cost": 0.50 } }
  
  -- Limits
  cost_limit DECIMAL(10, 2),
  remaining_budget DECIMAL(10, 4),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (user_id, period_start, period_type),
  INDEX idx_user_period (user_id, period_start)
);
```

#### 6. Cost Alerts Table
```sql
CREATE TABLE cost_alerts (
  alert_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id),
  
  alert_type VARCHAR(50), -- 'approaching_limit', 'exceeded_limit', 'anomaly'
  severity VARCHAR(20), -- 'info', 'warning', 'critical'
  
  message TEXT NOT NULL,
  threshold_percentage DECIMAL(5, 2),
  current_usage DECIMAL(10, 4),
  limit_value DECIMAL(10, 4),
  
  sent_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  
  INDEX idx_user_alerts (user_id, sent_at)
);
```

### Optimizations

#### 1. Indexes for Fast Queries
```sql
-- Composite index for user cost queries
CREATE INDEX idx_llm_user_date_cost 
  ON llm_interactions(user_id, request_timestamp DESC, estimated_cost);

-- Index for agent analytics
CREATE INDEX idx_llm_agent_model 
  ON llm_interactions(agent_name, model_name, request_timestamp);

-- Partial index for recent data
CREATE INDEX idx_llm_recent 
  ON llm_interactions(request_timestamp DESC)
  WHERE request_timestamp > NOW() - INTERVAL '30 days';
```

#### 2. Materialized View for Dashboards
```sql
CREATE MATERIALIZED VIEW user_daily_costs AS
SELECT 
  user_id,
  DATE(request_timestamp) as date,
  COUNT(*) as total_calls,
  SUM(total_tokens) as total_tokens,
  SUM(estimated_cost) as total_cost,
  JSONB_OBJECT_AGG(agent_name, agent_stats) as agent_breakdown
FROM (
  SELECT 
    user_id,
    request_timestamp,
    total_tokens,
    estimated_cost,
    agent_name,
    JSONB_BUILD_OBJECT(
      'calls', COUNT(*),
      'cost', SUM(estimated_cost)
    ) as agent_stats
  FROM llm_interactions
  GROUP BY user_id, request_timestamp, total_tokens, estimated_cost, agent_name
) sub
GROUP BY user_id, DATE(request_timestamp);

-- Refresh hourly
CREATE INDEX ON user_daily_costs(user_id, date DESC);
```

---

## Cloud Infrastructure Cost Monitoring

### Kubernetes Cost Attribution

#### 1. Pod-Level Cost Tracking

**Tools:**
- **Kubecost/OpenCost:** Real-time cost visibility per pod, namespace, label
- **Prometheus + Grafana:** Custom metrics and dashboards
- **Cloud Provider Tools:** AWS Split Cost Allocation, Azure Cost Management

**Attribution Methods:**
- **Resource Requests:** Allocate based on CPU/memory requests
- **Actual Usage:** Allocate based on actual consumption
- **Hybrid:** Combine both for accuracy

**Implementation:**
```yaml
# Label pods for cost attribution
apiVersion: v1
kind: Pod
metadata:
  name: chat-service
  labels:
    app: chat-service
    cost-center: "engineering"
    user-tier: "enterprise"
    environment: "production"
spec:
  containers:
  - name: chat
    resources:
      requests:
        cpu: "500m"
        memory: "512Mi"
      limits:
        cpu: "1000m"
        memory: "1Gi"
```

**Cost Calculation:**
```typescript
// Allocate infrastructure costs to users
async function allocateInfrastructureCosts() {
  // Get total pod costs from Kubecost
  const totalPodCosts = await kubecost.getTotalCosts();
  
  // Get active user count
  const activeUsers = await db.users.count({ 
    where: { last_active: { gte: startOfMonth() } }
  });
  
  // Simple allocation: divide equally
  const costPerUser = totalPodCosts / activeUsers;
  
  // Or weighted by usage
  const userUsage = await db.llmInteractions.groupBy({
    by: ['user_id'],
    _sum: { total_tokens: true }
  });
  
  const totalTokens = userUsage.reduce((sum, u) => sum + u._sum.total_tokens, 0);
  
  for (const user of userUsage) {
    const userShare = user._sum.total_tokens / totalTokens;
    const userInfraCost = totalPodCosts * userShare;
    
    await db.userCostSummary.update({
      where: { user_id: user.user_id },
      data: { infrastructure_cost: userInfraCost }
    });
  }
}
```

### Database Cost Monitoring

#### PostgreSQL/MongoDB Costs

**Cost Components:**
- Compute (instance size)
- Storage (data + indexes + backups)
- I/O operations
- Data transfer

**Per-User Attribution:**
```sql
-- Calculate storage per user
SELECT 
  user_id,
  COUNT(*) as message_count,
  SUM(LENGTH(message_content)) as total_bytes,
  SUM(LENGTH(message_content)) / 1024.0 / 1024.0 as total_mb
FROM messages
GROUP BY user_id;

-- Estimate cost
SELECT 
  user_id,
  total_mb,
  total_mb * 0.30 as monthly_storage_cost -- $0.30 per GB-month
FROM user_storage_usage;
```

**Optimization Strategies:**
- Archive old messages to cheaper storage
- Compress message content
- Implement data retention policies per tier
- Use appropriate indexes (avoid over-indexing)

### Network Cost Monitoring

#### WebSocket Costs

**Minimal for Text Chat:**
- Average message: 1-5 KB
- 1,000 messages = 1-5 MB
- Cost: ~$0.0001 per user per month

**Video Streaming (if applicable):**
- 720p: ~0.88 GB per hour
- Cost: $0.09 per GB = $0.08 per hour per user
- Monthly (10 hours): $0.80 per user

**Monitoring:**
```typescript
// Track data transfer per user
interface NetworkUsage {
  userId: string;
  period: string;
  
  websocketDataIn: number; // bytes
  websocketDataOut: number; // bytes
  httpDataIn: number;
  httpDataOut: number;
  
  totalEgress: number;
  estimatedCost: number; // $0.09 per GB
}
```

---

## Implementation Recommendations

### Phase 1: Foundation (Weeks 1-2)

1. **Database Schema Setup**
   - Create core tables: `users`, `subscription_tiers`, `llm_interactions`, `token_rates`
   - Set up indexes and partitioning
   - Implement data retention policies

2. **Cost Tracking Middleware**
   - Wrap all AI API calls with cost tracking
   - Log every interaction with user/agent attribution
   - Calculate costs in real-time

3. **Basic Tier Limits**
   - Implement hard caps for free tier
   - Add simple usage checks before API calls

### Phase 2: Monitoring & Alerts (Weeks 3-4)

1. **Real-Time Aggregation**
   - Create materialized views for user cost summaries
   - Implement background jobs to update summaries hourly

2. **Alert System**
   - Set up alert rules (80%, 90%, 100% thresholds)
   - Implement email and in-app notifications
   - Create admin dashboard for monitoring

3. **User Dashboard**
   - Display current usage vs limits
   - Show cost breakdown by agent
   - Provide upgrade prompts

### Phase 3: Advanced Features (Weeks 5-6)

1. **Multi-Agent Cost Attribution**
   - Implement hierarchical cost tracking
   - Add workflow-level cost aggregation
   - Create agent usage analytics

2. **Infrastructure Cost Allocation**
   - Integrate with Kubecost/OpenCost
   - Allocate pod costs to users
   - Track database and network costs

3. **Optimization Tools**
   - Anomaly detection for unusual usage
   - Cost optimization recommendations
   - Automated tier upgrade suggestions

### Phase 4: Enterprise Features (Weeks 7-8)

1. **Department/Team Budgets**
   - Implement pooled usage for enterprise
   - Add department-level cost tracking
   - Create admin controls for budget management

2. **Advanced Analytics**
   - Cost forecasting based on trends
   - ROI analysis per agent
   - Custom reporting for enterprise customers

3. **Billing Integration**
   - Connect to payment processor
   - Implement overage billing
   - Generate detailed invoices

---

## Industry Best Practices

### 1. Cost Transparency

**Principle:** Users should always know their current usage and costs

**Implementation:**
- Real-time usage display in UI
- Daily/weekly usage summary emails
- Clear pricing documentation
- Cost calculator for different tiers

### 2. Graceful Degradation

**Principle:** Don't abruptly cut off service; warn and guide users

**Implementation:**
```typescript
// Graceful limit handling
async function handleUsageLimit(userId: string, tier: string) {
  const usage = await getUserUsage(userId);
  const limits = getTierLimits(tier);
  
  const percentage = (usage.totalCost / limits.costCap) * 100;
  
  if (percentage >= 100) {
    if (tier === 'free') {
      // Hard stop for free tier
      throw new LimitExceededError('Daily limit reached. Upgrade to continue.');
    } else {
      // Soft limit for paid tiers
      await notifyUser(userId, {
        type: 'warning',
        message: 'You have exceeded your monthly limit. Overage charges apply.',
        action: 'View usage details',
        link: '/dashboard/usage'
      });
      // Allow continued usage with overage
      return { allowed: true, overage: true };
    }
  } else if (percentage >= 90) {
    await notifyUser(userId, {
      type: 'info',
      message: `You have used ${percentage.toFixed(0)}% of your monthly limit.`,
      action: 'Upgrade plan',
      link: '/pricing'
    });
  }
  
  return { allowed: true, overage: false };
}
```

### 3. Predictive Alerts

**Principle:** Warn users before they hit limits based on usage trends

**Implementation:**
```typescript
async function predictEndOfMonthCost(userId: string): Promise<number> {
  const monthStart = startOfMonth(new Date());
  const now = new Date();
  const daysElapsed = differenceInDays(now, monthStart);
  const daysInMonth = getDaysInMonth(now);
  
  const currentCost = await getUserCostThisMonth(userId);
  const dailyAverage = currentCost / daysElapsed;
  
  const projectedCost = dailyAverage * daysInMonth;
  
  // If projected to exceed limit, alert now
  const limits = await getUserLimits(userId);
  if (projectedCost > limits.monthlyCostCap * 0.9) {
    await sendPredictiveAlert(userId, projectedCost, limits.monthlyCostCap);
  }
  
  return projectedCost;
}
```

### 4. Cost Optimization Suggestions

**Principle:** Help users reduce costs through smart recommendations

**Examples:**
- "You're using GPT-4 for simple tasks. Switch to GPT-3.5 to save 90%"
- "Your Research Agent is called frequently. Consider caching results"
- "Reduce max_tokens to 500 for summaries to save 30%"

### 5. Fair Use Policies

**Principle:** Prevent abuse while allowing legitimate high usage

**Implementation:**
- Rate limiting per user (e.g., max 10 requests per minute)
- Anomaly detection for suspicious patterns
- Manual review for extreme usage
- Temporary throttling instead of hard blocks

---

## Tools & Platforms

### AI Cost Monitoring

1. **Helicone** - LLM observability and cost tracking
   - Real-time token usage monitoring
   - Cost attribution per user/project
   - Caching to reduce costs

2. **LangSmith** - LLM application monitoring
   - Trace multi-agent workflows
   - Cost breakdown by agent
   - Performance analytics

3. **Weights & Biases** - ML/AI monitoring
   - Track model costs
   - Compare model performance vs cost
   - Team collaboration features

4. **Prompts.ai** - AI cost management
   - Token-level tracking
   - Budget alerts
   - Cost optimization insights

### Cloud Cost Management

1. **Kubecost** - Kubernetes cost monitoring
   - Real-time pod-level costs
   - Cost allocation by namespace/label
   - Optimization recommendations

2. **Vantage** - Multi-cloud cost platform
   - Unified view across AWS/Azure/GCP
   - AI cost tracking features
   - Custom dashboards

3. **CloudZero** - Cloud cost intelligence
   - Per-customer cost attribution
   - Unit economics tracking
   - Anomaly detection

4. **Finout** - FinOps platform
   - AI/GenAI cost attribution
   - Virtual tagging for cost allocation
   - Real-time alerts

### Database Monitoring

1. **Datadog** - Full-stack monitoring
   - Database performance metrics
   - Cost tracking
   - APM integration

2. **New Relic** - Observability platform
   - Database query analysis
   - Cost optimization insights
   - Custom dashboards

### Open Source Tools

1. **OpenCost** - Kubernetes cost monitoring (open source)
2. **Prometheus + Grafana** - Metrics and visualization
3. **LiteLLM** - LLM proxy with cost tracking
4. **Langfuse** - Open source LLM observability

---

## References

### Research Sources

1. **AI Cost Monitoring:**
   - Flexprice: AI cost management best practices
   - Tetrate: Monitoring AI costs in production
   - Prompts.ai: Token-level cost tracking

2. **Cloud Cost Management:**
   - AWS: Multi-tenant cost attribution
   - Holori: AI cost attribution strategies
   - Finout: GenAI cost monitoring

3. **Subscription Tier Implementation:**
   - Stripe: Usage-based pricing guide
   - PayPro Global: Implementing usage caps
   - Stigg: Freemium to enterprise tiers

4. **Database Cost Optimization:**
   - Vantage: PostgreSQL pricing guide
   - CloudZero: MongoDB cost optimization
   - Portable: Database cost comparison

5. **Kubernetes Cost Attribution:**
   - OpenCost: Kubernetes cost allocation spec
   - AWS: EKS split cost allocation
   - Kubecost: Best practices guide

### Key Metrics

**AI Costs:**
- GPT-3.5-turbo: $0.50-$1.50 per million tokens
- GPT-4: $30-$60 per million tokens
- Claude-3: $3-$75 per million tokens

**Infrastructure Costs:**
- Kubernetes pods: $0.01-$0.50 per pod-hour
- PostgreSQL storage: $0.09-$0.30 per GB-month
- MongoDB Atlas: $0.25-$0.30 per GB-month
- Network egress: $0.09 per GB

**Typical Per-User Costs:**
- Free tier: $0.10-$0.50 per month
- Basic tier: $2-$5 per month (actual cost)
- Pro tier: $10-$25 per month (actual cost)
- Enterprise: $50-$200 per month (actual cost)

---

## Conclusion

Implementing comprehensive cost monitoring and caps for an AI chat application with multi-agent support requires:

1. **Granular tracking** at the token level for every AI API call
2. **Multi-dimensional attribution** (user → agent → workflow → model)
3. **Real-time aggregation** with materialized views and caching
4. **Tiered limits** with appropriate cap behaviors (hard/soft/budget)
5. **Proactive alerts** to prevent overages and guide users
6. **Infrastructure cost allocation** from Kubernetes, databases, and networking
7. **Optimization tools** to help users reduce costs

The recommended approach is to start with basic token tracking and tier limits, then progressively add monitoring, alerts, and advanced features. This phased approach allows for early value delivery while building toward a comprehensive cost management system.

**Next Steps:**
1. Review and validate database schema
2. Implement cost tracking middleware
3. Set up basic tier limits
4. Create user dashboard for usage visibility
5. Integrate with cloud cost monitoring tools
