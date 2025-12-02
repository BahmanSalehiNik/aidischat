# Kafka Architecture Migration Plan

## Overview

This document outlines the migration from Kubernetes-managed Kafka (Redpanda) to:
1. **Local Development**: Docker Compose-managed Kafka
2. **Production**: Cloud Provider Managed Kafka Service (AWS MSK, Azure Event Hubs, GCP Pub/Sub, etc.)

## Current Architecture

- **Kafka Implementation**: Redpanda (Kafka-compatible)
- **Deployment**: Kubernetes StatefulSet (single replica in dev)
- **Connection**: Services connect via `redpanda-srv:9092` (K8s service)
- **Topic Initialization**: Kubernetes Job (`kafka-topics-init.yaml`)

## Benefits of Migration

### 1. **Enhanced Stability & Fault Tolerance**

#### Local Development (Docker Compose)
- ✅ **Simpler Setup**: No need for full K8s cluster for local dev
- ✅ **Faster Startup**: Docker Compose starts faster than K8s pods
- ✅ **Better Resource Control**: Direct control over resource limits
- ✅ **Easier Debugging**: Direct access to logs and container state
- ✅ **Network Isolation**: Dedicated Docker network for Kafka services

#### Production (Managed Kafka)
- ✅ **High Availability**: Cloud providers offer multi-AZ deployments (99.9%+ uptime)
- ✅ **Automatic Scaling**: Auto-scales based on traffic
- ✅ **Built-in Replication**: Automatic data replication across zones
- ✅ **Managed Upgrades**: Zero-downtime upgrades handled by provider
- ✅ **Monitoring & Alerting**: Built-in metrics, dashboards, and alerts
- ✅ **Security**: Built-in encryption, IAM integration, VPC isolation
- ✅ **Backup & Disaster Recovery**: Automated backups and cross-region replication
- ✅ **Compliance**: SOC 2, ISO 27001, HIPAA compliance out of the box

### 2. **Operational Benefits**

- **Reduced Operational Overhead**: No need to manage Kafka cluster lifecycle
- **Cost Optimization**: Pay only for what you use (managed services)
- **Expert Support**: Cloud provider support for Kafka issues
- **Better Performance**: Optimized configurations by cloud providers
- **Easier Multi-Environment Management**: Different brokers per environment

## Migration Strategy

### Phase 1: Local Development (Docker Compose)

#### Implementation Steps

1. **Create Docker Compose Configuration**
   - File: `docker-compose.kafka.yml`
   - Includes Redpanda service and topic initialization
   - Exposes ports for both internal (9092) and external (19092) access

2. **Update Service Configuration**
   - Services running in Docker: Use `redpanda:9092` (internal network)
   - Services running locally: Use `localhost:19092` (external port)
   - Services in K8s: Keep using `redpanda-srv:9092` (for hybrid setups)

3. **Environment Variable Strategy**
   ```bash
   # Local development (Docker Compose)
   KAFKA_BROKER_URL=redpanda:9092  # For services in Docker network
   KAFKA_BROKER_URL=localhost:19092  # For services on host machine
   
   # Kubernetes (current)
   KAFKA_BROKER_URL=redpanda-srv:9092
   
   # Production (managed service)
   KAFKA_BROKER_URL=your-managed-kafka-broker:9092
   ```

4. **Update Skaffold Configuration**
   - Remove `redpanda-depl.yaml` and `kafka-topics-init.yaml` from manifests
   - Add instructions to start Docker Compose before running Skaffold
   - Or: Keep K8s deployment as fallback option

### Phase 2: Production (Managed Kafka)

#### Cloud Provider Options

1. **AWS MSK (Managed Streaming for Apache Kafka)**
   - Fully managed Kafka service
   - Multi-AZ deployment
   - Integration with AWS IAM, VPC, CloudWatch
   - Pricing: ~$0.10/hour per broker

2. **Azure Event Hubs for Kafka**
   - Kafka-compatible API
   - Auto-scaling
   - Integration with Azure AD, Monitor
   - Pricing: Pay-per-throughput unit

3. **GCP Pub/Sub**
   - Not Kafka-compatible, requires adapter
   - Alternative: Confluent Cloud on GCP
   - Pricing: Pay-per-message

4. **Confluent Cloud**
   - Multi-cloud managed Kafka
   - Works on AWS, Azure, GCP
   - Enterprise features (Schema Registry, KSQL, etc.)
   - Pricing: Usage-based

#### Implementation Steps

1. **Provision Managed Kafka**
   - Create cluster in cloud provider
   - Configure VPC/network security
   - Set up authentication (SASL, TLS, IAM)
   - Configure replication and retention policies

2. **Update Kubernetes Deployments**
   - Replace `KAFKA_BROKER_URL` with managed service endpoint
   - Add authentication credentials (secrets)
   - Update network policies if needed

3. **Topic Migration**
   - Export topics from current cluster
   - Create topics in managed cluster
   - Use Kafka MirrorMaker or similar for data migration

4. **Monitoring & Alerting**
   - Set up cloud provider monitoring
   - Configure alerts for lag, throughput, errors
   - Set up dashboards

## Configuration Changes Required

### 1. Service Code Changes

**Minimal Changes Needed**: Services already use `KAFKA_BROKER_URL` environment variable, so only configuration changes are required.

### 2. Kubernetes Deployment Updates

For production, update deployment files:

```yaml
env:
  - name: KAFKA_BROKER_URL
    value: 'your-managed-kafka-broker:9092'  # Managed service endpoint
  - name: KAFKA_SECURITY_PROTOCOL
    value: 'SASL_SSL'  # If using authentication
  - name: KAFKA_SASL_MECHANISM
    value: 'PLAIN'  # Or 'SCRAM-SHA-256'
  - name: KAFKA_SASL_USERNAME
    valueFrom:
      secretKeyRef:
        name: kafka-credentials
        key: username
  - name: KAFKA_SASL_PASSWORD
    valueFrom:
      secretKeyRef:
        name: kafka-credentials
        key: password
```

### 3. Local Development Setup

**Option A: Pure Docker Compose**
```bash
# Start Kafka
docker-compose -f docker-compose.kafka.yml up -d

# Start services (they connect to localhost:19092)
npm run dev
```

**Option B: Hybrid (Docker Compose + K8s)**
```bash
# Start Kafka in Docker Compose
docker-compose -f docker-compose.kafka.yml up -d

# Update K8s service to point to host machine
# Use host.docker.internal or host IP

# Run Skaffold (services in K8s connect to Docker Compose Kafka)
skaffold dev
```

## Fault Tolerance Comparison

### Current Setup (K8s Redpanda)
- ❌ Single replica (no redundancy)
- ❌ Manual scaling required
- ❌ Manual backup/restore
- ❌ No automatic failover
- ❌ Manual monitoring setup

### Docker Compose (Local Dev)
- ✅ Faster recovery (Docker restart)
- ✅ Persistent volumes (data survives restarts)
- ⚠️ Single instance (acceptable for local dev)

### Managed Kafka (Production)
- ✅ Multi-AZ deployment (automatic failover)
- ✅ Automatic scaling
- ✅ Automated backups
- ✅ Built-in monitoring
- ✅ 99.9%+ uptime SLA
- ✅ Automatic patching and upgrades

## Migration Checklist

### Local Development
- [ ] Create `docker-compose.kafka.yml`
- [ ] Test Kafka startup and topic initialization
- [ ] Update service environment variables for local dev
- [ ] Update documentation
- [ ] Test all services connecting to Docker Compose Kafka
- [ ] Remove or comment out K8s Kafka manifests from Skaffold

### Production
- [ ] Choose cloud provider and Kafka service
- [ ] Provision managed Kafka cluster
- [ ] Configure security (authentication, encryption, network)
- [ ] Create all required topics
- [ ] Set up monitoring and alerting
- [ ] Update K8s deployments with new broker URL
- [ ] Test connectivity from K8s pods
- [ ] Plan data migration (if needed)
- [ ] Execute migration during maintenance window
- [ ] Monitor post-migration metrics
- [ ] Remove old K8s Kafka deployment

## Rollback Plan

### Local Development
- Keep K8s manifests as backup
- Can switch back by updating Skaffold manifests

### Production
- Keep old Kafka cluster running during migration
- Use dual-write pattern initially
- Switch consumers gradually
- Keep old cluster for 30 days before decommissioning

## Cost Considerations

### Current (K8s)
- Infrastructure cost: Included in K8s cluster cost
- Operational cost: Developer time for management

### Managed Kafka
- **AWS MSK**: ~$70-150/month for 3-broker cluster (dev)
- **Azure Event Hubs**: ~$10-50/month for basic tier
- **Confluent Cloud**: ~$1/hour for basic cluster
- **Savings**: Reduced operational overhead, faster development

## Recommendations

1. **Immediate**: Implement Docker Compose for local development
2. **Short-term**: Evaluate cloud provider options
3. **Production**: Migrate to managed Kafka before scaling
4. **Monitoring**: Set up comprehensive monitoring regardless of choice

## Next Steps

1. Review and approve this migration plan
2. Implement Docker Compose setup
3. Test locally with all services
4. Evaluate cloud provider options
5. Create production migration timeline

