# Skaffold Performance Optimization

Skaffold can be slow when deploying many services due to Kubernetes API throttling. Here are ways to speed it up:

## Quick Fix: Skip Status Checks

For faster deployment (doesn't wait for pods to be ready):

```bash
skaffold run --status-check=false
```

Or:

```bash
skaffold deploy --status-check=false
```

## Optimizations Already Applied

1. **Server-side apply**: Uses `--server-side=true` for faster manifest application
2. **Reduced request timeout**: 30s timeout to fail faster instead of hanging

## Additional Speed Improvements

### 1. Deploy Without Waiting

```bash
skaffold deploy --status-check=false --wait=false
```

### 2. Use Profiles for Selective Deployment

Create profiles in `skaffold.yaml` to deploy only what you need:

```yaml
profiles:
  - name: core-services
    manifests:
      rawYaml:
        - ./infra/k8s/user*.yaml
        - ./infra/k8s/post-depl.yaml
```

Then deploy with:
```bash
skaffold run -p core-services
```

### 3. Increase Kubernetes API Rate Limits

If you have access to kubeconfig, you can increase rate limits, but this requires cluster admin access.

### 4. Deploy in Batches

Instead of deploying everything at once, deploy in phases:

```bash
# Phase 1: Infrastructure
skaffold deploy -f skaffold-infra.yaml

# Phase 2: Services
skaffold deploy -f skaffold-services.yaml
```

## Why It's Slow

- **45+ deployments**: Each deployment requires multiple API calls
- **Status checks**: Skaffold polls each deployment until ready
- **API throttling**: Kubernetes API server rate-limits requests
- **Sequential checks**: Status checks happen sequentially, not in parallel

## Recommended Workflow

For development, use:

```bash
# Fast: Deploy without waiting
skaffold deploy --status-check=false

# Then check status manually
kubectl get deployments
kubectl get pods
```

For production, use full status checks:

```bash
skaffold run  # Includes status checks
```



