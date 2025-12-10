# AR Avatar Service - Secrets Setup

The AR Avatar service requires several API keys to be configured as Kubernetes secrets.

## Required Secrets

Create a Kubernetes secret named `ar-avatar-secrets` with the following keys:

```bash
kubectl create secret generic ar-avatar-secrets \
  --from-literal=ready-player-me-api-key='YOUR_READY_PLAYER_ME_API_KEY' \
  --from-literal=meshy-api-key='YOUR_MESHY_API_KEY' \
  --from-literal=llm-api-key='YOUR_LLM_API_KEY' \
  --from-literal=openai-api-key='YOUR_OPENAI_API_KEY' \
  --from-literal=google-tts-api-key='YOUR_GOOGLE_TTS_API_KEY' \
  --from-literal=azure-tts-key='YOUR_AZURE_TTS_KEY'
```

## Optional Secrets

Some secrets are marked as optional in the deployment:
- `google-tts-api-key` - Only needed if using Google Cloud TTS
- `azure-tts-key` - Only needed if using Azure TTS

## Minimum Required Secrets

For basic functionality, you need at minimum:
- `ready-player-me-api-key` - For 3D model generation (default provider)
- `llm-api-key` - For character description generation (OpenAI/Claude)
- `openai-api-key` - For TTS generation (if using OpenAI TTS)

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

## Verify Secrets

To verify the secrets are created:

```bash
kubectl get secret ar-avatar-secrets
kubectl describe secret ar-avatar-secrets
```

## Notes

- Secrets are namespace-scoped. Make sure you create them in the correct namespace.
- The service will fail to start if required secrets are missing.
- Optional secrets can be omitted if you're not using those providers.

