# Secrets: Required vs Dummy Values

## Summary: 4 Secrets Total

### 1. `jwt-secret` - **REQUIRED** (Real value needed)
- **Key**: `JWT_DEV`
- **Used by**: Almost all services (auth, user, post, chat, etc.)
- **Can be dummy?**: Yes, for dev (use any string like `'dev-secret-key'`)
- **Why**: Used to sign/verify JWT tokens

```bash
kubectl create secret generic jwt-secret \
  --from-literal=JWT_DEV='dev-secret-key'
```

### 2. `azure-storage` - **REQUIRED** (Secret must exist)
- **Keys**: `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`
- **Used by**: `agent-manager`, `ar-avatar`, `media`
- **Can be dummy?**: Yes, for dev (use dummy values)
- **Why**: Required by deployments (not marked optional)

```bash
kubectl create secret generic azure-storage \
  --from-literal=AZURE_STORAGE_ACCOUNT='dev-account' \
  --from-literal=AZURE_STORAGE_KEY='dev-key'
```

### 3. `ai-provider-secrets` - **Secret must exist** (Keys can be dummy)
- **Keys**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`
- **Used by**: `ai-gateway` (all keys optional: true), `ar-avatar` (OPENAI_API_KEY optional: true)
- **Can be dummy?**: Yes, all keys can be dummy if not using those providers
- **Why**: Secret is referenced, but keys are marked `optional: true`

```bash
# If not using AI features, all can be dummy:
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='dummy-openai-key' \
  --from-literal=ANTHROPIC_API_KEY='dummy-anthropic-key' \
  --from-literal=COHERE_API_KEY='dummy-cohere-key'

# If using OpenAI (for AR avatar or AI gateway):
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='your-real-openai-key' \
  --from-literal=ANTHROPIC_API_KEY='dummy-anthropic-key' \
  --from-literal=COHERE_API_KEY='dummy-cohere-key'
```

### 4. `ar-avatar-secrets` - **Secret must exist** (Keys can be dummy)
- **Keys**: `ready-player-me-api-key`, `ready-player-me-app-id`, `meshy-api-key`, `google-tts-api-key`, `azure-tts-key`
- **Used by**: `ar-avatar`
- **Can be dummy?**: Yes, all keys are `optional: true`, but secret must exist
- **Why**: Secret is referenced, but all keys are optional

```bash
# If not using AR avatar features, all can be dummy:
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='dummy' \
  --from-literal=ready-player-me-app-id='dummy' \
  --from-literal=meshy-api-key='dummy' \
  --from-literal=google-tts-api-key='dummy' \
  --from-literal=azure-tts-key='dummy'

# If using AR avatar, only Ready Player Me is actually required:
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='your-real-key' \
  --from-literal=ready-player-me-app-id='your-real-app-id' \
  --from-literal=meshy-api-key='dummy' \
  --from-literal=google-tts-api-key='dummy' \
  --from-literal=azure-tts-key='dummy'
```

## Quick Setup (All Dummy - For Development)

```bash
# 1. JWT Secret (required - but can be dummy for dev)
kubectl create secret generic jwt-secret \
  --from-literal=JWT_DEV='dev-secret-key'

# 2. Azure Storage (required - but can be dummy for dev)
kubectl create secret generic azure-storage \
  --from-literal=AZURE_STORAGE_ACCOUNT='dev-account' \
  --from-literal=AZURE_STORAGE_KEY='dev-key'

# 3. AI Provider Secrets (secret must exist, keys can be dummy)
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='dummy-openai' \
  --from-literal=ANTHROPIC_API_KEY='dummy-anthropic' \
  --from-literal=COHERE_API_KEY='dummy-cohere'

# 4. AR Avatar Secrets (secret must exist, keys can be dummy)
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='dummy' \
  --from-literal=ready-player-me-app-id='dummy' \
  --from-literal=meshy-api-key='dummy' \
  --from-literal=google-tts-api-key='dummy' \
  --from-literal=azure-tts-key='dummy'
```

## Why Secrets Must Exist Even If Keys Are Dummy

Even if keys are marked `optional: true`, **the secret itself must exist** in Kubernetes. If the secret doesn't exist, pods will fail to start with "secret not found" errors.

## Real Values Needed For:

- **JWT_DEV**: Any string works for dev, but should be a real secret in production
- **Azure Storage**: Only needed if using agent-manager or ar-avatar features that upload files
- **OPENAI_API_KEY**: Only needed if using AI features (AR avatar, AI gateway)
- **Ready Player Me keys**: Only needed if using AR avatar 3D model generation

## Summary Table

| Secret | Must Exist? | Keys Can Be Dummy? | Notes |
|--------|-------------|-------------------|-------|
| `jwt-secret` | ✅ Yes | ✅ Yes (for dev) | Required by most services |
| `azure-storage` | ✅ Yes | ✅ Yes (for dev) | Required by agent-manager, ar-avatar |
| `ai-provider-secrets` | ✅ Yes | ✅ Yes (if not using AI) | Keys are optional, but secret must exist |
| `ar-avatar-secrets` | ✅ Yes | ✅ Yes (if not using AR) | All keys optional, but secret must exist |

**Total: 4 secrets, all can use dummy values for development**





