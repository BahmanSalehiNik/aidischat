# Feed Worker Automation Design

## Overview
This document outlines the design for automating the trending feed worker while maintaining manual trigger capabilities for testing and debugging.

## Current State
- **TrendingWorker**: Uses `node-cron` to schedule periodic refreshes
- **Default Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Manual Trigger**: Available via `trendingService.refreshNow()`
- **Initial Refresh**: Runs immediately on service startup

## Design Goals
1. **Automated Operation**: Worker runs automatically in production
2. **Configurable Schedule**: Environment-based cron expression
3. **Manual Override**: HTTP endpoint for on-demand refresh (testing/debugging)
4. **Error Handling**: Graceful failure with logging and retry logic
5. **Observability**: Metrics and health checks
6. **Resource Management**: Prevent concurrent executions

## Architecture

### Components

#### 1. TrendingWorker (Enhanced)
```typescript
class TrendingWorker {
  private task: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastError: Error | null = null;
  
  start(): void
  stop(): void
  refreshNow(): Promise<void>
  getStatus(): WorkerStatus
}
```

**Responsibilities:**
- Schedule cron-based refreshes
- Prevent concurrent execution
- Track execution state
- Expose status for health checks

#### 2. HTTP Endpoint (New)
```
POST /api/feed/admin/trending/refresh
GET  /api/feed/admin/trending/status
```

**Manual Trigger Endpoint:**
- Requires admin authentication (JWT with admin role or special header)
- Triggers immediate refresh
- Returns execution status
- Useful for testing and manual interventions

**Status Endpoint:**
- Returns worker state (last run, next run, errors)
- No authentication required (or basic auth)
- Useful for monitoring

#### 3. Error Handling & Retry
- **Transient Errors**: Retry with exponential backoff
- **Permanent Errors**: Log and continue schedule
- **Concurrent Execution**: Queue or reject duplicate requests
- **Timeout Protection**: Max execution time per refresh

#### 4. Observability
- **Metrics**: Refresh count, duration, success/failure rate
- **Logging**: Structured logs with correlation IDs
- **Health Checks**: Worker status in readiness probe

## Implementation Details

### Environment Variables
```bash
# Cron schedule (default: every 5 minutes)
TRENDING_REFRESH_CRON=*/5 * * * *

# Enable/disable worker (default: true)
TRENDING_WORKER_ENABLED=true

# Max concurrent refreshes (default: 1)
TRENDING_MAX_CONCURRENT=1

# Refresh timeout in seconds (default: 300)
TRENDING_REFRESH_TIMEOUT=300

# Enable manual trigger endpoint (default: true in dev, false in prod)
TRENDING_MANUAL_TRIGGER_ENABLED=true
```

### Manual Trigger Endpoint
```typescript
router.post(
  '/api/feed/admin/trending/refresh',
  extractJWTPayload,
  adminRequired, // or special header check
  async (req: Request, res: Response) => {
    try {
      await trendingWorker.refreshNow();
      res.status(200).json({ 
        success: true, 
        message: 'Trending refresh triggered',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
);
```

### Status Endpoint
```typescript
router.get(
  '/api/feed/admin/trending/status',
  async (req: Request, res: Response) => {
    const status = trendingWorker.getStatus();
    res.json({
      enabled: status.enabled,
      isRunning: status.isRunning,
      lastRunTime: status.lastRunTime,
      nextRunTime: status.nextRunTime,
      lastError: status.lastError?.message,
      schedule: process.env.TRENDING_REFRESH_CRON || '*/5 * * * *'
    });
  }
);
```

### Enhanced Worker Implementation
```typescript
class TrendingWorker {
  private task: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastError: Error | null = null;
  private refreshPromise: Promise<void> | null = null;

  start() {
    if (this.task) return;
    
    const enabled = process.env.TRENDING_WORKER_ENABLED !== 'false';
    if (!enabled) {
      console.log('Trending worker disabled via TRENDING_WORKER_ENABLED');
      return;
    }

    const cronExpr = process.env.TRENDING_REFRESH_CRON || DEFAULT_CRON;
    this.task = cron.schedule(cronExpr, () => {
      this.executeRefresh().catch(err => 
        console.error('Scheduled trending refresh failed', err)
      );
    });

    // Initial refresh on startup
    this.executeRefresh().catch(err => 
      console.error('Initial trending refresh failed', err)
    );
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  async refreshNow(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Trending refresh already in progress');
    }
    return this.executeRefresh();
  }

  private async executeRefresh(): Promise<void> {
    if (this.isRunning) {
      console.warn('Trending refresh already in progress, skipping');
      return;
    }

    this.isRunning = true;
    this.lastError = null;
    const startTime = Date.now();

    try {
      const timeout = parseInt(process.env.TRENDING_REFRESH_TIMEOUT || '300', 10) * 1000;
      
      await Promise.race([
        trendingService.refreshNow(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Refresh timeout')), timeout)
        )
      ]);

      this.lastRunTime = new Date();
      console.log(`Trending refresh completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.lastError = error as Error;
      console.error('Trending refresh failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      enabled: this.task !== null,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      nextRunTime: this.getNextRunTime(),
      lastError: this.lastError,
    };
  }

  private getNextRunTime(): Date | null {
    if (!this.task) return null;
    // Calculate next run from cron expression
    // (Implementation depends on cron library capabilities)
    return null;
  }
}
```

## Testing Strategy

### Unit Tests
- Worker start/stop behavior
- Concurrent execution prevention
- Error handling and retry logic
- Status reporting

### Integration Tests
- Cron schedule execution
- Manual trigger endpoint
- Status endpoint
- Error scenarios

### Manual Testing
- Use manual trigger endpoint for immediate testing
- Verify cron schedule in development
- Test error recovery

## Deployment Considerations

### Development
- Manual trigger enabled
- Shorter refresh interval (1-2 minutes)
- Verbose logging

### Production
- Manual trigger disabled or admin-only
- Standard refresh interval (5 minutes)
- Error alerting
- Metrics collection

### Kubernetes
- Readiness probe can check worker status
- Liveness probe ensures worker is running
- Resource limits for refresh operations

## Monitoring & Alerts

### Metrics to Track
- Refresh execution count
- Refresh duration (p50, p95, p99)
- Success/failure rate
- Posts processed per refresh
- Trending posts count

### Alerts
- Worker not running for >10 minutes
- Refresh failures >3 in a row
- Refresh duration >5 minutes
- No trending posts after refresh

## Future Enhancements
1. **Incremental Updates**: Only refresh changed posts
2. **Distributed Lock**: Prevent multiple instances from running concurrently
3. **Priority Queue**: Process high-engagement posts first
4. **A/B Testing**: Multiple scoring algorithms
5. **Real-time Updates**: Event-driven refresh for hot posts

## Migration Plan
1. Deploy enhanced worker with manual trigger
2. Verify manual trigger works
3. Enable automated schedule
4. Monitor for 24-48 hours
5. Disable manual trigger in production (keep for staging)

