# API Gateway Request Flow & Routing

## Overview

The API Gateway acts as a single entry point for all client requests, routing them to the appropriate microservices based on URL patterns.

## Request Flow

```
Mobile App (Client)
    ↓
    GET /api/rooms/{roomId}/messages?page=1&limit=50
    Authorization: Bearer {JWT_TOKEN}
    ↓
API Gateway (Port 8080)
    ↓
    [Routing Logic]
    ↓
Chat Service (Port 3000)
    ↓
    Response: { messages: [...], pagination: {...} }
    ↓
API Gateway
    ↓
Mobile App
```

## Step-by-Step Flow

### 1. Client Request
**Location**: `client/mobile-app/utils/api.ts`

```typescript
// Client sends request to API Gateway
const response = await api.get(`/rooms/${roomId}/messages?page=${page}&limit=${limit}`);
// Full URL: http://192.168.178.179:8080/api/rooms/{roomId}/messages?page=1&limit=50
// Headers: Authorization: Bearer {JWT_TOKEN}
```

### 2. API Gateway Receives Request
**Location**: `backEnd/api-gateway/src/app.ts`

```typescript
app.use((req, res, next) => {
  // Only process /api/* routes
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  // Find matching route rule
  const resolved = resolveTarget(req.path);
  // ...
});
```

### 3. Route Matching
**Location**: `backEnd/api-gateway/src/config/routes.ts`

The gateway matches URL patterns to service URLs:

```typescript
// Example: GET /api/rooms/{roomId}/messages
// Matches pattern: /^\/api\/rooms\/[^/]+\/messages(?:\/.*)?$/i
// Route rule: 'chat-room-messages'
// Target: CHAT_SERVICE_URL environment variable
```

**Route Rules**:
- `/api/rooms/{roomId}/messages` → `CHAT_SERVICE_URL` (Chat Service)
- `/api/rooms` → `ROOM_SERVICE_URL` (Room Service)
- `/api/users` → `USER_SERVICE_URL` (User Service)
- `/api/agents` → `AGENT_SERVICE_URL` (Agent Service)
- `/api/feeds` → `FEED_SERVICE_URL` (Feed Service)
- `/api/posts` → `POST_SERVICE_URL` (Post Service)
- `/api/realtime` → `REALTIME_GATEWAY_URL` (Realtime Gateway - WebSocket)

### 4. Proxy to Target Service
**Location**: `backEnd/api-gateway/src/app.ts`

```typescript
// Creates HTTP proxy middleware
const buildProxy = (target: string) => 
  createProxyMiddleware({
    target,  // e.g., http://chat-srv:3000
    changeOrigin: true,
    ws: true,  // WebSocket support
    // Forwards headers including Authorization
  });
```

### 5. Target Service Processes Request
**Location**: `backEnd/chat/src/routes/get-messages.ts`

```typescript
router.get('/api/rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req, res) => {
  // Extracts JWT from Authorization header
  // Validates user is participant
  // Returns messages
});
```

## Routing Configuration

### Route Patterns (Priority Order)

1. **Chat Service** (`CHAT_SERVICE_URL`):
   - `/api/rooms/{roomId}/messages` - Get messages for a room
   - `/api/debug/*` - Debug endpoints
   - `/api/messages/*` - Message endpoints

2. **Room Service** (`ROOM_SERVICE_URL`):
   - `/api/users/rooms` - Get user's rooms
   - `/api/rooms/*` - All other room endpoints

3. **User Service** (`USER_SERVICE_URL`):
   - `/api/users/*` - User authentication and profile

4. **Agent Service** (`AGENT_SERVICE_URL`):
   - `/api/agents/*` - Agent management

5. **Feed Service** (`FEED_SERVICE_URL`):
   - `/api/feeds` - Feed endpoints

6. **Post Service** (`POST_SERVICE_URL`):
   - `/api/post`, `/api/posts`, `/api/comments`, `/api/reactions`

7. **Realtime Gateway** (`REALTIME_GATEWAY_URL`):
   - `/api/realtime` - WebSocket connections

## Environment Variables

The API Gateway requires these environment variables (set in Kubernetes):

```yaml
env:
  - name: CHAT_SERVICE_URL
    value: "http://chat-srv:3000"
  - name: ROOM_SERVICE_URL
    value: "http://room-srv:3000"
  - name: USER_SERVICE_URL
    value: "http://user-srv:3000"
  - name: AGENT_SERVICE_URL
    value: "http://agent-srv:3000"
  # ... etc
```

## Request Headers Forwarding

The API Gateway forwards:
- `Authorization: Bearer {token}` - JWT token for authentication
- `Content-Type: application/json`
- `x-forwarded-host` - Original host
- `x-forwarded-proto` - Original protocol (http/https)

## Example: Get Messages Request

**Client Request**:
```
GET http://192.168.178.179:8080/api/rooms/b893ccba-a56c-4d4e-a1f6-f6bf89639852/messages?page=1&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**API Gateway**:
1. Receives request on port 8080
2. Matches pattern `/api/rooms/{roomId}/messages`
3. Routes to `CHAT_SERVICE_URL` (http://chat-srv:3000)
4. Proxies request with all headers

**Chat Service**:
1. Receives: `GET /api/rooms/b893ccba-a56c-4d4e-a1f6-f6bf89639852/messages?page=1&limit=50`
2. Extracts JWT from `Authorization` header
3. Validates user is participant
4. Returns messages

**Response Flow**:
```
Chat Service → API Gateway → Mobile App
```

## WebSocket Routing

WebSocket connections also go through the API Gateway:

```
ws://192.168.178.179:8080/api/realtime?token={JWT}
    ↓
API Gateway (matches /api/realtime pattern)
    ↓
Realtime Gateway (ws://realtime-gateway-srv:3000)
```

## Debugging

To see routing in action, check API Gateway logs:

```bash
kubectl logs -l app=api-gateway-depl --tail=100 | grep -E "proxy|route|502"
```

Common issues:
- **502 Bad Gateway**: Target service URL not configured or service is down
- **404 Not Found**: No route pattern matches the URL
- **Timeout**: Service took too long to respond (default: 30s)

