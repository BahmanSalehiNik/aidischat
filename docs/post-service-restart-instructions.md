# Post Service Restart Instructions

## Issue Summary

After adding comment and reaction routes, the post service needs to be restarted to pick up the changes.

**Error seen**: `connect ECONNREFUSED 10.103.176.53:3000` - Post service not accessible

## Fixes Applied

1. ✅ Created reaction routes (addPostReaction, deletePostReaction, addCommentReaction, deleteCommentReaction)
2. ✅ Added reaction events to shared package (ReactionCreatedEvent, ReactionDeletedEvent)
3. ✅ Registered all routes in post service app.ts
4. ✅ Rebuilt shared package (v1.0.114)
5. ✅ Fixed TypeScript compilation errors

## Steps to Fix

### Option 1: Restart Post Service Pod (Kubernetes)

```bash
# Restart the post service deployment
kubectl rollout restart deployment/post-depl

# Or delete the pod to force recreation
kubectl delete pod -l app=post

# Check if pod is running
kubectl get pods -l app=post

# Check pod logs for errors
kubectl logs -l app=post --tail=50
```

### Option 2: Rebuild and Redeploy (If using Docker images)

```bash
# Build new post service image
cd backEnd/post
docker build -t bahmansalehinic4/post:latest .

# Push to registry
docker push bahmansalehinic4/post:latest

# Restart deployment
kubectl rollout restart deployment/post-depl
```

### Option 3: Local Development

```bash
# Stop the post service if running
# Then restart it
cd backEnd/post
npm start
```

## iPhone Expo Dev Server Issue

**Error**: "the internet connection appears to be offline exp://192.168.178.179:8081"

### Fixes:

1. **Check Expo Dev Server is Running**:
   ```bash
   cd client/mobile-app
   npx expo start
   ```

2. **Ensure Same Network**:
   - iPhone and development machine must be on same WiFi network
   - Check IP address matches (192.168.178.179)

3. **Try Tunnel Mode**:
   ```bash
   npx expo start --tunnel
   ```

4. **Clear Expo Cache**:
   ```bash
   npx expo start --clear
   ```

5. **Check Firewall**:
   - Ensure port 8081 is not blocked
   - Check if antivirus/firewall is blocking Expo

6. **Restart Expo**:
   - Stop Expo (Ctrl+C)
   - Restart: `npx expo start`

## Verification

After restarting post service, test:

1. **Check API Gateway can reach post service**:
   ```bash
   kubectl exec -it <api-gateway-pod> -- curl http://post-srv:3000/health
   ```

2. **Test reaction endpoint** (from mobile app):
   - Try adding a reaction to a post
   - Should work without 502 error

3. **Check post service logs**:
   ```bash
   kubectl logs -l app=post --tail=100 -f
   ```

## Expected Behavior After Fix

- ✅ Post service starts without errors
- ✅ API Gateway can proxy requests to post service
- ✅ Mobile app can create/update/delete comments
- ✅ Mobile app can add/remove reactions
- ✅ Mobile app can update/delete posts

