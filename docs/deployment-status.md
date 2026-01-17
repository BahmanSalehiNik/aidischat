# Deployment Status Report

**Generated**: $(date)
**Cluster**: minikube

## Summary

**Total Deployments**: Checking...
**Pending (0/X ready)**: 4 deployments
**Recently Ready**: 2 deployments (ai-chat-host, post)

---

## Pending Deployments

### 1. **ar-avatar-depl** - 0/1 Ready ⚠️

**Status**: Running but failing health checks
**Pod**: `ar-avatar-depl-78677468fb-knnxp`
**Restarts**: 1

**Issues**:
- ❌ **Readiness probe failing**: `Get "http://10.244.15.114:3000/health": context deadline exceeded`
- ❌ **Liveness probe failing**: Same timeout error
- ⚠️ **Kafka topic partition errors**: `This server does not host this topic-partition`
- ✅ Service is listening on port 3000
- ✅ Kafka listeners started but having partition issues

**Root Cause**: 
- Health endpoint (`/health`) is timing out
- Kafka topic partition assignment issues (may be related to Redpanda/Kafka setup)

**Logs Show**:
```
✅ [AR Avatar] Service listening on port 3000
[agent.ingested] Topic partition error: This server does not host this topic-partition
```

**Action Needed**:
1. Check if `/health` endpoint is implemented and responding
2. Verify Kafka/Redpanda topic creation and partition assignment
3. Check if health endpoint timeout is too short

---

### 2. **ar-conversations-depl** - 0/1 Ready ⚠️

**Status**: Running but startup probe failing
**Pod**: `ar-conversations-depl-65fdfc95b8-lccpt`
**Restarts**: 0

**Issues**:
- ❌ **Startup probe failing**: `dial tcp 10.244.15.115:3000: connect: connection refused`
- ❌ **Then**: `i/o timeout` after connection refused
- ⚠️ App is starting but not ready

**Root Cause**: 
- Application is taking longer than startup probe timeout to become ready
- Connection refused suggests app hasn't started listening yet

**Logs Show**:
```
> ar-conversations@1.0.0 start
> ts-node-dev --poll src/index.ts
[INFO] 19:42:40 ts-node-dev ver. 2.0.0
```

**Action Needed**:
1. Increase startup probe `initialDelaySeconds` and `periodSeconds`
2. Check application startup time
3. Verify dependencies (MongoDB, etc.) are ready

---

### 3. **chat-recommendation-depl** - 0/1 Ready ⚠️

**Status**: Running but health checks failing
**Pod**: `chat-recommendation-depl-7c7f5c9f7c-wx6vl`
**Restarts**: 1

**Issues**:
- ❌ **Readiness probe failing**: `Get "http://10.244.15.113:3000/health": connection refused` then `context deadline exceeded`
- ❌ **Liveness probe failing**: Same issues
- ⚠️ Init container (wait-for-kafka) completed successfully
- ⚠️ Main container restarted once due to liveness probe failure

**Root Cause**: 
- Health endpoint not responding or timing out
- Application may be crashing or not starting properly

**Action Needed**:
1. Check application logs for errors
2. Verify `/health` endpoint implementation
3. Check if dependencies are ready (Kafka topics, MongoDB, etc.)
4. Increase health check timeouts if app needs more time to start

---

### 4. **realtime-gateway-depl** - 0/1 Ready ⏳

**Status**: Init container running
**Pod**: `realtime-gateway-depl-587c55b6d7-vqmpf`
**Phase**: `Init:0/1`

**Issues**:
- ⏳ **Init container waiting**: `wait-for-kafka-topics` is still running
- ✅ Init container started successfully
- ⏳ Waiting for Kafka topics to be created

**Root Cause**: 
- Init container is waiting for Kafka topics to exist
- Topics may not be created yet or init container timeout is too long

**Action Needed**:
1. Check if Kafka topics exist: `kubectl exec -it <redpanda-pod> -- rpk topic list`
2. Check init container logs: `kubectl logs <pod-name> -c wait-for-kafka-topics`
3. Verify `kafka-topics-init.yaml` job completed successfully
4. Increase init container timeout if topics take longer to create

---

## Recently Ready Deployments ✅

### 5. **ai-chat-host-depl** - 1/1 Ready ✅
- **Status**: Now ready (was pending)
- **Restarts**: 1 (recovered)

### 6. **post-depl** - 1/1 Ready ✅
- **Status**: Now ready (was pending)
- **Restarts**: 1 (recovered)

---

## Common Issues Summary

### Health Check Failures
- **ar-avatar**: Health endpoint timeout
- **chat-recommendation**: Health endpoint not responding
- **ar-conversations**: Startup probe timeout

### Kafka/Redpanda Issues
- **ar-avatar**: Topic partition assignment errors
- **realtime-gateway**: Waiting for topics to be created

### Startup Time Issues
- Multiple services need more time to start than probe timeouts allow

---

## Recommended Actions

### Immediate Actions

1. **Check Kafka Topics**:
   ```bash
   kubectl exec -it <redpanda-pod> -- rpk topic list
   kubectl get job kafka-topics-init  # Check if topic init job completed
   ```

2. **Check Health Endpoints**:
   ```bash
   kubectl port-forward <ar-avatar-pod> 3000:3000
   curl http://localhost:3000/health
   ```

3. **Increase Probe Timeouts** (if apps need more time):
   - Increase `startupProbe.initialDelaySeconds`
   - Increase `readinessProbe.timeoutSeconds`
   - Increase `livenessProbe.timeoutSeconds`

4. **Check Application Logs**:
   ```bash
   kubectl logs -l app=ar-avatar --tail=50
   kubectl logs -l app=ar-conversations --tail=50
   kubectl logs -l app=chat-recommendation --tail=50
   kubectl logs -l app=realtime-gateway -c wait-for-kafka-topics
   ```

### Long-term Fixes

1. **Implement proper health endpoints** that respond quickly
2. **Add dependency checks** in startup (wait for MongoDB, Kafka, etc.)
3. **Optimize startup time** for services
4. **Fix Kafka topic partition assignment** issues
5. **Ensure kafka-topics-init job** runs before services that need topics

---

## Commands to Monitor

```bash
# Watch deployment status
kubectl get deployments -w

# Watch pod status
kubectl get pods -w

# Check specific deployment
kubectl describe deployment <deployment-name>

# Check pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs -l app=<app-name> --tail=50 -f
```

---

**Last Updated**: $(date)

