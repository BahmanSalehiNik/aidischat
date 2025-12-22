# Gravity Project Review

## Overview
This project is a distributed, microservices-based application named **AI Chat Distributed**. It appears to be a social platform with e-commerce and AI capabilities, designed to run on Kubernetes.

## Architecture
The system follows a microservices architecture, with services separated by domain (e.g., `auth`, `chat`, `user`, `ecommerce`).
- **Backend**: Node.js with TypeScript and Express.
- **Frontend**: Mobile application built with React Native and Expo.
- **Infrastructure**: Kubernetes (K8s) for orchestration, managed via Skaffold for local development.

## Tech Stack

### Backend
- **Language**: TypeScript (Node.js)
- **Framework**: Express.js
- **Database**: 
    - **MongoDB**: Primary data store for most services (e.g., `user`, `chat`, `friendship`).
    - **Redis**: Used for caching and ephemeral data (e.g., `expiration`, `realtime-gateway`).
- **Communication**:
    - **Synchronous**: REST APIs via `api-gateway`.
    - **Asynchronous**: Event-driven architecture using message brokers.
        - **Kafka**: Widely used across social services (`user`, `chat`, `feed`, `friendship`, etc.).
        - **NATS Streaming**: Used primarily in the `ecommerce` domain (`orders`, `expiration`).
- **Key Libraries**:
    - `@aichatwar/shared`: A monolithic shared library containing common middlewares, errors, events, and types.

### Frontend (`client/mobile-app`)
- **Framework**: React Native with Expo.
- **Routing**: `expo-router`.
- **State Management**: `zustand`.
- **UI/Interaction**: `react-native-gesture-handler`, `react-native-reanimated`.

### Infrastructure & DevOps
- **Containerization**: Docker (Dockerfiles present in each service).
- **Orchestration**: Kubernetes.
- **Development Tooling**: Skaffold (`skaffold.yaml` defines the build/deploy pipeline).
- **CI/CD**: GitHub Actions (judging by `.github` directory).
- **Ingress**: NGINX Ingress Controller.

## Key Components

### Services
- **api-gateway**: The entry point for external traffic, routing requests to internal services.
- **realtime-gateway**: Handles real-time communication (WebSockets), likely for chat and notifications.
- **ai-chat-host** & **ai-gateway**: Services dedicated to AI interactions.
- **ecommerce**: Handles `orders`, `expiration`, and `aiModelCards`.
- **Social Services**: `user`, `friendship`, `feed`, `post`, `media`.

### Shared Library
The `shared` directory matches the npm package `@aichatwar/shared`. It acts as the glue for the microservices, ensuring consistent error handling and event schemas.

## Observations
- **Hybrid Messaging**: The project seems to support both Kafka and NATS. New development appears heavily leaned towards Kafka.
- **Monorepo-like Structure**: All services validation, frontend, and infrastructure are in a single repository, simplifying dependency management and CI/CD.
