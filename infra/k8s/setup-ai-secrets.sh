#!/bin/bash

# setup-ai-secrets.sh
# Creates or updates the ai-provider-secrets Kubernetes secret using local environment variables.

set -euo pipefail

NAMESPACE="${NAMESPACE:-default}"
SECRET_NAME="${SECRET_NAME:-ai-provider-secrets}"

if [[ -z "${OPENAI_API_KEY:-}" || -z "${ANTHROPIC_API_KEY:-}" || -z "${COHERE_API_KEY:-}" ]]; then
  echo "Error: OPENAI_API_KEY, ANTHROPIC_API_KEY, and COHERE_API_KEY environment variables must be set."
  exit 1
fi

echo "Creating/updating secret '${SECRET_NAME}' in namespace '${NAMESPACE}'..."

# Delete secret if it exists (ignore errors if it doesn't)
kubectl delete secret "${SECRET_NAME}" --namespace="${NAMESPACE}" 2>/dev/null || true

# Create the secret
kubectl create secret generic "${SECRET_NAME}" \
  --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  --from-literal=COHERE_API_KEY="${COHERE_API_KEY}" \
  --namespace="${NAMESPACE}"

echo "Secret '${SECRET_NAME}' created/updated successfully."

