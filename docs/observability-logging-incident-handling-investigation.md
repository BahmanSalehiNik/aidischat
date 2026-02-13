# Observability, Logging & Incident Handling — Deep Investigation

## Scope

This document covers **observability, logging, and incident handling** for a microservices architecture, with focus on **Azure** deployment but designed to be **provider-agnostic** for future multi-cloud support.

**Key areas:**
- Logging (structured, centralized, searchable)
- Metrics (application + infrastructure)
- Distributed tracing (request correlation across services)
- Dashboards (visualization + alerting)
- Incident detection & response
- Integration with cost/usage metrics

---

## Current State Analysis

### What We Have

**Logging:**
- ✅ Basic `console.log/error/warn` in all services
- ✅ Some structured JSON logging patterns (service template)
- ✅ Kafka logging best practices documented
- ❌ No centralized log aggregation
- ❌ No log retention/archival strategy
- ❌ Inconsistent log formats across services

**Metrics:**
- ❌ No application metrics (Prometheus/StatsD)
- ❌ No infrastructure metrics collection
- ❌ No custom business metrics (AI calls, usage, etc.)

**Tracing:**
- ❌ No distributed tracing (OpenTelemetry/Jaeger)
- ❌ No correlation IDs across services
- ❌ Hard to debug cross-service issues

**Dashboards:**
- ❌ No centralized dashboards
- ❌ No alerting system
- ❌ No incident management

---

## Why Observability Matters

### Problems Without It

1. **Debugging is slow**: "Why did this request fail?" requires grepping logs across 10+ services
2. **Incidents go unnoticed**: Errors happen but no one knows until users complain
3. **Performance blind spots**: Can't identify slow services, bottlenecks, or resource constraints
4. **Cost correlation impossible**: Can't link infrastructure costs to user behavior
5. **Scaling decisions are guesswork**: Don't know which services need more resources

### What Good Observability Enables

1. **Fast incident response**: Alerts trigger before users notice
2. **Root cause analysis**: Trace requests end-to-end in seconds
3. **Performance optimization**: Identify slow queries, bottlenecks, hot paths
4. **Capacity planning**: Data-driven scaling decisions
5. **Cost optimization**: Correlate usage metrics with infrastructure spend

---

## The Three Pillars of Observability

### 1. Logs (What Happened)

**Purpose**: Event records, errors, debug info, audit trails

**Requirements:**
- **Structured** (JSON) for parsing and filtering
- **Centralized** (single place to search)
- **Searchable** (full-text + field queries)
- **Retained** (30-90 days hot, 1+ year cold)
- **Correlated** (trace IDs, correlation IDs)

**Best practices:**
- Log levels: DEBUG (dev), INFO (staging), WARN/ERROR (prod)
- Include context: userId, requestId, service, timestamp
- Don't log sensitive data (PII, passwords, tokens)
- Use sampling for high-volume logs (1% of DEBUG logs)

### 2. Metrics (How Much, How Fast)

**Purpose**: Numerical measurements over time (counters, gauges, histograms)

**Types:**
- **Application metrics**: Request rate, error rate, latency (P50/P95/P99)
- **Business metrics**: AI calls per user, token usage, active agents
- **Infrastructure metrics**: CPU, memory, disk, network (from K8s/Azure)
- **Custom metrics**: Cost per user, quota utilization, feature usage

**Best practices:**
- Use histograms for latency (not averages)
- Track error rates separately from success rates
- Label metrics with dimensions (service, tier, region)
- Keep cardinality low (avoid high-cardinality labels like userId in every metric)

### 3. Traces (How Requests Flow)

**Purpose**: Distributed request tracing across services

**What it shows:**
- Which services a request touched
- How long each service took
- Where errors occurred
- Dependencies between services

**Best practices:**
- Use OpenTelemetry (vendor-neutral standard)
- Sample traces (1-10% in production to reduce overhead)
- Include baggage (correlation IDs, user context)
- Visualize in trace viewer (Jaeger, Zipkin, Azure Application Insights)

---

## Azure-Native Observability Stack

### Option 1: Azure-First (Recommended for Azure Deployment)

**Components:**
1. **Azure Monitor** (metrics + logs)
   - Application Insights (APM, traces, custom metrics)
   - Log Analytics Workspace (centralized logs)
   - Azure Monitor Metrics (infrastructure metrics)
2. **Azure Application Insights** (distributed tracing)
   - Auto-instrumentation for Node.js
   - Custom telemetry SDK
   - Live Metrics (real-time)
3. **Azure Log Analytics** (log aggregation)
   - KQL (Kusto Query Language) for queries
   - Log retention (30-730 days)
   - Integration with Azure services
4. **Azure Dashboards** or **Grafana on Azure**
   - Pre-built dashboards
   - Custom visualizations
   - Alert rules

**Pros:**
- ✅ Native Azure integration (automatic metrics from AKS, App Service, etc.)
- ✅ Single vendor (simpler billing, support)
- ✅ Built-in alerting and automation
- ✅ KQL is powerful for log analysis

**Cons:**
- ❌ Vendor lock-in (harder to migrate)
- ❌ Can be expensive at scale (log ingestion costs)
- ❌ Less flexible than open-source stack

**Cost estimate:**
- Application Insights: ~$2-5/GB ingested (first 5GB free/month)
- Log Analytics: ~$2.30/GB ingested (first 5GB free/month)
- At 100GB/month: ~$200-500/month

### Option 2: Open-Source Stack on Azure (Provider-Agnostic)

**Components:**
1. **Prometheus** (metrics)
   - Self-hosted on AKS or Azure Managed Prometheus
   - Grafana Agent for scraping
2. **Loki** (logs) or **Elasticsearch** (logs)
   - Self-hosted on AKS or Azure Elastic
   - Grafana for visualization
3. **Jaeger** or **Tempo** (traces)
   - Self-hosted on AKS
   - OpenTelemetry collector
4. **Grafana** (dashboards)
   - Unified view of metrics, logs, traces
   - Alerting engine

**Pros:**
- ✅ Vendor-agnostic (works on any cloud)
- ✅ More control and customization
- ✅ Lower cost at scale (self-hosted)
- ✅ Open standards (Prometheus, OpenTelemetry)

**Cons:**
- ❌ More operational overhead (manage infrastructure)
- ❌ Need to set up scraping, retention, etc.
- ❌ More complex initial setup

**Cost estimate:**
- Self-hosted on AKS: ~$50-200/month (compute + storage)
- Azure Managed Prometheus: ~$0.10/metric/month (can get expensive)

### Option 3: Hybrid (Best of Both Worlds)

**Use Azure for:**
- Infrastructure metrics (automatic from AKS)
- Application Insights for traces (easy setup)
- Log Analytics for Azure service logs

**Use open-source for:**
- Application metrics (Prometheus)
- Custom business metrics (Grafana)
- Cost/usage dashboards (Grafana)

**Integration:**
- Export Prometheus metrics to Azure Monitor
- Use Grafana with Azure data sources
- Unified dashboards showing both

---

## Logging Architecture

### Structured Logging Format

**Standard format (JSON):**
```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "INFO",
  "service": "ai-gateway",
  "traceId": "abc123",
  "spanId": "def456",
  "userId": "user-123",
  "agentId": "agent-456",
  "message": "AI call completed",
  "metadata": {
    "provider": "openai",
    "model": "gpt-4",
    "tokens": 1500,
    "latencyMs": 234
  }
}
```

### Log Levels by Environment

**Development:**
- DEBUG: Detailed execution flow
- INFO: Important events
- WARN: Potential issues
- ERROR: Errors

**Staging:**
- INFO: Important events
- WARN: Potential issues
- ERROR: Errors

**Production:**
- WARN: Issues that need attention
- ERROR: Errors that need fixing
- (Suppress DEBUG/INFO to reduce noise)

### Log Collection Strategy

**Option A: Sidecar Pattern (K8s)**
- Each pod runs a log collector sidecar (Fluent Bit)
- Sidecar reads logs from stdout/stderr
- Ships to Azure Log Analytics or Loki

**Option B: Node Agent (K8s)**
- DaemonSet runs log collector on each node
- Reads logs from container log files
- More efficient (one agent per node)

**Option C: Application SDK**
- Services use SDK to send logs directly
- More control, but adds dependency
- Good for structured logs

**Recommendation**: Start with **Option B** (Node Agent) for simplicity, migrate to **Option C** (SDK) for better control.

---

## Metrics Architecture

### Application Metrics (Prometheus)

**Key metrics to track:**

**Per-service:**
- `http_requests_total{method, route, status}` (counter)
- `http_request_duration_seconds{method, route}` (histogram)
- `kafka_messages_processed_total{topic, status}` (counter)
- `kafka_consumer_lag{topic, partition}` (gauge)
- `db_query_duration_seconds{operation}` (histogram)

**Business metrics:**
- `ai_calls_total{provider, model, feature}` (counter)
- `ai_tokens_used_total{provider, model}` (counter)
- `ai_call_duration_seconds{provider, model}` (histogram)
- `user_quota_used_cents{userId, tier}` (gauge)
- `active_agents_total` (gauge)
- `feed_scans_total{agentId}` (counter)

**Infrastructure metrics (from Azure/K8s):**
- `container_cpu_usage_seconds_total{pod, service}`
- `container_memory_usage_bytes{pod, service}`
- `kube_pod_status_phase{pod, phase}`

### Metrics Collection

**Prometheus scraping:**
- Prometheus scrapes `/metrics` endpoint from each service
- Service discovery via K8s annotations
- Scrape interval: 15-30 seconds

**Azure Monitor integration:**
- Export Prometheus metrics to Azure Monitor
- Use Azure Managed Prometheus (if available)
- Or use Prometheus-to-Azure exporter

---

## Distributed Tracing Architecture

### OpenTelemetry Setup

**Components:**
1. **OpenTelemetry SDK** (in each service)
   - Auto-instrumentation for HTTP, Kafka, MongoDB
   - Manual instrumentation for custom spans
2. **OpenTelemetry Collector** (sidecar or daemonset)
   - Receives traces from services
   - Processes, batches, exports
   - Sends to backend (Jaeger, Azure Application Insights)
3. **Trace Backend** (Jaeger or Application Insights)
   - Stores traces
   - Provides trace viewer UI
   - Enables trace search

### Trace Context Propagation

**HTTP headers:**
- `traceparent` (W3C Trace Context)
- `tracestate` (vendor-specific)

**Kafka headers:**
- Add trace context to Kafka message headers
- Propagate across async boundaries

**MongoDB:**
- Include trace ID in queries (for correlation)

### Sampling Strategy

**Development/Staging:**
- 100% sampling (see everything)

**Production:**
- Head-based sampling: 1-10% of traces
- Tail-based sampling: 100% of errors, slow requests (>1s)
- Reduces overhead while keeping important traces

---

## Dashboard Strategy

### Dashboard Types

**1. Infrastructure Dashboards**
- K8s cluster health (CPU, memory, pods)
- Service health (uptime, errors, latency)
- Resource utilization (scaling recommendations)

**2. Application Dashboards**
- Request rates per service
- Error rates and types
- Latency percentiles (P50, P95, P99)
- Kafka consumer lag

**3. Business Dashboards**
- AI usage (calls, tokens, cost)
- User activity (active users, agents)
- Feature usage (feed scans, drafts created)
- Quota utilization per tier

**4. Cost Dashboards** (Integration with usage metrics)
- Cost per user/agent
- Cost by feature (chat vs feed scans)
- Cost trends (daily, weekly, monthly)
- Cost vs quota (utilization)
- Infrastructure cost breakdown

### Dashboard Tools

**Option 1: Azure Dashboards**
- Native Azure integration
- Pre-built templates
- Limited customization

**Option 2: Grafana** (Recommended)
- More flexible and powerful
- Works with multiple data sources (Prometheus, Azure Monitor, Log Analytics)
- Better for custom business metrics
- Can embed cost/usage metrics seamlessly

**Option 3: Power BI** (For business users)
- Good for executive dashboards
- Can pull from Azure Monitor, Log Analytics
- More expensive, but better for non-technical users

---

## Incident Detection & Response

### Alerting Strategy

**Alert Levels:**

**Critical (Page on-call):**
- Service down (health check failing)
- Error rate > 5% for 5 minutes
- P95 latency > 2s for 5 minutes
- Consumer lag > 10,000 messages
- Cost spike > 2x normal

**Warning (Notify, no page):**
- Error rate > 1% for 10 minutes
- P95 latency > 1s for 10 minutes
- Consumer lag > 1,000 messages
- Quota utilization > 90%

**Info (Log only):**
- Deployment completed
- Scaling events
- Scheduled maintenance

### Alert Channels

**Azure Monitor Alerts:**
- Email notifications
- SMS (for critical)
- Webhooks (to PagerDuty, Slack, etc.)
- Azure Action Groups (routing rules)

**Grafana Alerts:**
- Email, Slack, PagerDuty
- More flexible routing
- Better for custom metrics

### Incident Response Workflow

**1. Detection:**
- Alert fires → On-call engineer notified
- Dashboard shows symptoms
- Trace ID or correlation ID available

**2. Investigation:**
- Check dashboards (metrics, logs, traces)
- Search logs for error patterns
- View trace for failed request
- Identify root cause

**3. Mitigation:**
- Rollback deployment (if recent)
- Scale up service (if resource constraint)
- Disable feature (if buggy)
- Manual fix (if quick)

**4. Resolution:**
- Fix deployed
- Verify metrics return to normal
- Document incident
- Post-mortem (for critical incidents)

### Runbooks

**Create runbooks for common incidents:**
- "Service is down" → Check health, check K8s, check logs
- "High error rate" → Check recent deployments, check dependencies
- "High latency" → Check database, check external APIs, check resource usage
- "Consumer lag" → Check consumer health, check message volume, check processing time

---

## Integration: Cost/Usage Metrics in Observability

### Where Cost Metrics Fit

**Metrics (Prometheus/Grafana):**
- `user_quota_used_cents{userId, tier}` (gauge)
- `ai_cost_cents_total{provider, model}` (counter)
- `cost_per_request_cents{service, feature}` (histogram)

**Logs (Structured):**
- Include cost in usage events
- Log quota checks (allowed/denied)
- Log cost anomalies

**Traces:**
- Add cost metadata to spans
- Show cost per request in trace view
- Identify expensive request paths

### Unified Dashboards

**Cost + Observability Dashboard (Grafana):**
- **Panel 1**: Cost per user (bar chart)
- **Panel 2**: Cost vs quota utilization (gauge)
- **Panel 3**: Cost by feature (pie chart)
- **Panel 4**: Cost trends (time series)
- **Panel 5**: Top expensive users (table)
- **Panel 6**: Cost per service (heatmap)
- **Panel 7**: AI calls vs cost (scatter plot)
- **Panel 8**: Cost alerts (list)

**Benefits:**
- Correlate cost with usage patterns
- Identify cost anomalies alongside performance issues
- Make data-driven decisions about feature costs
- Alert on cost spikes (same as performance alerts)

---

## Provider-Agnostic Design

### Abstraction Layer

**Create observability abstraction:**
```typescript
interface ObservabilityClient {
  log(level: string, message: string, metadata: Record<string, any>): void;
  metric(name: string, value: number, labels: Record<string, string>): void;
  trace(operation: string, fn: () => Promise<any>): Promise<any>;
}

// Azure implementation
class AzureObservabilityClient implements ObservabilityClient {
  // Uses Application Insights, Log Analytics
}

// Open-source implementation
class OpenSourceObservabilityClient implements ObservabilityClient {
  // Uses Prometheus, Loki, Jaeger
}
```

**Benefits:**
- Switch providers without code changes
- Test locally with open-source, deploy to Azure
- Support multi-cloud (Azure + AWS + GCP)

### Configuration-Driven

**Environment variables:**
```bash
OBSERVABILITY_PROVIDER=azure|opensource|hybrid
AZURE_APPINSIGHTS_CONNECTION_STRING=...
PROMETHEUS_ENDPOINT=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
```

**Services use same code, different config.**

---

## Performance & Cost Considerations

### Performance Impact

**Logging:**
- Async logging: <1ms overhead (negligible)
- Sync logging: 1-5ms overhead (acceptable)
- **Recommendation**: Use async logging library (Winston, Pino)

**Metrics:**
- Prometheus scraping: <1ms (reads from memory)
- Custom metrics: <0.1ms per metric (negligible)
- **Recommendation**: Batch metric updates if needed

**Tracing:**
- Sampling reduces overhead (1-10% in prod)
- Overhead per span: <0.5ms
- **Recommendation**: Use sampling, async export

**Verdict**: **Negligible performance impact** (<2ms total per request)

### Cost Analysis

**Azure Monitor (Option 1):**
- Application Insights: $2-5/GB ingested (first 5GB free)
- Log Analytics: $2.30/GB ingested (first 5GB free)
- At 50GB/month: ~$100-250/month
- At 500GB/month: ~$1,000-2,500/month

**Open-Source (Option 2):**
- Self-hosted on AKS: ~$50-200/month (compute + storage)
- Managed services (Azure Elastic): ~$300-1,000/month

**Hybrid (Option 3):**
- Azure for infrastructure: ~$50-100/month
- Self-hosted for application: ~$50-100/month
- **Total: ~$100-200/month**

**Recommendation**: Start with **Hybrid** (best cost/benefit), scale to full Azure if needed.

---

## Implementation Priorities

### Phase 1: Foundation (Week 1-2)
1. Structured logging (JSON format, consistent across services)
2. Centralized log collection (Fluent Bit → Log Analytics or Loki)
3. Basic metrics (Prometheus, key service metrics)
4. Health check dashboards (Grafana or Azure)

### Phase 2: Tracing & Advanced Metrics (Week 3-4)
1. OpenTelemetry setup (SDK + collector)
2. Distributed tracing (Jaeger or Application Insights)
3. Business metrics (AI calls, usage, cost)
4. Alerting (critical alerts only)

### Phase 3: Dashboards & Cost Integration (Week 5-6)
1. Comprehensive dashboards (infrastructure + application + business)
2. Cost metrics integration (usage metrics in Grafana)
3. Unified cost + observability dashboards
4. Runbooks and incident response

---

## Success Criteria

✅ **Logs**: All services log structured JSON, searchable in <5 seconds  
✅ **Metrics**: Key metrics tracked (latency, errors, business metrics)  
✅ **Traces**: Can trace requests across services in <10 seconds  
✅ **Dashboards**: Real-time visibility into system health  
✅ **Alerts**: Critical issues detected within 1 minute  
✅ **Cost visibility**: Cost metrics integrated into observability stack  
✅ **Incident response**: Mean time to resolution <30 minutes for critical issues

---

## Next Steps

1. Choose observability stack (Azure-first vs open-source vs hybrid)
2. Set up log collection (Fluent Bit + Log Analytics or Loki)
3. Add Prometheus metrics to 2-3 services (pilot)
4. Set up Grafana dashboards
5. Integrate cost/usage metrics into dashboards
6. Set up alerting (start with critical only)
7. Document runbooks for common incidents

