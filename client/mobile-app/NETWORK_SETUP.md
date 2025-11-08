# Network Setup for Mobile App Development

## Problem
The backend is running on a local Kubernetes cluster (`192.168.49.2`), which your mobile device cannot reach directly.

## Solutions

### Option 1: Use ngrok Tunnel (Recommended for Quick Testing)

1. **Install ngrok:**
   ```bash
   # Download from https://ngrok.com/download
   # Or use package manager
   ```

2. **Start ngrok tunnel:**
   ```bash
   # Forward to your ingress (assuming it's accessible on port 80 or 443 locally)
   ngrok http 80 --host-header=aichatwar-games.com
   # Or if using HTTPS:
   ngrok http 443 --host-header=aichatwar-games.com
   ```

3. **Update .env file:**
   ```env
   API_BASE_URL=https://YOUR_NGROK_URL.ngrok.io/api
   WS_URL=wss://YOUR_NGROK_URL.ngrok.io/api/realtime
   ```

### Option 2: Use kubectl Port Forward

1. **Forward the ingress controller port:**
   ```bash
   kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
   ```

2. **Update .env file:**
   ```env
   API_BASE_URL=http://YOUR_LOCAL_IP:8080/api
   WS_URL=ws://YOUR_LOCAL_IP:8080/api/realtime
   ```
   Replace `YOUR_LOCAL_IP` with your machine's local IP (e.g., `192.168.178.179`)

### Option 3: Use Local Network IP (If on Same WiFi)

1. **Find your machine's local IP:**
   ```bash
   ip route get 8.8.8.8 | awk '{print $7}'
   # Or
   hostname -I | awk '{print $1}'
   ```

2. **Set up port forwarding for ingress:**
   ```bash
   kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 80:80
   ```

3. **Update .env file:**
   ```env
   API_BASE_URL=http://YOUR_LOCAL_IP/api
   WS_URL=ws://YOUR_LOCAL_IP/api/realtime
   ```

### Option 4: Deploy to Public Server

If you have a publicly accessible server, update the .env to point to it:
```env
API_BASE_URL=https://your-public-domain.com/api
WS_URL=wss://your-public-domain.com/api/realtime
```

## Testing Connectivity

After updating .env, test the connection:
1. Restart Expo: `npx expo start -c` (clear cache)
2. Try signing up again
3. Check the console logs for the exact URL being called

## Notes

- For HTTPS with self-signed certificates, you may need to configure the app to accept them (not recommended for production)
- Make sure your mobile device and development machine are on the same WiFi network for local IP solutions
- ngrok free tier has limitations (request limits, random URLs on restart)

