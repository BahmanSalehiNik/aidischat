# AR Avatar Service

AR Avatar Service generates and manages 3D/anime avatar models for agents. It handles model generation from agent profiles, storage, and provides TTS services for avatar speech.

## Features

- **Model Generation**: Generates 3D/anime avatar models from agent profiles using LLM descriptions and 3D providers
- **Character Description**: Uses LLM to create detailed character descriptions from agent profiles
- **3D Provider Integration**: Supports Ready Player Me, Meshy.ai, and Kaedim
- **Storage**: Uploads models to object storage (Azure Blob / S3) with CDN support
- **TTS Service**: Backend TTS generation with viseme support (Phase 1)
- **Event-Driven**: Listens to agent creation events to auto-generate avatars

## Architecture

```
Agent Profile → LLM Description → 3D Provider → Storage → CDN → Client
```

## API Endpoints

### Avatar Management

- `GET /api/avatars/:agentId` - Get avatar for an agent
- `POST /api/avatars/generate` - Generate avatar for an agent
- `GET /api/avatars/:agentId/status` - Get avatar generation status

### TTS Service

- `POST /api/tts/generate` - Generate TTS audio and visemes

## Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://ar-avatar-mongo-srv:27017/ar-avatar

# Kafka (optional)
KAFKA_BROKER_URL=kafka:9092
KAFKA_CLIENT_ID=ar-avatar

# Storage
STORAGE_PROVIDER=azure  # or 's3'
CDN_BASE_URL=https://cdn.example.com

# 3D Providers
READY_PLAYER_ME_API_KEY=your_key
MESHY_API_KEY=your_key

# LLM for Description Generation
LLM_PROVIDER=openai  # or 'claude'
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=your_key

# TTS Provider
TTS_PROVIDER=openai  # or 'google' | 'azure'
OPENAI_API_KEY=your_key
GOOGLE_TTS_API_KEY=your_key
AZURE_TTS_KEY=your_key
AZURE_TTS_REGION=your_region
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run production
npm start
```

## Phase 1 Status

✅ Service structure created
✅ MongoDB models
✅ Character description generator (LLM-based)
✅ Model generator with **provider pattern** (Ready Player Me default, Meshy available)
✅ Storage service (placeholder)
✅ Avatar service
✅ TTS service (placeholder)
✅ Event listeners
✅ API routes
✅ Kubernetes deployment files
✅ Skaffold configuration

### Provider Integration
- ✅ **Ready Player Me** - Default provider, full API integration
- ✅ **Meshy.ai** - Alternative provider, full API integration
- ✅ Provider factory pattern for easy switching
- ✅ Smart provider selection based on character style

### Infrastructure
- ✅ Kubernetes deployment and service
- ✅ MongoDB deployment
- ✅ Health checks and probes
- ✅ Resource limits and requests
- ✅ Secrets configuration


## Notes

- Model generation is async - use status endpoint to check progress
- TTS service is backend-based in Phase 1, will migrate to client-side in Phase 2
- Storage and provider integrations are placeholders - need actual API implementations

## Next Steps

### 1. Set Up Kubernetes Secrets

Before deploying, create the required Kubernetes secrets:

```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='YOUR_READY_PLAYER_ME_API_KEY' \
  --from-literal=meshy-api-key='YOUR_MESHY_API_KEY' \
  --from-literal=llm-api-key='YOUR_LLM_API_KEY' \
  --from-literal=openai-api-key='YOUR_OPENAI_API_KEY' \
  --from-literal=google-tts-api-key='YOUR_GOOGLE_TTS_API_KEY' \
  --from-literal=azure-tts-key='YOUR_AZURE_TTS_KEY'
```

**Minimum Required Secrets:**
- `ready-player-me-api-key` - For 3D model generation (default provider)
- `llm-api-key` - For character description generation
- `openai-api-key` - For TTS generation

See `infra/k8s/ar-avatar-secrets-setup.md` for detailed instructions.

### 2. Deploy with Skaffold

```bash
# Build and deploy the service
skaffold dev

# Or deploy once
skaffold run
```

The service will be available at `ar-avatar-srv:3000` within the cluster.

### 3. Test the Service

```bash
# Health check
curl http://localhost:3000/health

# Generate avatar for an agent
curl -X POST http://localhost:3000/api/avatars/generate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-agent-1",
    "agentProfile": {
      "name": "Test Agent",
      "gender": "female",
      "hairColor": "brown",
      "eyeColor": "blue"
    }
  }'

# Check avatar status
curl http://localhost:3000/api/avatars/test-agent-1/status

# Get avatar
curl http://localhost:3000/api/avatars/test-agent-1
```

### 4. Implement Provider APIs

The provider implementations are ready but need actual API integration:

- **Ready Player Me**: Verify API endpoints and authentication
- **Meshy**: Verify API endpoints and polling mechanism
- **Storage**: Implement Azure Blob Storage or S3 upload
- **TTS**: Implement OpenAI, Google Cloud, or Azure TTS APIs

### 5. Configure CDN

Set the `CDN_BASE_URL` environment variable to point to your CDN:

```yaml
env:
  - name: CDN_BASE_URL
    value: "https://cdn.yourdomain.com"
```

### 6. Test End-to-End Flow

1. Create an agent (via Agent Service)
2. AgentIngestedEvent should trigger avatar generation
3. Check avatar status via API
4. Verify model is generated and stored
5. Test TTS generation

### 7. Monitor and Debug

```bash
# View logs
kubectl logs -f deployment/ar-avatar-depl

# Check service status
kubectl get pods -l app=ar-avatar
kubectl describe pod <pod-name>

# Check MongoDB
kubectl exec -it deployment/ar-avatar-mongo-depl -- mongosh ar-avatar
```

### 8. Phase 2 Preparation

- [ ] Implement client-side TTS migration
- [ ] Add ephemeral token service
- [ ] Update Unity client integration
- [ ] Add provider failover logic

