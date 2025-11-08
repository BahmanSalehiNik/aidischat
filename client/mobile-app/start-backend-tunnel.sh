#!/bin/bash
# Script to forward ingress controller for mobile app development
# This preserves the Host header needed for ingress routing

# Get local IP address
LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7}' | head -1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "Starting port forward for ingress controller..."
echo "Local IP: $LOCAL_IP"
echo "Access backend at: http://$LOCAL_IP:8080"
echo ""
echo "Make sure your .env file uses:"
echo "API_BASE_URL=http://$LOCAL_IP:8080/api"
echo "WS_URL=ws://$LOCAL_IP:8080/api/realtime"
echo ""
echo "Press Ctrl+C to stop"

# Use socat to forward localhost:8080 to network interface if available
# Otherwise, kubectl port-forward to localhost and use a workaround
if command -v socat &> /dev/null; then
    echo "Using socat to forward to network interface..."
    kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 127.0.0.1:8080:80 &
    KUBECTL_PID=$!
    sleep 2
    socat TCP-LISTEN:8080,bind=$LOCAL_IP,reuseaddr,fork TCP:127.0.0.1:8080
    kill $KUBECTL_PID 2>/dev/null
else
    echo "Note: kubectl port-forward only binds to localhost."
    echo "For mobile access, you may need to:"
    echo "1. Install socat: sudo apt-get install socat"
    echo "2. Or use SSH port forwarding"
    echo "3. Or use a tunnel service like ngrok"
    echo ""
    echo "Starting port-forward on localhost:8080..."
    kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
fi
