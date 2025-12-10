# Phase 1 Testing Instructions

## Overview

This guide helps you test the AR Avatar Service Phase 1 implementation by creating an agent and verifying that a 3D model is generated.

## Prerequisites

1. **Kubernetes cluster running** (via Skaffold or manual deployment)
2. **Secrets configured** (see `infra/k8s/ar-avatar-secrets-setup.md`)
3. **Services deployed**:
   - AR Avatar Service
   - AR Avatar MongoDB
   - API Gateway
   - Agent Service (for creating agents)

## Step 1: Verify Services Are Running

```bash
# Check AR Avatar Service
kubectl get pods -l app=ar-avatar
kubectl logs -f deployment/ar-avatar-depl

# Check MongoDB
kubectl get pods -l app=ar-avatar-mongo
kubectl logs -f deployment/ar-avatar-mongo-depl

# Check API Gateway
kubectl get pods -l app=api-gateway
```

## Step 2: Test Health Endpoints

```bash
# Test AR Avatar Service health (direct)
kubectl port-forward deployment/ar-avatar-depl 3000:3000
curl http://localhost:3000/health

# Test via API Gateway
kubectl port-forward deployment/api-gateway-depl 3000:3000
curl http://localhost:3000/api-gateway/healthz
```

## Step 3: Create an Agent

The AR Avatar Service listens to `AgentIngestedEvent` from Kafka. When an agent is created, it should automatically trigger avatar generation.

### Option A: Create Agent via API

```bash
# Port forward API Gateway
kubectl port-forward deployment/api-gateway-depl 3000:3000

# Create an agent (adjust the profile as needed)
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Avatar Agent",
    "displayName": "Test Avatar",
    "character": {
      "name": "Test Avatar Agent",
      "gender": "female",
      "hairColor": "brown",
      "eyeColor": "blue",
      "personality": ["friendly", "energetic"],
      "interests": ["technology", "gaming"]
    },
    "profile": {
      "age": 25,
      "profession": "AI Assistant",
      "role": "helper"
    }
  }'
```

**Note**: The exact endpoint and payload format depends on your Agent Service API. Adjust accordingly.

### Option B: Check Existing Agents

```bash
# List agents
curl http://localhost:3000/api/agents

# Get specific agent
curl http://localhost:3000/api/agents/{agentId}
```

## Step 4: Check Avatar Generation Status

After creating an agent, the `AgentIngestedListener` should trigger avatar generation automatically.

```bash
# Check if avatar generation started (replace {agentId} with actual agent ID)
curl http://localhost:3000/api/avatars/{agentId}/status

# Expected response:
# {
#   "status": "generating",
#   "progress": 50
# }
```

## Step 5: Manually Trigger Avatar Generation (Alternative)

If automatic generation didn't trigger, you can manually start it:

```bash
curl -X POST http://localhost:3000/api/avatars/generate \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "your-agent-id",
    "agentProfile": {
      "name": "Test Avatar Agent",
      "gender": "female",
      "hairColor": "brown",
      "eyeColor": "blue",
      "personality": ["friendly"],
      "interests": ["technology"]
    }
  }'
```

## Step 6: Monitor Generation Progress

```bash
# Check status periodically
watch -n 2 'curl -s http://localhost:3000/api/avatars/{agentId}/status | jq'

# Or check logs
kubectl logs -f deployment/ar-avatar-depl | grep -i "avatar\|model\|generation"
```

## Step 7: Verify Avatar Was Created

```bash
# Get avatar details
curl http://localhost:3000/api/avatars/{agentId}

# Expected response:
# {
#   "agentId": "...",
#   "status": "ready",
#   "modelUrl": "https://cdn.example.com/avatars/...",
#   "format": "glb",
#   "modelType": "3d",
#   "provider": "rpm",
#   ...
# }
```

## Step 8: Check MongoDB

```bash
# Connect to MongoDB
kubectl exec -it deployment/ar-avatar-mongo-depl -- mongosh ar-avatar

# In MongoDB shell:
use ar-avatar
db.avatars.find().pretty()

# Check specific avatar
db.avatars.findOne({ agentId: "your-agent-id" })
```

## Troubleshooting

### Avatar Status Stuck on "generating"

1. **Check logs**:
   ```bash
   kubectl logs -f deployment/ar-avatar-depl
   ```

2. **Check for errors**:
   - API key issues (Ready Player Me, Meshy, LLM)
   - Network connectivity issues
   - Provider API errors

3. **Verify secrets**:
   ```bash
   kubectl get secret ar-avatar-secrets
   kubectl describe secret ar-avatar-secrets
   ```

### Avatar Status is "failed"

1. **Check error message**:
   ```bash
   curl http://localhost:3000/api/avatars/{agentId} | jq '.generationError'
   ```

2. **Common issues**:
   - Invalid API keys
   - Provider API rate limits
   - Network timeouts
   - Invalid character description

### AgentIngestedEvent Not Triggering

1. **Check Kafka connectivity**:
   ```bash
   kubectl logs deployment/ar-avatar-depl | grep -i kafka
   ```

2. **Verify event was published**:
   - Check Agent Service logs
   - Check Kafka topics

3. **Check listener is running**:
   ```bash
   kubectl logs deployment/ar-avatar-depl | grep -i "AgentIngestedListener"
   ```

### API Gateway Not Routing

1. **Verify route configuration**:
   ```bash
   kubectl exec deployment/api-gateway-depl -- cat /app/src/config/routes.ts | grep -i avatar
   ```

2. **Check environment variable**:
   ```bash
   kubectl exec deployment/api-gateway-depl -- env | grep AR_AVATAR
   ```

3. **Test direct service**:
   ```bash
   kubectl port-forward deployment/ar-avatar-depl 3000:3000
   curl http://localhost:3000/api/avatars/{agentId}
   ```

## Expected Flow

```
1. Create Agent
   ↓
2. AgentIngestedEvent published to Kafka
   ↓
3. AR Avatar Service receives event
   ↓
4. Character description generated (LLM)
   ↓
5. 3D model generated (Ready Player Me / Meshy)
   ↓
6. Model downloaded and stored
   ↓
7. Avatar status = "ready"
   ↓
8. Model URL available in avatar record
```

## Success Criteria

✅ Agent created successfully  
✅ AgentIngestedEvent received by AR Avatar Service  
✅ Avatar generation started (status = "generating")  
✅ Character description generated  
✅ 3D model generated (may take 30-60 seconds)  
✅ Model stored and URL available  
✅ Avatar status = "ready"  
✅ Model URL is accessible  

## Next Steps After Testing

1. **Verify model file**:
   - Download model from CDN URL
   - Verify it's a valid GLB file
   - Test loading in a 3D viewer

2. **Test TTS** (if implemented):
   ```bash
   curl -X POST http://localhost:3000/api/tts/generate \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Hello, I am a test avatar",
       "voiceId": "test-voice",
       "language": "en"
     }'
   ```

3. **Test with different agent profiles**:
   - Different genders
   - Different styles (anime vs 3D)
   - Different providers (Ready Player Me vs Meshy)

## Notes

- Model generation can take 30-60 seconds
- Provider APIs may have rate limits
- Check provider dashboards for usage/quota
- Storage service is placeholder - model URLs may not be accessible until storage is implemented

