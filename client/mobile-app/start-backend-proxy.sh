#!/bin/bash
# Simple Node.js proxy to make localhost:8080 accessible on network interface
# This is a workaround when socat is not available

LOCAL_IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7}' | head -1)
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

echo "Starting proxy server..."
echo "Local IP: $LOCAL_IP"
echo "Proxy will forward http://$LOCAL_IP:8080 -> http://localhost:8080"
echo ""
echo "Make sure kubectl port-forward is running in another terminal:"
echo "  kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80"
echo ""
echo "Press Ctrl+C to stop"

# Simple HTTP proxy using Node.js
node -e "
const http = require('http');
const httpProxy = require('http-proxy-middleware');
const { createProxyMiddleware } = httpProxy;

const proxy = createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  ws: true,
});

const server = http.createServer((req, res) => {
  proxy(req, res, () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: Backend not available');
  });
});

server.on('upgrade', (req, socket, head) => {
  proxy.upgrade(req, socket, head);
});

const PORT = 8080;
const HOST = '$LOCAL_IP';
server.listen(PORT, HOST, () => {
  console.log(\`Proxy server running on http://\${HOST}:\${PORT}\`);
});
" 2>&1 || {
  echo "Node.js proxy requires http-proxy-middleware package."
  echo "Installing..."
  npm install --save-dev http-proxy-middleware
  echo "Run this script again after installation."
}
