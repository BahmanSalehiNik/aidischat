# NATS vs Kafka (Redpanda) Usage

## Summary

**NATS is still actively used** by 3 ecommerce services. All other services have migrated to Kafka (Redpanda).

## Services Using NATS (Still Active)

1. **`ecommerce/orders`** - Uses NATS for order events
2. **`ecommerce/aiModelCards`** - Uses NATS for model card events  
3. **`ecommerce/expiration`** - Uses NATS for order expiration events

These services:
- Have `nats-client.ts` files
- Connect to NATS in their `index.ts`
- Use NATS listeners and publishers
- **REQUIRE** `NATS_URL`, `NATS_CLUSTER_ID`, `NATS_CLIENT_ID` environment variables

## Services Using Kafka/Redpanda (Migrated)

All other services use Kafka/Redpanda:

- `user` - Uses `kafkaWrapper`
- `post` - Uses `kafkaWrapper`
- `chat` - Uses `kafkaWrapper`
- `room` - Uses `kafkaWrapper`
- `feed` - Uses `kafkaWrapper`
- `friendship` - Uses `kafkaWrapper`
- `media` - Uses `kafkaWrapper`
- `agent` - Uses `kafkaWrapper`
- `agent-manager` - Uses `kafkaWrapper`
- `realtime-gateway` - Uses `kafkaWrapper`
- `ai-gateway` - Uses `kafkaWrapper`
- `ar-conversations` - Uses `kafkaWrapper`
- `ar-avatar` - Uses `kafkaWrapper`
- `chat-recommendation` - Uses `kafkaWrapper`
- `chat-history` - Uses `kafkaWrapper`
- `search` - Uses `kafkaWrapper`
- `feedback` - Uses `kafkaWrapper`
- `friend-suggestions` - Uses `kafkaWrapper`
- `order-expiration` - Uses `kafkaWrapper` (note: different from ecommerce/expiration)

## Services with NATS Config But Not Using It

These services have `NATS_URL` in their deployment configs but **don't actually use NATS** in code:

- `user` - Has NATS_URL but uses Kafka
- `post` - Has NATS_URL but uses Kafka
- `chat` - Has NATS_URL but uses Kafka
- `room` - Has NATS_URL but uses Kafka
- `feed` - Has NATS_URL but uses Kafka
- `friendship` - Has NATS_URL but uses Kafka
- `media` - Has NATS_URL but uses Kafka
- `agent` - Has NATS_URL but uses Kafka
- `order-expiration` - Has NATS_URL but uses Kafka

**These NATS environment variables can be removed** from their deployment configs (they're leftover from migration).

## Migration Status

- ✅ **Core services**: Migrated to Kafka
- ✅ **Agent services**: Migrated to Kafka
- ✅ **AR services**: Migrated to Kafka
- ⚠️ **Ecommerce services**: Still using NATS (not migrated yet)

## Recommendation

1. **Keep NATS running** - Required by 3 ecommerce services
2. **Remove NATS_URL from migrated services** - Clean up unused config
3. **Plan migration** - Consider migrating ecommerce services to Kafka for consistency

## NATS Deployment

NATS is deployed in Kubernetes:
- Deployment: `nats-depl`
- Service: `nats-srv:4222`
- Cluster ID: `aichatwar`

## Kafka/Redpanda Deployment

Redpanda is now deployed outside Kubernetes:
- Docker Compose: `docker-compose.kafka.yml`
- Kubernetes Service: `redpanda-srv:9092` (points to external Redpanda)


