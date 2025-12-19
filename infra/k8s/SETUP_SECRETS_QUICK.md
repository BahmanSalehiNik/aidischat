# Quick Secrets Setup

After cluster reset/recreation, you need to recreate these secrets:

## 1. JWT Secret (Required by most services)

```bash
kubectl create secret generic jwt-secret \
  --from-literal=JWT_DEV='your-jwt-secret-key-here'
```

**For development/testing**, you can use a simple key:
```bash
kubectl create secret generic jwt-secret \
  --from-literal=JWT_DEV='dev-secret-key-change-in-production'
```

## 2. Azure Storage Secret (Required by agent-manager, ar-avatar)

```bash
kubectl create secret generic azure-storage \
  --from-literal=AZURE_STORAGE_ACCOUNT='your-azure-storage-account' \
  --from-literal=AZURE_STORAGE_KEY='your-azure-storage-key'
```

**For development/testing**, you can use dummy values:
```bash
kubectl create secret generic azure-storage \
  --from-literal=AZURE_STORAGE_ACCOUNT='dev-storage-account' \
  --from-literal=AZURE_STORAGE_KEY='dev-storage-key'
```

## 3. AI Provider Secrets (Required by ai-gateway, ar-avatar)

```bash
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='your-openai-key' \
  --from-literal=ANTHROPIC_API_KEY='your-anthropic-key' \
  --from-literal=COHERE_API_KEY='your-cohere-key'
```

Or use the setup script:
```bash
export OPENAI_API_KEY='your-key'
export ANTHROPIC_API_KEY='your-key'
export COHERE_API_KEY='your-key'
bash infra/k8s/setup-ai-secrets.sh
```

## 4. AR Avatar Secrets (Required by ar-avatar)

```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='your-key' \
  --from-literal=ready-player-me-app-id='your-app-id' \
  --from-literal=meshy-api-key='dummy-meshy-token-for-testing' \
  --from-literal=google-tts-api-key='dummy-google-tts-token' \
  --from-literal=azure-tts-key='dummy-azure-tts-token'
```

## Quick Setup (All at Once)

For development, create all with dummy values:

```bash
# JWT Secret
kubectl create secret generic jwt-secret \
  --from-literal=JWT_DEV='dev-secret-key'

# Azure Storage
kubectl create secret generic azure-storage \
  --from-literal=AZURE_STORAGE_ACCOUNT='dev-account' \
  --from-literal=AZURE_STORAGE_KEY='dev-key'

# AI Provider (if you have keys)
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='your-openai-key' \
  --from-literal=ANTHROPIC_API_KEY='your-anthropic-key' \
  --from-literal=COHERE_API_KEY='your-cohere-key'

# AR Avatar (minimal - only Ready Player Me required)
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='your-key' \
  --from-literal=ready-player-me-app-id='your-app-id' \
  --from-literal=meshy-api-key='dummy' \
  --from-literal=google-tts-api-key='dummy' \
  --from-literal=azure-tts-key='dummy'
```

## Verify Secrets

```bash
kubectl get secrets
```

## Why Secrets Disappear

Secrets are stored in Kubernetes etcd. When you:
- Reset/recreate the cluster (e.g., `minikube delete && minikube start`)
- Delete the cluster
- Restore from backup

All secrets are lost and need to be recreated.


