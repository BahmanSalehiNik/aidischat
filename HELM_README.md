# Helm Charts for Production CI/CD

This document describes how to use Helm charts for deploying the application in production environments.

## Overview

Helm is a package manager for Kubernetes that allows you to define, install, and upgrade Kubernetes applications. For production deployments, Helm provides better dependency management, templating, and versioning compared to raw YAML manifests.

## Architecture

The application consists of multiple microservices and infrastructure components:

### Infrastructure Services (Dependencies)
- **Redpanda** (Kafka-compatible message broker)
- **NATS** (Event streaming)
- **MongoDB** (Multiple instances for different services)
- **Redis** (Caching and pub/sub)

### Application Services
- **API Gateway** (Entry point for all REST requests)
- **Realtime Gateway** (WebSocket connections)
- **Auth Service** (Authentication and authorization)
- **User Service** (User management)
- **Post Service** (Post creation and management)
- **Feed Service** (Feed aggregation)
- **Media Service** (Media upload and management)
- **Chat Service** (Chat functionality)
- **Room Service** (Room management)
- **Friendship Service** (Social connections)
- **Agent Service** (AI agents)
- **AI Gateway** (AI model gateway)
- **E-commerce Services** (Orders, models, expiration)

## Helm Chart Structure

### Recommended Structure

```
charts/
├── infrastructure/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── redpanda/
│       ├── nats/
│       ├── mongodb/
│       └── redis/
├── application/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── api-gateway/
│       ├── realtime-gateway/
│       ├── auth/
│       └── ...
└── root/
    ├── Chart.yaml          # Parent chart
    ├── values.yaml
    └── requirements.yaml   # Dependencies
```

## Dependency Management

### Option 1: Parent Chart with Dependencies (Recommended)

Create a root chart that manages dependencies:

```yaml
# charts/root/Chart.yaml
apiVersion: v2
name: aichatwar
description: AI Chat Distributed Application
version: 1.0.0
type: application

dependencies:
  - name: infrastructure
    version: "1.0.0"
    repository: "file://../infrastructure"
    condition: infrastructure.enabled
  - name: application
    version: "1.0.0"
    repository: "file://../application"
    condition: application.enabled
    dependsOn:
      - infrastructure
```

### Option 2: Helm Hooks for Deployment Order

Use Helm hooks to ensure infrastructure is deployed before applications:

```yaml
# In infrastructure chart templates
metadata:
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation
```

### Option 3: Init Containers

Use init containers in application pods to wait for dependencies:

```yaml
# Example in application deployment
spec:
  template:
    spec:
      initContainers:
        - name: wait-for-kafka
          image: busybox:1.35
          command: ['sh', '-c']
          args:
            - |
              until nc -z redpanda-srv 9092; do
                echo "Waiting for Redpanda..."
                sleep 2
              done
        - name: wait-for-mongo
          image: busybox:1.35
          command: ['sh', '-c']
          args:
            - |
              until nc -z auth-mongo-srv 27017; do
                echo "Waiting for MongoDB..."
                sleep 2
              done
      containers:
        - name: application
          # ... your app container
```

## Values File Structure

### Root values.yaml

```yaml
# charts/root/values.yaml
global:
  environment: production
  imageRegistry: your-registry.io
  imagePullSecrets:
    - name: registry-secret

infrastructure:
  enabled: true
  redpanda:
    enabled: true
    replicas: 3
  nats:
    enabled: true
    replicas: 3
  mongodb:
    enabled: true
    replicas: 1
  redis:
    enabled: true
    replicas: 1

application:
  enabled: true
  apiGateway:
    enabled: true
    replicas: 2
  realtimeGateway:
    enabled: true
    replicas: 3
  # ... other services
```

## Deployment Workflow

### 1. Build and Package Charts

```bash
# Package infrastructure chart
cd charts/infrastructure
helm package .

# Package application chart
cd ../application
helm package .

# Update dependencies in root chart
cd ../root
helm dependency update
```

### 2. Install/Upgrade

```bash
# Install everything
helm install aichatwar ./charts/root \
  --namespace production \
  --create-namespace \
  --values charts/root/values-production.yaml

# Upgrade
helm upgrade aichatwar ./charts/root \
  --namespace production \
  --values charts/root/values-production.yaml

# Rollback
helm rollback aichatwar --namespace production
```

### 3. CI/CD Integration

#### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: '3.12.0'
      
      - name: Configure kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Package charts
        run: |
          cd charts/infrastructure && helm package .
          cd ../application && helm package .
          cd ../root && helm dependency update
      
      - name: Deploy
        run: |
          helm upgrade --install aichatwar ./charts/root \
            --namespace production \
            --create-namespace \
            --values charts/root/values-production.yaml \
            --wait \
            --timeout 10m
```

## Dependency Order

The following order ensures dependencies are available:

1. **Infrastructure Layer**
   - Redpanda (Kafka)
   - NATS
   - MongoDB instances
   - Redis instances

2. **Core Services Layer**
   - Auth Service
   - User Service
   - Media Service

3. **Application Services Layer**
   - Post Service
   - Feed Service
   - Chat Service
   - Room Service
   - Friendship Service

4. **Gateway Layer**
   - API Gateway
   - Realtime Gateway
   - AI Gateway

5. **Ingress Layer**
   - Ingress Controller

## Health Checks and Readiness

All services should implement:

1. **Startup Probes**: Wait for dependencies before starting
2. **Readiness Probes**: Indicate when service is ready to receive traffic
3. **Liveness Probes**: Detect and restart unhealthy containers

Example:

```yaml
startupProbe:
  tcpSocket:
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5

livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Environment-Specific Values

Create separate values files for different environments:

- `values-dev.yaml` - Development
- `values-staging.yaml` - Staging
- `values-production.yaml` - Production

```bash
helm install aichatwar ./charts/root \
  --values charts/root/values.yaml \
  --values charts/root/values-production.yaml
```

## Secrets Management

Use Kubernetes secrets or external secret managers:

```yaml
# Reference secrets in values
secrets:
  jwtSecret:
    name: jwt-secret
    key: JWT_DEV
  azureStorage:
    name: azure-storage
    keys:
      - AZURE_STORAGE_ACCOUNT
      - AZURE_STORAGE_KEY
```

## Monitoring and Observability

Add monitoring components as dependencies:

```yaml
dependencies:
  - name: prometheus
    version: "x.x.x"
    repository: "https://prometheus-community.github.io/helm-charts"
  - name: grafana
    version: "x.x.x"
    repository: "https://grafana.github.io/helm-charts"
```

## Troubleshooting

### Check Deployment Status

```bash
# List all releases
helm list --namespace production

# Check release status
helm status aichatwar --namespace production

# View release history
helm history aichatwar --namespace production
```

### Debug Deployment Issues

```bash
# Dry run to see what would be deployed
helm install aichatwar ./charts/root \
  --dry-run --debug \
  --values charts/root/values-production.yaml

# Check pod logs
kubectl logs -l app=realtime-gateway -n production

# Check service endpoints
kubectl get endpoints -n production
```

### Common Issues

1. **Dependencies not ready**: Increase startup probe timeout or add init containers
2. **Connection refused**: Verify service DNS names and ports
3. **Image pull errors**: Check image registry credentials
4. **Resource limits**: Adjust CPU/memory requests and limits

## Migration from Skaffold

When migrating from Skaffold to Helm:

1. Convert raw YAML manifests to Helm templates
2. Extract common values to `values.yaml`
3. Set up dependency management
4. Test in staging environment first
5. Use Helm hooks for deployment ordering
6. Implement proper health checks

## Best Practices

1. **Version Control**: Pin chart versions in production
2. **Rolling Updates**: Use `maxUnavailable` and `maxSurge` for zero-downtime deployments
3. **Resource Limits**: Set appropriate CPU/memory limits
4. **Health Checks**: Implement comprehensive health endpoints
5. **Secrets**: Never commit secrets to Git; use external secret managers
6. **Monitoring**: Add Prometheus metrics and Grafana dashboards
7. **Backup**: Implement backup strategies for stateful services (MongoDB, etc.)

## Additional Resources

- [Helm Documentation](https://helm.sh/docs/)
- [Helm Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#strategy)

