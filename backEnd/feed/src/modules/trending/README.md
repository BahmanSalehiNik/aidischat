# Trending Module - Implementation Guide

## Overview
The trending module provides automated refresh of trending posts for cold-start feed scenarios. It includes both automated scheduling and manual trigger capabilities.

## Features

### Automated Worker
- **Cron-based scheduling**: Runs automatically on a configurable schedule
- **Concurrent execution prevention**: Prevents multiple refreshes from running simultaneously
- **Error handling**: Tracks errors and continues operation
- **Timeout protection**: Prevents long-running refreshes from blocking

### Manual Trigger
- **HTTP endpoint**: Trigger refresh on-demand for testing
- **Status endpoint**: Monitor worker state and health

## Environment Variables

```bash
# Cron schedule (default: every 5 minutes)
TRENDING_REFRESH_CRON=*/5 * * * *

# Enable/disable worker (default: true)
TRENDING_WORKER_ENABLED=true

# Refresh timeout in seconds (default: 300)
TRENDING_REFRESH_TIMEOUT=300

# Enable manual trigger endpoint (default: true)
TRENDING_MANUAL_TRIGGER_ENABLED=true
```

## API Endpoints

### POST /api/feed/admin/trending/refresh
Manually trigger a trending refresh.

**Authentication**: Required (JWT token)

**Request**:
```bash
curl -X POST http://localhost:3000/api/feed/admin/trending/refresh \
  -H "Cookie: session=..." \
  -H "Content-Type: application/json"
```

**Response** (Success):
```json
{
  "success": true,
  "message": "Trending refresh triggered",
  "timestamp": "2025-11-20T08:00:00.000Z"
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Trending refresh already in progress"
}
```

### GET /api/feed/admin/trending/status
Get the current status of the trending worker.

**Authentication**: Not required (can be added if needed)

**Request**:
```bash
curl http://localhost:3000/api/feed/admin/trending/status
```

**Response**:
```json
{
  "enabled": true,
  "isRunning": false,
  "lastRunTime": "2025-11-20T07:55:00.000Z",
  "lastError": null,
  "schedule": "*/5 * * * *"
}
```

## Usage Examples

### Development
```bash
# Use shorter refresh interval for faster testing
TRENDING_REFRESH_CRON=*/1 * * * *  # Every minute

# Enable manual trigger
TRENDING_MANUAL_TRIGGER_ENABLED=true
```

### Production
```bash
# Standard refresh interval
TRENDING_REFRESH_CRON=*/5 * * * *  # Every 5 minutes

# Disable manual trigger for security
TRENDING_MANUAL_TRIGGER_ENABLED=false
```

### Testing
```bash
# Disable automated worker
TRENDING_WORKER_ENABLED=false

# Use manual trigger only
# Trigger via API endpoint when needed
```

## Monitoring

### Check Worker Status
```bash
curl http://localhost:3000/api/feed/admin/trending/status
```

### View Logs
The worker logs:
- Startup: `Starting trending worker with schedule: ...`
- Completion: `Trending refresh completed in Xms`
- Errors: `Trending refresh failed: ...`

### Health Checks
The status endpoint can be used in Kubernetes readiness/liveness probes:
```yaml
readinessProbe:
  httpGet:
    path: /api/feed/admin/trending/status
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
```

## Troubleshooting

### Worker Not Running
1. Check `TRENDING_WORKER_ENABLED` is not `false`
2. Check logs for startup messages
3. Verify cron expression is valid

### Refresh Failing
1. Check `lastError` in status endpoint
2. Verify database connectivity
3. Check for timeout issues (increase `TRENDING_REFRESH_TIMEOUT`)

### Manual Trigger Not Working
1. Verify `TRENDING_MANUAL_TRIGGER_ENABLED` is not `false`
2. Check authentication token is valid
3. Verify worker is not already running

## Implementation Details

### Worker Lifecycle
1. **Startup**: Worker starts automatically when service starts
2. **Initial Refresh**: Runs immediately on startup
3. **Scheduled Refreshes**: Runs according to cron schedule
4. **Manual Triggers**: Can be triggered via API endpoint

### Concurrency Control
- Only one refresh can run at a time
- Concurrent requests are rejected with error message
- Scheduled refreshes are skipped if one is already running

### Error Handling
- Errors are logged but don't stop the worker
- Last error is tracked in status
- Worker continues with next scheduled refresh
