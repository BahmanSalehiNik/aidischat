#!/bin/bash
# Script to update Azure Storage secret in Kubernetes
# Usage: ./update-azure-storage-secret.sh <account-name> <account-key> [--dry-run]

set -e

DRY_RUN=false
if [[ "$*" == *"--dry-run"* ]]; then
    DRY_RUN=true
fi

# Check if arguments are provided
if [ $# -lt 2 ] || ([ $# -eq 3 ] && [ "$3" != "--dry-run" ]); then
    echo "Usage: $0 <azure-storage-account> <azure-storage-key> [--dry-run]"
    echo ""
    echo "Example:"
    echo "  $0 disorbitmediastorageacct 'your-key-here'"
    echo "  $0 disorbitmediastorageacct 'your-key-here' --dry-run"
    exit 1
fi

AZURE_STORAGE_ACCOUNT=$1
AZURE_STORAGE_KEY=$2

echo "=== Azure Storage Secret Update ==="
echo "Account: $AZURE_STORAGE_ACCOUNT"
echo "Key: ${AZURE_STORAGE_KEY:0:10}... (hidden)"
echo "Dry-run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "🔍 DRY-RUN MODE - No changes will be made"
    echo ""
    echo "Would execute:"
    echo "  1. kubectl delete secret azure-storage"
    echo "  2. kubectl create secret generic azure-storage \\"
    echo "     --from-literal=AZURE_STORAGE_ACCOUNT=\"$AZURE_STORAGE_ACCOUNT\" \\"
    echo "     --from-literal=AZURE_STORAGE_KEY=\"$AZURE_STORAGE_KEY\""
    echo ""
    echo "After update, would restart:"
    echo "  kubectl rollout restart deployment/ar-avatar-depl"
    echo "  kubectl rollout restart deployment/agent-manager-depl"
    echo "  kubectl rollout restart deployment/media-depl"
else
    echo "⚠️  This will update the secret. Press Ctrl+C to cancel..."
    sleep 2
    
    # Delete existing secret if it exists
    if kubectl get secret azure-storage &>/dev/null; then
        echo "Deleting existing secret..."
        kubectl delete secret azure-storage
    else
        echo "No existing secret found."
    fi
    
    # Create new secret
    echo "Creating new secret..."
    kubectl create secret generic azure-storage \
      --from-literal=AZURE_STORAGE_ACCOUNT="$AZURE_STORAGE_ACCOUNT" \
      --from-literal=AZURE_STORAGE_KEY="$AZURE_STORAGE_KEY"
    
    if [ $? -eq 0 ]; then
        echo "✅ Secret updated successfully!"
        echo ""
        echo "To restart pods:"
        echo "  kubectl rollout restart deployment/ar-avatar-depl"
        echo "  kubectl rollout restart deployment/agent-manager-depl"
        echo "  kubectl rollout restart deployment/media-depl"
    else
        echo "❌ Failed to update secret"
        exit 1
    fi
fi
