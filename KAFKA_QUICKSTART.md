# Kafka (Redpanda) Quick Start

## Start Kafka

```bash
./start-kafka.sh
```

Or manually:

```bash
docker-compose -f docker-compose.kafka.yml up -d
```

## Verify It's Running

```bash
# Check container status
docker ps | grep redpanda

# Test connection
docker exec redpanda rpk cluster info --brokers localhost:9092
```

kubectl delete secret ai-provider-secrets 2>/dev/null; 

kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='your-actual-openai-key-here' \
  --from-literal=ANTHROPIC_API_KEY='dummy' \
  --from-literal=COHERE_API_KEY='dummy'

## Stop Kafka

```bash
docker-compose -f docker-compose.kafka.yml down
```

## View Logs

```bash
docker-compose -f docker-compose.kafka.yml logs -f
```

## Re-initialize Topics

If topics are missing:

```bash
docker-compose -f docker-compose.kafka.yml up kafka-topics-init
```

## Connection Details

- **Internal (Docker)**: `redpanda:9092`
- **External (Host)**: `localhost:9092` or `localhost:19092`
- **Kubernetes Pods**: `redpanda-srv:9092`





