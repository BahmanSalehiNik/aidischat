# AR Avatar Service - Secrets Setup

The AR Avatar service requires API keys from two Kubernetes secrets:

1. **`ar-avatar-secrets`** - For 3D provider API keys (Ready Player Me, Meshy)
2. **`ai-provider-secrets`** - For LLM and TTS API keys (shared with AI Gateway)

## 1. AR Avatar Secrets (3D Providers)

Create a Kubernetes secret named `ar-avatar-secrets` with 3D provider API keys:

### For Production/Real Testing:
```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='YOUR_READY_PLAYER_ME_API_KEY' \
  --from-literal=ready-player-me-app-id='YOUR_READY_PLAYER_ME_APP_ID' \
  --from-literal=meshy-api-key='YOUR_MESHY_API_KEY' \
  --from-literal=google-tts-api-key='YOUR_GOOGLE_TTS_API_KEY' \
  --from-literal=azure-tts-key='YOUR_AZURE_TTS_KEY'
```

### For Development/Testing (with dummy tokens):
```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='YOUR_READY_PLAYER_ME_API_KEY' \
  --from-literal=ready-player-me-app-id='YOUR_READY_PLAYER_ME_APP_ID' \
  --from-literal=meshy-api-key='dummy-meshy-token-for-testing' \
  --from-literal=google-tts-api-key='dummy-google-tts-token' \
  --from-literal=azure-tts-key='dummy-azure-tts-token'
```

### Required Keys:
- **`ready-player-me-api-key`** - **REQUIRED** - For 3D model generation (default provider)
  - Get your API key from: https://readyplayer.me/developers
  - This is the only real API key needed for current testing
- **`ready-player-me-app-id`** - **REQUIRED** - Application ID for Ready Player Me API
  - Get your Application ID from Ready Player Me Studio (your application page)
  - Required for API authentication

### Optional Keys (can use dummy tokens for testing):
- **`meshy-api-key`** - Optional - For alternative 3D model generation
  - Currently not actively used, can use dummy token: `dummy-meshy-token-for-testing`
  - Get your API key from: https://www.meshy.ai/ when ready to use
- **`google-tts-api-key`** - Optional - Only needed if using Google Cloud TTS
  - Can use dummy token: `dummy-google-tts-token` for testing
- **`azure-tts-key`** - Optional - Only needed if using Azure TTS
  - Can use dummy token: `dummy-azure-tts-token` for testing

## 2. AI Provider Secrets (Shared with AI Gateway)

The service uses the shared `ai-provider-secrets` for LLM and TTS. If you've already set up AI Gateway, this secret should already exist.

```bash
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='YOUR_OPENAI_API_KEY' \
  --from-literal=ANTHROPIC_API_KEY='YOUR_ANTHROPIC_API_KEY' \
  --from-literal=COHERE_API_KEY='YOUR_COHERE_API_KEY'
```

### Required for AR Avatar:
- **`OPENAI_API_KEY`** - **REQUIRED** - Used for:
  - LLM character description generation
  - TTS generation (if using OpenAI TTS)

**Note:** If `ai-provider-secrets` already exists from AI Gateway setup, you don't need to recreate it.

## Minimum Required Secrets Summary

For basic functionality, you need:
1. **`ar-avatar-secrets`** with:
   - `ready-player-me-api-key` - **REQUIRED** - For 3D model generation
   - `ready-player-me-app-id` - **REQUIRED** - Application ID for Ready Player Me API
   - `meshy-api-key` - Optional (can use dummy token: `dummy-meshy-token-for-testing`)
   - `google-tts-api-key` - Optional (can use dummy token: `dummy-google-tts-token`)
   - `azure-tts-key` - Optional (can use dummy token: `dummy-azure-tts-token`)
2. **`ai-provider-secrets`** with:
   - `OPENAI_API_KEY` - **REQUIRED** - For LLM and TTS

**Note:** Currently only Ready Player Me and OpenAI are actively used. All other keys can use dummy tokens for testing.

## Update Existing Secret

To update an existing secret:

```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='NEW_KEY' \
  --from-literal=meshy-api-key='NEW_KEY' \
  --from-literal=llm-api-key='NEW_KEY' \
  --from-literal=openai-api-key='NEW_KEY' \
  --dry-run=client -o yaml | kubectl apply -f -
```

--from-literal=ready-player-me-app-id="$YOUR_APP_ID"

## Verify Secrets
https://assets.meshy.ai/f0bb784b-ab50-49d3-8c63-d93c3cd2ab3f/tasks/019b0f71-d54c-7b34-b41f-e10e8a825880/output/model.glb?Expires=4919011200&Signature=qA59B4OQPceOphMGl5ccm7zJ8EVrzRpCDmGrnYj~SFvJqqnyzAVblAEHg2cIDeccc7CDewFkItAhEtDTg7zWXfXmInAZwJnpO8Tq55oBl95-zfXInoOHoelcwObFSc1J6Ctjw7~J4RvSMMu0ue-RDXHZ9h~paTL1ikthpr~ihm7JoyZL-R9g4EOQG9JlHtoP6~sNxY43gyB5vQJVgQHVLK4s~~mI~OZH2vRSj4qvIzQ51IMNepDGGzRDm0E6vkDF3Qyj~EWcTbnklrtsh39rzcmMbdT41bq71WHvs~1Bf8OLEbE~uP0q9EjzyV0L0Ye7aW~7xI894~TiczPuhM1uRg__&Key-Pair-Id=KL5I0C8H7HX83
To verify the secrets are created:
https://gltf-viewer.donmccurdy.com/
```bash
kubectl get secret ar-avatar-secrets
kubectl describe secret ar-avatar-secrets
```


sk_live_0l-mKbJYjzSItsNK2gubkKvTuOJorHbswBfC
curl -s -X POST https://api.readyplayer.me/v1/avatars -H "Authorization: Bearer sk_live_BpyITuRWg5Xx4Lx-fucTBpj8nJ_f6m1wyMHp" -H "Content-Type: application/json" -d '{"gender":"female","bodyType":"average"}' | jq .

## Notes

- Secrets are namespace-scoped. Make sure you create them in the correct namespace.
- The service will fail to start if required secrets are missing.
- Optional secrets can be omitted if you're not using those providers.

