# Kafka (Redpanda) External Setup

Redpanda now runs outside Kubernetes via Docker Compose, allowing k8s pods to access it through networking configuration.

## Architecture

- **Redpanda**: Runs in Docker Compose on the host machine
- **Kubernetes Pods**: Access Redpanda via an External Service that points to the host IP
- **Networking**: Uses Endpoints + Service pattern to expose host Redpanda to k8s

## Setup Instructions

### 1. Start Redpanda with Docker Compose

```bash
docker-compose -f docker-compose.kafka.yml up -d
```

This will:
- Start Redpanda on port 9092 (internal) and 19092 (external)
- Initialize all required Kafka topics
- Expose Redpanda on the host machine

### 2. Get Your Host IP

```bash
# Linux
hostname -I | awk '{print $1}'

# Or get minikube host IP
minikube ssh -- hostname -I | awk '{print $1}'
```

### 3. Update External Service IP (if needed)

If your host IP changes, update `infra/k8s/redpanda-external-srv.yaml`:

```yaml
apiVersion: v1
kind: Endpoints
metadata:
  name: redpanda-srv
subsets:
  - addresses:
      - ip: YOUR_HOST_IP_HERE  # Update this
    ports:
      - name: kafka
        port: 9092
```

### 4. Deploy External Service to Kubernetes

The external service is automatically deployed via Skaffold, or manually:

```bash
kubectl apply -f infra/k8s/redpanda-external-srv.yaml
```

### 5. Verify Connectivity

From a k8s pod:

```bash
# Test connection from a pod
kubectl run -it --rm debug --image=redpandadata/redpanda:latest --restart=Never -- rpk cluster info --brokers redpanda-srv:9092
```

## Configuration

### Docker Compose

- **Internal Port**: 9092 (for Docker network)
- **External Port**: 19092 (for host access)
- **Advertise Address**: Host IP (192.168.178.179) - configured for k8s access

### Kubernetes

- **Service Name**: `redpanda-srv` (same as before - no changes needed in deployments)
- **Service Type**: Endpoints + Service (points to host IP)
- **Port**: 9092

## Benefits

1. **Resource Efficiency**: Redpanda doesn't consume k8s resources
2. **Easier Management**: Can restart/update Redpanda without affecting k8s
3. **Development Flexibility**: Can run Redpanda locally while developing
4. **Production Ready**: Easy to migrate to managed Kafka service later

## Troubleshooting

### Pods can't connect to Redpanda

1. **Check Redpanda is running**:
   ```bash
   docker ps | grep redpanda
   ```

2. **Check host IP is correct**:
   ```bash
   kubectl get endpoints redpanda-srv -o yaml
   ```
   Should show your host IP in the addresses section.

3. **Test from host**:
   ```bash
   docker exec -it redpanda rpk cluster info --brokers localhost:9092
   ```

4. **Test from k8s pod**:
   ```bash
   kubectl run -it --rm debug --image=redpandadata/redpanda:latest --restart=Never -- rpk cluster info --brokers redpanda-srv:9092
   ```

### Host IP Changed

If your host IP changes (e.g., after network restart):

1. Update `infra/k8s/redpanda-external-srv.yaml` with new IP
2. Apply the changes:
   ```bash
   kubectl apply -f infra/k8s/redpanda-external-srv.yaml
   ```

### Topics Not Created

If topics are missing, re-run topic initialization:

```bash
docker-compose -f docker-compose.kafka.yml up kafka-topics-init
```

## Migration Notes

- **No deployment changes needed**: All services still use `redpanda-srv:9092`
- **Skaffold updated**: Removed `redpanda-depl.yaml` and `kafka-topics-init.yaml` from manifests
- **Topic initialization**: Now handled by Docker Compose, includes all topics from k8s version

## Next Steps

For production, consider:
- Using a managed Kafka service (AWS MSK, Confluent Cloud, etc.)
- Updating the External Service to point to the managed service endpoint
- No code changes needed - just update the service endpoint


