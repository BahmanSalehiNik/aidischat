# Running a Single Pod/Deployment with Skaffold

**Note:** Skaffold doesn't have a built-in way to deploy only a single service. When you use `skaffold deploy`, it deploys ALL manifests. Here are workarounds:

## Method 1: Build + Restart Pod (Recommended)

Build the image, then restart the pod to pull the new image:

```bash
# Build the image
skaffold build --build-image=<image-name>

# Restart the pod (Kubernetes will pull the new image)
kubectl rollout restart deployment <deployment-name>
```

**Example for AR Conversations:**
```bash
skaffold build --build-image=bahmansalehinic4/ar-conversations
kubectl rollout restart deployment ar-conversations-depl
```

## Method 2: Build + Delete Pod

Build the image, then delete the pod (deployment will recreate it with new image):

```bash
# Build the image
skaffold build --build-image=<image-name>

# Delete the pod (deployment will recreate it)
kubectl delete pod -l app=<app-label>
```

**Example for AR Conversations:**
```bash
skaffold build --build-image=bahmansalehinic4/ar-conversations
kubectl delete pod -l app=ar-conversations
```

## Method 3: Build + Update Deployment Image Tag

Build the image, then manually update the deployment with the new image tag:

```bash
# Build the image (note the tag from output)
skaffold build --build-image=<image-name>

# Update deployment with new image tag
kubectl set image deployment/<deployment-name> <container-name>=<image-name>:<tag>
```

## Method 4: Use skaffold run (Deploys Everything)

⚠️ **Warning:** This will rebuild and redeploy ALL services, not just one:

```bash
skaffold run
```

To rebuild everything but only deploy specific manifests, you'd need to modify `skaffold.yaml` temporarily or use profiles.

## Common Deployment Names

- `ar-conversations-depl` - AR Conversations service
- `post-depl` - Post service
- `user-depl` - User service
- `realtime-gateway-depl` - Realtime Gateway service
- `ai-gateway-depl` - AI Gateway service
- `api-gateway-depl` - API Gateway service

## Common App Labels

- `app=ar-conversations`
- `app=post`
- `app=user`
- `app=realtime-gateway`
- `app=ai-gateway`
- `app=api-gateway`

## Example: Post Deployment

```bash
skaffold build --build-image=bahmansalehinic4/post -q | skaffold deploy --build-artifacts=-
```

Or:

```bash
skaffold build --build-image=bahmansalehinic4/post
skaffold deploy
```

## Example: AR Conversations Service

```bash
skaffold build --build-image=bahmansalehinic4/ar-conversations -q | skaffold deploy --build-artifacts=-
```

## Force Pod Restart After Rebuild

```bash
kubectl delete pod -l app=post && skaffold build --build-image=bahmansalehinic4/post -q | skaffold deploy --build-artifacts=-
```

Or delete the deployment and let Skaffold recreate it:

```bash
kubectl delete deployment post-depl && skaffold build --build-image=bahmansalehinic4/post -q | skaffold deploy --build-artifacts=-
```

## Common Artifact Names

- `bahmansalehinic4/post` - Post service
- `bahmansalehinic4/user` - User service
- `bahmansalehinic4/ar-conversations` - AR Conversations service
- `bahmansalehinic4/realtime-gateway` - Realtime Gateway service
- `bahmansalehinic4/ai-gateway` - AI Gateway service
- `bahmansalehinic4/api-gateway` - API Gateway service

Check `skaffold.yaml` for the complete list of artifacts.




