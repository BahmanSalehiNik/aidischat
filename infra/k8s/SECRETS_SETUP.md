# Kubernetes Secrets Setup Guide

## Creating Secrets for AI Gateway API Keys

The AI Gateway deployment expects a secret named `ai-provider-secrets` with the following keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `COHERE_API_KEY`

## Method 1: Using kubectl create secret (Recommended)

### Create the secret from literal values:

```bash
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='your-openai-api-key-here' \
  --from-literal=ANTHROPIC_API_KEY='your-anthropic-api-key-here' \
  --from-literal=COHERE_API_KEY='your-cohere-api-key-here' \
  --namespace=default
```

### Or create from environment variables:

```bash
export OPENAI_API_KEY='your-openai-api-key-here'
export ANTHROPIC_API_KEY='your-anthropic-api-key-here'
export COHERE_API_KEY='your-cohere-api-key-here'

kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=COHERE_API_KEY="$COHERE_API_KEY" \
  --namespace=default
```

## Method 2: Using kubectl create secret from file

### Create files with your API keys:

```bash
# Create temporary files (be careful - these contain secrets!)
echo -n 'your-openai-api-key-here' > /tmp/openai-key.txt
echo -n 'your-anthropic-api-key-here' > /tmp/anthropic-key.txt
echo -n 'your-cohere-api-key-here' > /tmp/cohere-key.txt

# Create secret from files
kubectl create secret generic ai-provider-secrets \
  --from-file=OPENAI_API_KEY=/tmp/openai-key.txt \
  --from-file=ANTHROPIC_API_KEY=/tmp/anthropic-key.txt \
  --from-file=COHERE_API_KEY=/tmp/cohere-key.txt \
  --namespace=default

# Clean up temporary files
rm /tmp/openai-key.txt /tmp/anthropic-key.txt /tmp/cohere-key.txt
```

## Method 3: Using a YAML manifest (for GitOps/IaC)

Create a file `ai-provider-secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-provider-secrets
  namespace: default
type: Opaque
stringData:
  OPENAI_API_KEY: "your-openai-api-key-here"
  ANTHROPIC_API_KEY: "your-anthropic-api-key-here"
  COHERE_API_KEY: "your-cohere-api-key-here"
```

Then apply it:
```bash
kubectl apply -f ai-provider-secrets.yaml
```

**Note:** For production, use `data` with base64-encoded values instead of `stringData`:

```bash
# Encode your keys
echo -n 'your-openai-api-key-here' | base64
echo -n 'your-anthropic-api-key-here' | base64

# Use the encoded values in the YAML
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-provider-secrets
  namespace: default
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-value>
  ANTHROPIC_API_KEY: <base64-encoded-value>
  COHERE_API_KEY: <base64-encoded-value>
```

## Updating Existing Secrets

### Update a secret value:

```bash
# Delete existing secret and recreate with new values
kubectl delete secret ai-provider-secrets 2>/dev/null || true

kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY='new-openai-key' \
  --from-literal=ANTHROPIC_API_KEY='existing-anthropic-key' \
  --from-literal=COHERE_API_KEY='existing-cohere-key'

# Or update just one key using patch
kubectl patch secret ai-provider-secrets -p '{"data":{"OPENAI_API_KEY":"'$(echo -n 'new-key' | base64)'"}}'
# Example for Cohere:
kubectl patch secret ai-provider-secrets -p '{"data":{"COHERE_API_KEY":"'$(echo -n 'new-cohere-key' | base64)'"}}'
```

## Verifying Secrets

### Check if secret exists:

```bash
kubectl get secret ai-provider-secrets
```

### View secret (values will be base64 encoded):

```bash
kubectl get secret ai-provider-secrets -o yaml
```

### Decode and view secret values:

```bash
# View OpenAI key
kubectl get secret ai-provider-secrets -o jsonpath='{.data.OPENAI_API_KEY}' | base64 -d && echo

# View Anthropic key
kubectl get secret ai-provider-secrets -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 -d && echo

# View Cohere key
kubectl get secret ai-provider-secrets -o jsonpath='{.data.COHERE_API_KEY}' | base64 -d && echo
```

## Deleting Secrets

```bash
kubectl delete secret ai-provider-secrets
```

## Security Best Practices

1. **Never commit secrets to Git** - Use secret management tools or CI/CD secret injection
2. **Use namespaces** - Create secrets in specific namespaces for better isolation
3. **Rotate regularly** - Update API keys periodically
4. **Use RBAC** - Limit who can access secrets
5. **Consider external secret managers** - For production, use tools like:
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

## Example: Complete Setup Script

```bash
#!/bin/bash
# setup-ai-secrets.sh

# Check if keys are provided
if [ -z "$OPENAI_API_KEY" ] || [ -z "$ANTHROPIC_API_KEY" ] || [ -z "$COHERE_API_KEY" ]; then
  echo "Error: OPENAI_API_KEY, ANTHROPIC_API_KEY, and COHERE_API_KEY environment variables must be set"
  exit 1
fi

# Delete existing secret if it exists
kubectl delete secret ai-provider-secrets 2>/dev/null || true

# Create the secret
kubectl create secret generic ai-provider-secrets \
  --from-literal=OPENAI_API_KEY="$OPENAI_API_KEY" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=COHERE_API_KEY="$COHERE_API_KEY"

echo "Secret 'ai-provider-secrets' created/updated successfully"
```

Usage (from repo root):
```bash
export OPENAI_API_KEY='sk-...'
export ANTHROPIC_API_KEY='sk-ant-...'
export COHERE_API_KEY='sk-cohere-...'
bash infra/k8s/setup-ai-secrets.sh
```

