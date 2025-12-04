# Service Template: Minimal Production Patterns

**Time Investment**: ~25 minutes per service  
**Purpose**: Add critical production patterns without slowing down feature development

## Quick Copy-Paste Template

### 1. Health Check Endpoint (5 minutes)

```typescript
// src/app.ts or src/routes/health.ts
import express from 'express';

const router = express.Router();

router.get('/health', async (req, res) => {
  const checks: Record<string, { status: string; message?: string }> = {};
  
  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    checks.mongodb = mongoose.connection.readyState === 1 
      ? { status: 'healthy' }
      : { status: 'unhealthy', message: 'Not connected' };
  } catch (error) {
    checks.mongodb = { status: 'unhealthy', message: error.message };
  }
  
  // Check Kafka (if used)
  try {
    const { kafkaWrapper } = require('../kafka-client');
    // Simple check - if kafka exists, assume healthy
    checks.kafka = kafkaWrapper?.kafka 
      ? { status: 'healthy' }
      : { status: 'unhealthy', message: 'Not initialized' };
  } catch (error) {
    checks.kafka = { status: 'unhealthy', message: error.message };
  }
  
  // Check Redis (if used)
  // Add similar check for Redis if needed
  
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    service: process.env.SERVICE_NAME || 'unknown',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export { router as healthRouter };
```

**Usage**:
```typescript
// In main app.ts
import { healthRouter } from './routes/health';
app.use('/health', healthRouter);
```

### 2. Environment Validation (5 minutes)

```typescript
// src/config/env.ts
const requiredEnvVars = [
  'MONGO_URI',
  'KAFKA_BROKER_URL',
  'KAFKA_CLIENT_ID',
  'JWT_DEV',
  // Add service-specific required vars
];

export function validateEnvironment() {
  const missing: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  
  console.log('✅ All required environment variables are set');
}
```

**Usage**:
```typescript
// In src/index.ts (before starting service)
import { validateEnvironment } from './config/env';

async function start() {
  try {
    validateEnvironment();
    // ... rest of startup
  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    process.exit(1);
  }
}
```

### 3. Error Handling Wrapper (10 minutes)

```typescript
// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  // Log error with context
  console.error('[ERROR]', {
    statusCode,
    message,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    error: err.stack,
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(statusCode).json({
    errors: [
      {
        message: isDevelopment ? message : 'An error occurred',
        ...(isDevelopment && { detail: err.stack }),
      },
    ],
  });
}

// Async route wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

**Usage**:
```typescript
// In routes
import { asyncHandler } from '../middlewares/errorHandler';

router.post('/api/endpoint', asyncHandler(async (req, res) => {
  // Your route logic - errors automatically caught
  const result = await someAsyncOperation();
  res.json(result);
}));

// In app.ts
import { errorHandler } from './middlewares/errorHandler';
app.use(errorHandler); // Must be last middleware
```

### 4. Structured Logging (5 minutes)

```typescript
// src/utils/logger.ts
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log('[INFO]', JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      ...meta,
    }));
  },
  
  warn: (message: string, meta?: Record<string, any>) => {
    console.warn('[WARN]', JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      ...meta,
    }));
  },
  
  error: (message: string, error?: Error, meta?: Record<string, any>) => {
    console.error('[ERROR]', JSON.stringify({
      message,
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      error: error?.message,
      stack: error?.stack,
      ...meta,
    }));
  },
};
```

**Usage**:
```typescript
import { logger } from './utils/logger';

logger.info('Service started', { port: 3000 });
logger.warn('Rate limit approaching', { userId, requests: 95 });
logger.error('Failed to process message', error, { messageId, topic });
```

## Complete Service Template

```typescript
// src/index.ts
import { app } from './app';
import mongoose from 'mongoose';
import { kafkaWrapper } from './kafka-client';
import { validateEnvironment } from './config/env';
import { logger } from './utils/logger';

async function start() {
  try {
    // 1. Validate environment
    validateEnvironment();
    
    // 2. Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI!);
    logger.info('Connected to MongoDB');
    
    // 3. Connect to Kafka
    const brokers = process.env.KAFKA_BROKER_URL!.split(',').map(b => b.trim());
    await kafkaWrapper.connect(brokers, process.env.KAFKA_CLIENT_ID!);
    logger.info('Connected to Kafka');
    
    // 4. Start listeners
    // ... your listeners
    
    // 5. Start server
    app.listen(3000, () => {
      logger.info('Service started', { port: 3000 });
    });
    
    // 6. Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await kafkaWrapper.disconnect();
      await mongoose.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start service', error as Error);
    process.exit(1);
  }
}

start();
```

## Kubernetes Health Probes

Add to your `*-depl.yaml`:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

## Checklist for New Services

- [ ] Health check endpoint (`/health`)
- [ ] Environment validation on startup
- [ ] Error handling middleware
- [ ] Structured logging
- [ ] Graceful shutdown handlers
- [ ] Kubernetes health probes
- [ ] Try-catch in critical paths (Kafka listeners, DB operations)

## Time Breakdown

- Health check: 5 minutes
- Environment validation: 5 minutes
- Error handling: 10 minutes
- Structured logging: 5 minutes
- **Total: ~25 minutes per service**

This minimal set prevents the most common production issues:
- ✅ Service crashes (error handling)
- ✅ Configuration errors (env validation)
- ✅ Unclear failures (structured logging)
- ✅ Unhealthy services (health checks)

## Next Steps (Optional, Add Later)

- Prometheus metrics (when you have monitoring)
- Distributed tracing (when debugging cross-service issues)
- Dead Letter Queues (when you have failed message issues)
- Circuit breakers (when you have external API calls)

