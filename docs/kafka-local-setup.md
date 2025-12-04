# Kafka Local Development Setup

## Quick Start

### Option 1: Docker Compose (Recommended for Local Dev)

```bash
# Start Kafka
docker-compose -f docker-compose.kafka.yml up -d

# Check status
docker-compose -f docker-compose.kafka.yml ps

# View logs
docker-compose -f docker-compose.kafka.yml logs -f redpanda

# Stop Kafka
docker-compose -f docker-compose.kafka.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.kafka.yml down -v
```

### Option 2: Keep Using Kubernetes (Current)

If you prefer to keep using K8s for Kafka:
- No changes needed
- Continue using `skaffold dev` as before
- Kafka will be deployed via `redpanda-depl.yaml`

## Connection Strings

### Services Running in Docker/K8s
```bash
KAFKA_BROKER_URL=redpanda:9092  # Docker Compose network
# OR
KAFKA_BROKER_URL=redpanda-srv:9092  # Kubernetes service
```

### Services Running on Host Machine
```bash
KAFKA_BROKER_URL=localhost:19092  # External port from Docker Compose
```

## Topic Management

### List Topics
```bash
docker exec -it redpanda rpk topic list --brokers localhost:9092
```

### Create Topic Manually
```bash
docker exec -it redpanda rpk topic create my-topic \
  --brokers localhost:9092 \
  --partitions 3 \
  --replicas 1
```

### Describe Topic
```bash
docker exec -it redpanda rpk topic describe my-topic --brokers localhost:9092
```

### Produce Test Message
```bash
docker exec -it redpanda rpk topic produce my-topic --brokers localhost:9092
```

### Consume Messages
```bash
docker exec -it redpanda rpk topic consume my-topic --brokers localhost:9092
```

## Troubleshooting

### Kafka Not Starting
```bash
# Check if port is already in use
lsof -i :9092
lsof -i :19092

# Check Docker logs
docker-compose -f docker-compose.kafka.yml logs redpanda
```

### Services Can't Connect
1. **Check network**: Ensure services are on the same Docker network
2. **Check port**: Verify correct port (9092 for internal, 19092 for external)
3. **Check health**: `docker exec -it redpanda rpk cluster health --brokers localhost:9092`

### Topics Not Created
```bash
# Manually run topic initialization
docker-compose -f docker-compose.kafka.yml up kafka-topics-init
```

## Integration with Skaffold

### Hybrid Approach (Docker Compose Kafka + K8s Services)

1. Start Kafka in Docker Compose:
   ```bash
   docker-compose -f docker-compose.kafka.yml up -d
   ```

2. Get host machine IP (for K8s services to connect):
   ```bash
   # Linux/Mac
   hostname -I | awk '{print $1}'
   
   # Or use host.docker.internal (if available)
   ```

3. Update K8s service deployments to use host IP:
   ```yaml
   env:
     - name: KAFKA_BROKER_URL
       value: 'host.docker.internal:19092'  # Or use actual host IP
   ```

4. Run Skaffold:
   ```bash
   skaffold dev
   ```

### Pure Docker Compose (No K8s)

1. Start Kafka:
   ```bash
   docker-compose -f docker-compose.kafka.yml up -d
   ```

2. Start services locally with:
   ```bash
   KAFKA_BROKER_URL=localhost:19092 npm run dev
   ```

## Migration from K8s to Docker Compose

1. **Stop K8s Kafka** (optional, to free resources):
   ```bash
   kubectl delete statefulset redpanda
   kubectl delete service redpanda-srv
   kubectl delete job kafka-topics-init
   ```

2. **Start Docker Compose Kafka**:
   ```bash
   docker-compose -f docker-compose.kafka.yml up -d
   ```

3. **Update Skaffold** (optional):
   - Comment out `redpanda-depl.yaml` and `kafka-topics-init.yaml` in `skaffold.yaml`
   - Or keep them commented for easy rollback

4. **Test connectivity**:
   ```bash
   # From a service pod
   kubectl exec -it <service-pod> -- env | grep KAFKA
   
   # Or test from host
   docker exec -it redpanda rpk cluster info --brokers localhost:9092
   ```

## Performance Tuning

### For Local Development
The current Docker Compose config uses minimal resources:
- Memory: 512MB
- CPU: 1 core
- Suitable for development

### For Higher Load Testing
Update `docker-compose.kafka.yml`:
```yaml
command:
  - redpanda
  - start
  - --mode dev-container
  - --smp 2  # Increase CPU
  - --memory 2G  # Increase memory
```

## Next Steps

- See [kafka-architecture-migration.md](./kafka-architecture-migration.md) for production migration plan
- See [production-grade-message-reliability.md](./production-grade-message-reliability.md) for reliability patterns

