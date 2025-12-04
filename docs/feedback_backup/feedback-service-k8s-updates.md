# Feedback Service Kubernetes Configuration Updates

## Summary

Updated Kubernetes YAML files and Skaffold configuration to support the Redis-based batching implementation for the feedback service.

## Changes Made

### 1. Created Redis Deployment (`infra/k8s/redis-feedback-depl.yaml`)

**New file** for Redis infrastructure:
- Deployment: `redis-feedback-depl`
- Service: `redis-feedback-srv` (port 6379)
- Image: `redis:7`
- Replicas: 1

### 2. Updated Feedback Deployment (`infra/k8s/feedback-depl.yaml`)

**Added environment variables:**
- `REDIS_FEEDBACK_URL`: `redis://redis-feedback-srv:6379`
- `FEEDBACK_BATCH_SIZE`: `10` (items per batch)
- `FEEDBACK_BATCH_TIME_MS`: `300000` (5 minutes in milliseconds)
- `FEEDBACK_WORKER_CHECK_INTERVAL_MS`: `60000` (1 minute in milliseconds)

**Existing environment variables (unchanged):**
- `KAFKA_BROKER_URL`
- `KAFKA_CLIENT_ID`
- `MONGO_URI`
- `JWT_DEV`

### 3. Updated Skaffold Configuration (`skaffold.yaml`)

**Added to infrastructure phase:**
- `./infra/k8s/redis-feedback-depl.yaml` (deployed before feedback service)

**Deployment order:**
1. Infrastructure services (Redis, MongoDB, Kafka, etc.)
2. Application services (including feedback service)

### 4. MongoDB Deployment (`infra/k8s/feedback-mongo-depl.yaml`)

**No changes needed** - MongoDB configuration is already correct:
- Service: `feedback-mongo-srv` (port 27017)
- Database: `feedback`

## Deployment Architecture

```
Infrastructure Phase:
├── Redis Feedback (redis-feedback-depl)
├── MongoDB Feedback (feedback-mongodb-depl)
└── Other infrastructure services...

Application Phase:
└── Feedback Service (feedback-depl)
    ├── Connects to: redis-feedback-srv:6379
    ├── Connects to: feedback-mongo-srv:27017
    └── Connects to: redpanda-srv:9092 (Kafka)
```

## Environment Variables Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `REDIS_FEEDBACK_URL` | `redis://redis-feedback-srv:6379` | Redis connection URL for batching |
| `FEEDBACK_BATCH_SIZE` | `10` | Number of items per batch |
| `FEEDBACK_BATCH_TIME_MS` | `300000` | Time threshold (5 minutes) |
| `FEEDBACK_WORKER_CHECK_INTERVAL_MS` | `60000` | Worker check interval (1 minute) |
| `MONGO_URI` | `mongodb://feedback-mongo-srv:27017/feedback` | MongoDB connection |
| `KAFKA_BROKER_URL` | `redpanda-srv:9092` | Kafka broker URL |

## Verification

To verify the deployment:

```bash
# Check Redis deployment
kubectl get deployment redis-feedback-depl
kubectl get service redis-feedback-srv

# Check Feedback deployment
kubectl get deployment feedback-depl
kubectl get service feedback-srv

# Check environment variables
kubectl describe deployment feedback-depl | grep -A 20 "Environment:"

# Check logs
kubectl logs -f deployment/feedback-depl
```

## Notes

- Redis is deployed in the infrastructure phase, ensuring it's available before the feedback service starts
- The feedback service will retry Redis connections automatically (configured in `redis-client.ts`)
- MongoDB configuration remains unchanged
- All services use the same deployment pattern as other services in the cluster

