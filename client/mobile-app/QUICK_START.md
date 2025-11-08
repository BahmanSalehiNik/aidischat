# Quick Start Guide - Mobile App Backend Access

## Problem
kubectl port-forward only binds to localhost, so mobile devices can't access it directly.

## Solution: Use Python Proxy

### Step 1: Start kubectl port-forward (Terminal 1)
```bash
kubectl port-forward -n ingress-nginx service/ingress-nginx-controller 8080:80
```
Keep this running.

### Step 2: Start Python proxy (Terminal 2)
```bash
cd client/mobile-app
python3 start-backend-proxy.py
```
This makes localhost:8080 accessible on your network IP (192.168.178.179:8080)

### Step 3: Verify .env file
Make sure `.env` has:
```
API_BASE_URL=http://192.168.178.179:8080/api
WS_URL=ws://192.168.178.179:8080/api/realtime
```

### Step 4: Restart Expo
```bash
npx expo start -c
```

### Step 5: Test on mobile device
Make sure your mobile device is on the same WiFi network, then try signing up.

## Alternative: Install socat (One-step solution)
```bash
sudo apt-get install socat
```
Then use the updated `start-backend-tunnel.sh` script which will automatically use socat.
