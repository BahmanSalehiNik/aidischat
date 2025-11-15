#!/bin/bash
# Simple wrapper script to start all backend access components
# This calls start-backend-tunnel.sh which handles:
# 1. kubectl port-forward (forwards ingress to localhost:8080)
# 2. socat (forwards localhost:8080 to network IP:8080)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Starting Backend Tunnel"
echo "=========================================="
echo ""
echo "This will start:"
echo "  1. kubectl port-forward"
echo "  2. socat proxy"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Stop any existing processes first
echo "Cleaning up any existing processes..."
pkill -f "kubectl.*port-forward.*ingress-nginx-controller.*8080" 2>/dev/null || true
pkill -f "socat.*TCP-LISTEN:8080" 2>/dev/null || true
sleep 1

# Call the tunnel script (it handles both kubectl and socat)
./start-backend-tunnel.sh

