# Pivot: Remove AR / Unity / 3D / Training Services (MVP)

Date: 2026-02-07

This doc captures the **MVP pivot** executed today: keep **agent chat** and the core social/chat backend, while removing **AR/Unity/3D/avatar generation** and multiple non-MVP backend services.

## What stayed (high level)
- **Chat + social core**: chat, realtime gateway, rooms, agents, agent-manager, users/auth, feed/post/media, friendship, search, api-gateway, ai-gateway.
- **Agent chat rename**: “AR chat” concepts were renamed to **agent-chat** (no AR/Unity/3D requirement).

## Services removed today

### Mobile / client-side (Expo Go compatibility)
- **Unity client**: `client/unity/` (Unity project removed).
- **Mobile AR/3D features** (Expo app):
  - `client/mobile-app/app/(main)/ARChatScreen.tsx`
  - `client/mobile-app/components/avatar/` (3D viewers / Unity deep link launchers)
  - AR/3D-related utils removed (AR API, avatar API, marker parsing, viseme generation, etc.)
  - Expo config cleaned to remove dev-client/3D native dependencies so **Expo Go works again**.

### Backend services
- **`backEnd/ar-avatar`** (3D avatar/model provider service; Meshy/ReadyPlayerMe related)
- **`backEnd/feedback`** (RLHF batching/feedback aggregation service)
- **`backEnd/agent-learning`** (dataset/training scheduler/generator service)
- **`backEnd/ai-chat-host`** (host/orchestrator service used in earlier designs)
- **`backEnd/chat-recommendation`** (chat recommendation microservice)
- **`backEnd/ecommerce/*`** (ecommerce microservices, including the expiration worker)
- **`backEnd/game`**
- **`backEnd/eventBus`**

## Deploy / infra changes (k8s + Skaffold)
- **Skaffold**: removed build/deploy entries for removed services (artifacts and manifest refs).
- **Kubernetes manifests deleted** (non-exhaustive examples):
  - `infra/k8s/ar-avatar-*.yaml` (and secrets/setup docs)
  - `infra/k8s/feedback-*.yaml`, `infra/k8s/redis-feedback-depl.yaml`, `infra/k8s/feedback-learning-mongo-depl.yaml`
  - `infra/k8s/ai-chat-host-*.yaml`
  - `infra/k8s/chat-recommendation-*.yaml`
  - `infra/k8s/expiration-depl.yaml`, `infra/k8s/expiration-redis-depl.yaml`
- **API Gateway k8s env** cleaned:
  - Removed `AR_AVATAR_SERVICE_URL`
  - Removed `ECOMMERCE_*_SERVICE_URL`

## Kafka topic initialization changes
Updated `infra/k8s/kafka-topics-init.yaml` to stop creating topics for removed services/features, including:
- `feedback.reply.received`, `feedback.reaction.received`
- `agent.learning.updated`, `training.dataset.ready`, `model.updated`
- `chat.recommendation.requested`, `chat.recommendations.ready`
- ecommerce topics (`ecommerce-*`)

## Shared package changes
Removed shared contracts that were only used by removed services:
- **Ecommerce events/subjects** removed (and `shared/src/events/ecommerceEvents.ts` deleted).
- **Feedback reply/reaction subjects/types** removed.
- **Agent-learning subjects/types** removed.
- **Recommendation events/subjects** removed (and `shared/src/events/recommendationEvents.ts` deleted).

## Behavioral change: replies to agents (no feedback service)
Previously: chat-service emitted `feedback.reply.received` → feedback service processed → ai-gateway responded.

Now (MVP): **ai-gateway triggers agent replies directly** from `message.created` reply metadata.

## Notes / remaining references
Some **docs/backups** may still mention removed services (for historical context), but there are no active build/deploy/runtime references remaining.


