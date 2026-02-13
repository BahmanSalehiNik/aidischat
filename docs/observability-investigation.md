# Observability, Logging & Incident Management Investigation
## AI Chat Application on Azure with Multi-Cloud Strategy

**Date:** 2026-02-10  
**Purpose:** Deep research into observability, logging, and incident handling for Azure-hosted AI chat application with future multi-cloud support.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Observability Strategy](#observability-strategy)
3. [Azure Monitor & Application Insights](#azure-monitor--application-insights)
4. [Distributed Tracing with OpenTelemetry](#distributed-tracing-with-opentelemetry)
5. [Logging Architecture](#logging-architecture)
6. [Incident Management & SRE Practices](#incident-management--sre-practices)
7. [Cost Analysis](#cost-analysis)
8. [Dashboard & Visualization](#dashboard--visualization)
9. [Multi-Cloud Considerations](#multi-cloud-considerations)
10. [Performance Optimization](#performance-optimization)
11. [Tools & Platforms](#tools--platforms)
12. [References](#references)

---

## Executive Summary

A comprehensive observability strategy for an AI chat application on Azure requires:

- **Azure Application Insights** for APM and distributed tracing
- **Azure Monitor Logs** (Log Analytics) for centralized logging
- **OpenTelemetry** for vendor-neutral instrumentation (multi-cloud ready)
- **Structured JSON logging** with Pino for performance
- **Grafana** for visualization and dashboards
- **PagerDuty/Azure Monitor alerts** for incident management

**Key Findings:**
- Observability costs: $50-$500/month for small-medium apps
- OpenTelemetry provides cloud-agnostic instrumentation
- Structured logging with Pino adds <5ms overhead
- Azure Application Insights auto-instrumentation available for Node.js/Java
- Grafana can integrate usage metrics with observability dashboards

---

## Observability Strategy

### The Three Pillars

#### 1. **Metrics** (What is happening?)
- System health indicators (CPU, memory, disk, network)
- Application performance (request rate, latency, error rate)
- Business metrics (active users, AI requests, cost per user)
- Custom metrics (agent usage, token consumption)

**Azure Implementation:**
- Azure Monitor Metrics (platform metrics - free)
- Application Insights metrics
- Prometheus metrics (via Azure Monitor managed Prometheus)

#### 2. **Logs** (Why is it happening?)
- Application logs (errors, warnings, info, debug)
- Infrastructure logs (Kubernetes, container logs)
- Audit logs (user actions, security events)
- AI interaction logs (prompts, responses, token usage)

**Azure Implementation:**
- Azure Monitor Logs (Log Analytics Workspaces)
- Application Insights logs
- Container Insights for AKS

#### 3. **Traces** (How did it happen?)
- Distributed tracing across microservices
- Request flow visualization
- Dependency mapping
- Performance bottleneck identification

**Azure Implementation:**
- Application Insights distributed tracing
- OpenTelemetry traces
- Correlation IDs across services

### Observability Goals

1. **Detect issues before users report them**
2. **Reduce Mean Time To Detection (MTTD)** to <5 minutes
3. **Reduce Mean Time To Resolution (MTTR)** to <30 minutes
4. **Provide actionable alerts** (no alert fatigue)
5. **Enable data-driven decisions** for optimization

---

## Azure Monitor & Application Insights

### Azure Monitor Overview

Azure Monitor is the comprehensive observability platform for Azure, providing:
- Centralized data collection
- Log Analytics for querying (KQL)
- Alerting and automation
- Integration with Azure services

**Architecture:**
```
Application → Azure Monitor Agent/SDK
                ↓
         Log Analytics Workspace
                ↓
         ┌──────┴──────┐
         ↓             ↓
  Application    Azure Monitor
   Insights         Metrics
         ↓             ↓
    Dashboards    Alerts
```

### Application Insights

**Purpose:** Application Performance Monitoring (APM) for cloud-native apps

**Key Features:**
- Automatic instrumentation (Node.js, Java, .NET, Python)
- Distributed tracing
- Dependency tracking
- Live metrics stream
- Application map
- Smart detection (anomaly detection)

**Auto-Instrumentation for AKS:**
```yaml
# Enable auto-instrumentation for Node.js pods
apiVersion: v1
kind: Pod
metadata:
  name: chat-service
  annotations:
    instrumentation.opentelemetry.io/inject-nodejs: "true"
spec:
  containers:
  - name: chat
    image: chat-service:latest
    env:
    - name: APPLICATIONINSIGHTS_CONNECTION_STRING
      value: "InstrumentationKey=xxx;IngestionEndpoint=https://..."
```

**Manual Instrumentation (TypeScript):**
```typescript
import * as appInsights from "applicationinsights";

// Initialize Application Insights
appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(true)
  .start();

const client = appInsights.defaultClient;

// Track custom events
client.trackEvent({
  name: "AI_Request",
  properties: {
    userId: "user123",
    agentId: "research-agent",
    model: "gpt-4",
    tokens: 2500
  },
  measurements: {
    cost: 0.05,
    latency: 1200
  }
});

// Track dependencies
client.trackDependency({
  target: "openai.com",
  name: "OpenAI API",
  data: "POST /v1/chat/completions",
  duration: 1200,
  resultCode: 200,
  success: true,
  dependencyTypeName: "HTTP"
});
```

### Container Insights for AKS

**Enable Container Insights:**
```bash
# Enable on existing AKS cluster
az aks enable-addons \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --addons monitoring \
  --workspace-resource-id /subscriptions/.../workspaces/myWorkspace
```

**What Container Insights Provides:**
- Pod and node performance metrics
- Container logs
- Resource utilization
- Kubernetes events
- Live logs and metrics
- Prometheus metrics scraping

---

## Distributed Tracing with OpenTelemetry

### Why OpenTelemetry?

**Vendor-Neutral:** Works with Azure, AWS, GCP, and on-premises
**Future-Proof:** Industry standard (CNCF project)
**Comprehensive:** Traces, metrics, and logs in one framework
**Multi-Cloud Ready:** Same instrumentation across all clouds

### OpenTelemetry Architecture

```
Application Code
      ↓
OpenTelemetry SDK
      ↓
OpenTelemetry Collector (optional)
      ↓
   ┌──┴──┐
   ↓     ↓
Azure   Other Backends
Monitor (Jaeger, Tempo, etc.)
```

### Implementation

**Install OpenTelemetry:**
```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @azure/monitor-opentelemetry-exporter
```

**Configure OpenTelemetry (TypeScript):**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'chat-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'production',
  }),
  traceExporter: new AzureMonitorTraceExporter({
    connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

**Custom Spans:**
```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('chat-service');

async function processAIRequest(userId: string, message: string) {
  const span = tracer.startSpan('process_ai_request', {
    attributes: {
      'user.id': userId,
      'message.length': message.length,
    },
  });

  try {
    // Call AI service
    const aiSpan = tracer.startSpan('call_openai', {
      parent: span,
      attributes: {
        'ai.model': 'gpt-4',
      },
    });

    const response = await callOpenAI(message);
    
    aiSpan.setAttribute('ai.tokens', response.usage.total_tokens);
    aiSpan.end();

    span.setAttribute('response.length', response.text.length);
    return response;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

### Correlation IDs

**Generate and propagate correlation IDs:**
```typescript
import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage();

// Middleware to create correlation context
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  asyncLocalStorage.run({ correlationId }, () => {
    res.setHeader('x-correlation-id', correlationId);
    next();
  });
});

// Use correlation ID in logs and traces
function log(level: string, message: string, data?: any) {
  const context = asyncLocalStorage.getStore();
  logger[level]({
    correlationId: context?.correlationId,
    message,
    ...data,
  });
}
```

---

## Logging Architecture

### Structured Logging Strategy

**Format:** JSON (machine-readable, parseable)
**Library:** Pino (fastest Node.js logger, ~10x faster than Winston)
**Destination:** stdout (captured by container runtime)
**Aggregation:** Azure Monitor Logs (Log Analytics)

### Log Levels

| Level | When to Use | Production Volume |
|-------|-------------|-------------------|
| **FATAL** | Application crash | Rare |
| **ERROR** | Errors requiring attention | <1% of logs |
| **WARN** | Potential issues | <5% of logs |
| **INFO** | Important business events | 20-30% of logs |
| **DEBUG** | Detailed diagnostic info | Disabled in prod |
| **TRACE** | Very detailed debugging | Disabled in prod |

### Pino Configuration

**Install:**
```bash
npm install pino pino-pretty
```

**Setup (production):**
```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'chat-service',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  redact: {
    paths: ['password', 'apiKey', 'token', 'creditCard'],
    remove: true,
  },
});

export default logger;
```

**Setup (development):**
```typescript
import pino from 'pino';

const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
});

export default logger;
```

**Usage:**
```typescript
import logger from './logger';

// Basic logging
logger.info('User logged in', { userId: 'user123' });

// With correlation ID (from AsyncLocalStorage)
logger.info({
  correlationId: getCorrelationId(),
  userId: 'user123',
  action: 'ai_request',
  model: 'gpt-4',
  tokens: 2500,
}, 'AI request processed');

// Error logging
try {
  await processRequest();
} catch (error) {
  logger.error({
    err: error,
    userId: 'user123',
    correlationId: getCorrelationId(),
  }, 'Failed to process request');
}

// Performance logging
const start = Date.now();
await doWork();
logger.info({
  duration: Date.now() - start,
  operation: 'ai_request',
}, 'Operation completed');
```

### Log Schema

**Standard Fields:**
```json
{
  "level": "INFO",
  "time": "2026-02-10T19:42:03.123Z",
  "service": "chat-service",
  "environment": "production",
  "version": "1.0.0",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user123",
  "message": "AI request processed",
  "model": "gpt-4",
  "tokens": 2500,
  "cost": 0.05,
  "duration": 1200
}
```

### Log Collection in AKS

**Container logs are automatically collected by Container Insights:**
```bash
# View logs in Azure CLI
az monitor log-analytics query \
  --workspace myWorkspace \
  --analytics-query "ContainerLog | where ContainerName == 'chat-service' | limit 100"
```

**Query logs with KQL:**
```kql
ContainerLog
| where TimeGenerated > ago(1h)
| where ContainerName == "chat-service"
| where LogEntry contains "ERROR"
| extend logData = parse_json(LogEntry)
| project TimeGenerated, logData.correlationId, logData.message, logData.err
| order by TimeGenerated desc
```

---

## Incident Management & SRE Practices

### Incident Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0/SEV-0** | Critical outage | <15 min | Complete service down, data loss |
| **P1/SEV-1** | Major impact | <30 min | Partial outage, degraded performance |
| **P2/SEV-2** | Moderate impact | <2 hours | Non-critical feature broken |
| **P3/SEV-3** | Minor impact | <1 day | Cosmetic issues, minor bugs |

### On-Call Best Practices

#### 1. **On-Call Rotation**
- Primary and secondary on-call engineers
- 1-week rotations (maximum)
- Follow-the-sun model for global teams
- Fair distribution of on-call burden

#### 2. **Escalation Policy**
```
Alert Triggered
      ↓
Primary On-Call (5 min)
      ↓ (no response)
Secondary On-Call (10 min)
      ↓ (no response)
Engineering Manager (15 min)
      ↓ (no response)
Director/VP Engineering
```

#### 3. **Actionable Alerts Only**
- Every alert must require human action
- No "nice to know" alerts
- Tune thresholds to reduce noise
- Use alert aggregation (don't alert on every instance)

### Azure Monitor Alerting

**Alert Types:**
1. **Metric Alerts** - Based on metric thresholds
2. **Log Alerts** - Based on log query results
3. **Activity Log Alerts** - Azure resource changes
4. **Resource Health Alerts** - Service health issues

**Create Metric Alert (Azure CLI):**
```bash
az monitor metrics alert create \
  --name "High Error Rate" \
  --resource-group myResourceGroup \
  --scopes /subscriptions/.../resourceGroups/.../providers/Microsoft.Insights/components/myAppInsights \
  --condition "avg requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action /subscriptions/.../actionGroups/myActionGroup \
  --description "Alert when error rate exceeds 10 per minute"
```

**Create Log Alert (KQL-based):**
```kql
// Alert when error rate exceeds threshold
requests
| where timestamp > ago(5m)
| where success == false
| summarize ErrorCount = count() by bin(timestamp, 1m)
| where ErrorCount > 10
```

**Action Groups:**
- Email notifications
- SMS alerts
- Webhook (PagerDuty, Slack, Teams)
- Azure Function
- Logic App
- ITSM integration

### Incident Response Workflow

```
1. Alert Triggered
   ↓
2. On-Call Acknowledges (PagerDuty/Azure Monitor)
   ↓
3. Assess Severity (P0-P3)
   ↓
4. Create Incident (ServiceNow/Jira)
   ↓
5. Investigate (Logs, Metrics, Traces)
   ↓
6. Mitigate (Rollback, Scale, Fix)
   ↓
7. Resolve & Close Incident
   ↓
8. Post-Incident Review (Blameless)
   ↓
9. Document Learnings & Action Items
```

### Runbooks

**Create runbooks for common issues:**

**Example: High Memory Usage**
```markdown
# Runbook: High Memory Usage Alert

## Symptoms
- Memory usage > 80% for 5+ minutes
- Pod restarts due to OOMKilled

## Investigation Steps
1. Check current memory usage:
   ```bash
   kubectl top pods -n production
   ```

2. Check pod logs for memory leaks:
   ```bash
   kubectl logs <pod-name> -n production --tail=100
   ```

3. Query Application Insights for memory trends:
   ```kql
   performanceCounters
   | where name == "% Processor Time"
   | summarize avg(value) by bin(timestamp, 5m)
   ```

## Mitigation
1. **Immediate:** Restart affected pods
   ```bash
   kubectl rollout restart deployment/chat-service -n production
   ```

2. **Short-term:** Increase memory limits
   ```yaml
   resources:
     limits:
       memory: "2Gi"
   ```

3. **Long-term:** Investigate memory leak, optimize code

## Escalation
If issue persists after restart, escalate to Platform Team.
```

### Post-Incident Reviews

**Blameless Culture:**
- Focus on systems, not individuals
- What went wrong? (timeline)
- Why did it happen? (root cause)
- How do we prevent it? (action items)

**Template:**
```markdown
# Post-Incident Review: [Incident Title]

**Date:** 2026-02-10
**Severity:** P1
**Duration:** 45 minutes
**Impact:** 15% of users unable to send messages

## Timeline
- 14:00 - Alert triggered: High error rate
- 14:05 - On-call engineer acknowledged
- 14:10 - Identified database connection pool exhaustion
- 14:20 - Increased connection pool size
- 14:30 - Error rate returned to normal
- 14:45 - Incident resolved

## Root Cause
Database connection pool size (10) was insufficient for peak load (50+ concurrent requests).

## What Went Well
- Alert triggered quickly (<5 min from issue start)
- On-call responded promptly
- Mitigation was straightforward

## What Went Wrong
- No monitoring for connection pool utilization
- Connection pool size not load-tested
- No automatic scaling of connection pool

## Action Items
1. [ ] Add connection pool metrics to dashboard (Owner: @alice, Due: 2026-02-15)
2. [ ] Implement dynamic connection pool sizing (Owner: @bob, Due: 2026-02-20)
3. [ ] Load test connection pool under peak conditions (Owner: @charlie, Due: 2026-02-18)
4. [ ] Document connection pool configuration in runbook (Owner: @alice, Due: 2026-02-12)
```

---

## Cost Analysis

### Azure Monitor Pricing

**Log Analytics (Primary Cost Driver):**

| Tier | Ingestion Cost | Retention | Use Case |
|------|----------------|-----------|----------|
| **Pay-as-you-go** | ~$2.76/GB | 31 days free, then $0.12/GB/month | Variable workloads |
| **Commitment (100GB/day)** | ~$2.30/GB | 31 days free | Predictable workloads |
| **Basic Logs** | ~$0.65/GB | 30 days free | High-volume, low-value logs |
| **Auxiliary Logs** | ~$0.25/GB | 30 days free | Archive, infrequent access |

**Application Insights:**
- First 5 GB/month free per subscription
- Shares Log Analytics pricing after free tier
- 90 days free retention (vs 31 days for standard logs)

**Other Costs:**
- **Metrics:** Platform metrics are free
- **Alerts:** Metric alerts: $0.10/month, Log alerts: $1.50/month
- **Queries:** Free for Analytics Logs, charged for Basic/Auxiliary
- **Data Export:** $0.13/GB for continuous export

### Cost Estimation

**Small Application (10 pods, 1000 users):**
- Log ingestion: 5 GB/day = $414/month (pay-as-you-go)
- Application Insights: Included (under 5GB free tier)
- Alerts: 20 alerts = $2/month
- **Total: ~$416/month**

**Medium Application (50 pods, 10,000 users):**
- Log ingestion: 30 GB/day = $2,070/month (commitment tier recommended)
- Application Insights: Included in Log Analytics
- Alerts: 50 alerts = $5/month
- **Total: ~$2,075/month**

**Large Application (200 pods, 100,000 users):**
- Log ingestion: 150 GB/day = $10,350/month (commitment tier)
- Application Insights: Included
- Alerts: 100 alerts = $10/month
- **Total: ~$10,360/month**

### Cost Optimization Strategies

1. **Use Basic Logs for High-Volume Data**
   - Container stdout/stderr logs
   - Debug-level logs
   - Non-critical telemetry

2. **Sampling**
   - Sample 10-20% of traces in production
   - Full sampling for errors
   - Adaptive sampling based on volume

3. **Log Level Management**
   - Production: INFO and above
   - Staging: DEBUG and above
   - Development: TRACE

4. **Data Retention**
   - Keep 31 days in hot storage (free)
   - Archive to Azure Storage for long-term ($0.02/GB/month)

5. **Filtering at Source**
   - Don't log sensitive data
   - Filter noisy logs before ingestion
   - Use log processors to reduce volume

6. **Commitment Tiers**
   - If ingesting >100GB/day, use commitment tier
   - Saves ~15-20% vs pay-as-you-go

---

## Dashboard & Visualization

### Grafana Integration with Azure Monitor

**Why Grafana?**
- Unified view across multiple data sources
- Rich visualization options
- Community dashboards
- Alerting capabilities
- Multi-cloud ready

**Two Options:**

#### 1. **Azure Monitor Dashboards with Grafana** (Free, in Azure Portal)
- No additional cost
- Built into Azure portal
- Limited to Azure data sources
- Good for Azure-only workloads

#### 2. **Azure Managed Grafana** (Recommended)
- Fully managed Grafana service
- Supports multiple data sources (Azure, Prometheus, Loki, etc.)
- Advanced features (alerts, reports, sharing)
- Pricing: ~$200/month (Essential tier)

### Setup Azure Managed Grafana

**Create Grafana instance:**
```bash
az grafana create \
  --name myGrafana \
  --resource-group myResourceGroup \
  --location eastus
```

**Configure Azure Monitor data source:**
1. Navigate to Grafana instance
2. Configuration → Data Sources → Add Azure Monitor
3. Use Managed Identity for authentication
4. Select subscription and Log Analytics workspace

### Usage Metrics Dashboard

**Integrate cost monitoring with observability:**

**Dashboard Panels:**

1. **Current Period Usage**
   - Total AI requests
   - Total tokens consumed
   - Current cost
   - Remaining budget

2. **Usage by User**
   - Top 10 users by cost
   - User tier distribution
   - Users approaching limits

3. **Usage by Agent**
   - Cost per agent type
   - Agent efficiency (cost per successful request)
   - Most expensive workflows

4. **Cost Trends**
   - Daily cost over time
   - Projected end-of-month cost
   - Cost vs budget

**Example Grafana Panel (KQL query):**
```kql
// Total AI cost today
customMetrics
| where name == "ai_request_cost"
| where timestamp > startofday(now())
| summarize TotalCost = sum(value)
```

**Example Dashboard JSON:**
```json
{
  "dashboard": {
    "title": "AI Chat - Usage & Costs",
    "panels": [
      {
        "title": "Total Cost Today",
        "type": "stat",
        "targets": [
          {
            "datasource": "Azure Monitor",
            "queryType": "Azure Log Analytics",
            "query": "customMetrics | where name == 'ai_request_cost' | where timestamp > startofday(now()) | summarize TotalCost = sum(value)"
          }
        ]
      },
      {
        "title": "Cost by User (Top 10)",
        "type": "bar",
        "targets": [
          {
            "datasource": "Azure Monitor",
            "query": "customMetrics | where name == 'ai_request_cost' | summarize Cost = sum(value) by userId | top 10 by Cost"
          }
        ]
      }
    ]
  }
}
```

### Pre-Built Dashboards

**Import community dashboards:**
- Kubernetes cluster monitoring
- Node.js application performance
- PostgreSQL database metrics
- NGINX ingress metrics

**Create custom dashboards for:**
- Application health (error rate, latency, throughput)
- Infrastructure health (CPU, memory, disk, network)
- Business metrics (active users, AI requests, revenue)
- Cost metrics (usage, budget, forecasts)

---

## Multi-Cloud Considerations

### Cloud-Agnostic Strategy with OpenTelemetry

**Goal:** Same instrumentation works on Azure, AWS, GCP

**Architecture:**
```
Application (OpenTelemetry SDK)
      ↓
OpenTelemetry Collector
      ↓
   ┌──┴──┬──────┐
   ↓     ↓      ↓
Azure  AWS   GCP
Monitor CloudWatch  Operations
```

### OpenTelemetry Collector

**Deploy as sidecar or DaemonSet:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
          http:
    
    processors:
      batch:
      
    exporters:
      azuremonitor:
        connection_string: "${APPLICATIONINSIGHTS_CONNECTION_STRING}"
      
      # Future: Add AWS CloudWatch, GCP Cloud Monitoring
      # awscloudwatch:
      #   region: us-east-1
      
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [azuremonitor]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [azuremonitor]
```

### Azure Arc for Hybrid/Multi-Cloud

**Extend Azure management to other clouds:**
- Azure Arc-enabled Kubernetes
- Azure Arc-enabled servers
- Unified monitoring across clouds
- Consistent policy enforcement

**Enable Arc on non-Azure Kubernetes:**
```bash
az connectedk8s connect \
  --name myAWSCluster \
  --resource-group myResourceGroup \
  --location eastus
```

### Vendor-Neutral Tools

| Category | Tool | Cloud Support |
|----------|------|---------------|
| **Tracing** | Jaeger, Tempo | All clouds |
| **Metrics** | Prometheus | All clouds |
| **Logs** | Loki, Elasticsearch | All clouds |
| **Visualization** | Grafana | All clouds |
| **Alerting** | Prometheus Alertmanager | All clouds |

---

## Performance Optimization

### Logging Performance

**Pino Performance:**
- ~10x faster than Winston
- Asynchronous by default
- Minimal CPU overhead (<5ms per log)
- Efficient JSON serialization

**Benchmarks (logs/second):**
- Pino: ~50,000 logs/sec
- Winston: ~5,000 logs/sec
- Bunyan: ~15,000 logs/sec

**Optimization Tips:**
1. **Use async logging** (default in Pino)
2. **Avoid logging in hot paths** (high-frequency functions)
3. **Sample high-volume logs** (e.g., log 1 in 100 requests)
4. **Use appropriate log levels** (DEBUG only in development)
5. **Lazy evaluation** for expensive log data

**Example:**
```typescript
// Bad: Always evaluates expensive operation
logger.debug(`User data: ${JSON.stringify(getUserData())}`);

// Good: Only evaluates if debug is enabled
if (logger.isLevelEnabled('debug')) {
  logger.debug({ userData: getUserData() }, 'User data');
}

// Better: Pino does this automatically
logger.debug({ userData: () => getUserData() }, 'User data');
```

### Tracing Performance

**Sampling Strategies:**

1. **Head-based Sampling** (at trace start)
   - Sample 10% of all traces
   - Always sample errors
   - Sample 100% of slow requests (>2s)

```typescript
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';

const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1), // 10% sampling
});
```

2. **Tail-based Sampling** (after trace completes)
   - Keep all error traces
   - Keep slow traces
   - Sample normal traces

**Performance Impact:**
- Tracing overhead: <5% CPU
- Memory overhead: ~10MB per 1000 active traces
- Network overhead: ~1KB per trace

---

## Tools & Platforms

### Observability Stack

**Azure-Native:**
- Azure Monitor
- Application Insights
- Log Analytics
- Azure Managed Grafana

**Open Source:**
- OpenTelemetry (instrumentation)
- Prometheus (metrics)
- Grafana (visualization)
- Loki (logs)
- Jaeger/Tempo (tracing)

**Commercial:**
- Datadog (full-stack observability)
- New Relic (APM)
- Dynatrace (AI-powered observability)
- Splunk (log management)

### Incident Management

**Recommended: PagerDuty**
- On-call scheduling
- Escalation policies
- Incident tracking
- Integrations (Slack, Teams, Jira)
- Post-incident analytics

**Alternatives:**
- Opsgenie (Atlassian)
- VictorOps (Splunk)
- Azure Monitor alerts (basic)

### Logging Libraries

**Node.js/TypeScript:**
- **Pino** (recommended) - Fastest, production-ready
- Winston - Feature-rich, slower
- Bunyan - JSON by default
- tslog - TypeScript-native

**Performance Comparison:**
| Library | Logs/sec | Async | JSON | TypeScript |
|---------|----------|-------|------|------------|
| Pino | 50,000 | ✅ | ✅ | ✅ |
| Winston | 5,000 | ✅ | ✅ | ✅ |
| Bunyan | 15,000 | ✅ | ✅ | ⚠️ |
| tslog | 20,000 | ✅ | ✅ | ✅ |

---

## References

### Azure Documentation
- [Azure Monitor Overview](https://docs.microsoft.com/azure/azure-monitor/)
- [Application Insights](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Container Insights](https://docs.microsoft.com/azure/azure-monitor/containers/container-insights-overview)
- [Log Analytics Pricing](https://azure.microsoft.com/pricing/details/monitor/)

### OpenTelemetry
- [OpenTelemetry Official Site](https://opentelemetry.io/)
- [Azure Monitor OpenTelemetry Distro](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/monitor/monitor-opentelemetry-exporter)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)

### Best Practices
- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [Microsoft SRE Practices](https://docs.microsoft.com/azure/architecture/framework/devops/overview)
- [Incident Management Best Practices](https://incident.io/guide)

### Tools
- [Pino Logger](https://getpino.io/)
- [Grafana](https://grafana.com/)
- [PagerDuty](https://www.pagerduty.com/)
- [Prometheus](https://prometheus.io/)

---

## Conclusion

A robust observability strategy for an AI chat application on Azure requires:

1. **Comprehensive instrumentation** with OpenTelemetry for future multi-cloud support
2. **Structured JSON logging** with Pino for performance and parseability
3. **Centralized log aggregation** in Azure Monitor Logs
4. **Distributed tracing** via Application Insights
5. **Actionable alerting** with Azure Monitor and PagerDuty
6. **Rich visualization** with Grafana dashboards
7. **Incident management** with clear runbooks and post-incident reviews

**Cost Considerations:**
- Small app: ~$400/month
- Medium app: ~$2,000/month
- Large app: ~$10,000/month

**Performance Impact:**
- Logging: <5ms overhead per request
- Tracing: <5% CPU overhead
- Metrics: Negligible

**Next Steps:**
1. Set up Azure Application Insights
2. Implement OpenTelemetry instrumentation
3. Configure structured logging with Pino
4. Create Grafana dashboards
5. Define alert rules and runbooks
6. Establish on-call rotation
7. Conduct incident response training
