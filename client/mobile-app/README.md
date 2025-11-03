# AI Chat Mobile App

React Native Expo mobile application for testing the distributed chat backend services.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (will be installed automatically)
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on your phone

### Installation

1. **Navigate to the mobile app directory:**
   ```bash
   cd client/mobile-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env` with your backend URLs:**
   ```env
   # For production/staging
   API_BASE_URL=https://api.myapp.com
   WS_URL=wss://api.myapp.com/api/realtime

   # For local development
   # API_BASE_URL=http://localhost:3000
   # WS_URL=ws://localhost:3000
   ```

### Running the App

1. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

2. **Run on your device:**
   - **iOS Simulator**: Press `i` (requires Mac with Xcode)
   - **Android Emulator**: Press `a` (requires Android Studio)
   - **Physical Device**: Scan QR code with Expo Go app

## 📱 Features

- ✅ JWT Authentication (Sign In / Sign Up)
- ✅ WebSocket real-time messaging with auto-reconnect
- ✅ Room management (create, join, list)
- ✅ Message send/receive with optimistic updates
- ✅ FlashList for performant message rendering
- ✅ Zustand for state management
- ✅ TypeScript for type safety

## 🏗️ Architecture

### Project Structure

```
mobile-app/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   ├── (chat)/            # Chat screens
│   │   ├── RoomListScreen.tsx
│   │   └── ChatScreen.tsx
│   └── _layout.tsx        # Root layout
├── components/             # Reusable components
│   ├── MessageBubble.tsx
│   └── MessageInput.tsx
├── hooks/                 # Custom hooks
│   ├── useAuth.ts
│   └── useWebSocket.ts
├── store/                 # Zustand stores
│   ├── authStore.ts
│   └── chatStore.ts
├── utils/                 # Utilities
│   └── api.ts
└── .env                   # Environment variables
```

### State Management

- **authStore**: Manages authentication state, user data, and JWT token
- **chatStore**: Manages rooms, messages, and current room state

### WebSocket Connection

The app connects to the Realtime Gateway via WebSocket with:
- JWT token authentication (query parameter)
- Automatic reconnection with exponential backoff
- Heartbeat ping/pong mechanism
- Room join/leave handling
- Message send/receive

### API Integration

All REST API calls go through the `api.ts` utility which:
- Handles authentication headers
- Manages base URLs from environment variables
- Provides error handling
- Supports session-based and token-based auth

## 🔌 Backend Integration

### Authentication

- **Sign In**: `POST /api/users/signin`
- **Sign Up**: `POST /api/users/signup`
- **Current User**: `GET /api/users/currentuser`

### Rooms

- **Create Room**: `POST /api/rooms`
- **Get Room**: `GET /api/rooms/:roomId`
- **Delete Room**: `DELETE /api/rooms/:roomId`
- **Add Participant**: `POST /api/rooms/:roomId/participants`

### Messages

- **Get Messages**: `GET /api/rooms/:roomId/messages?page=1&limit=50`

### WebSocket (Realtime Gateway)

- **Connection**: `ws://host/api/realtime?token=JWT_TOKEN`
- **Join Room**: `{ type: 'join', roomId: '...' }`
- **Send Message**: `{ type: 'message.send', roomId: '...', content: '...', tempId: '...' }`
- **Receive Messages**: `{ type: 'message', data: {...} }`

## 🧪 Testing

### Local Development

1. Ensure your backend services are running (via Skaffold or locally)
2. Update `.env` with local URLs:
   ```env
   API_BASE_URL=http://localhost:3000
   WS_URL=ws://localhost:3000
   ```
3. Start Expo: `npx expo start`
4. Test on simulator/emulator or physical device

### Production/Staging

1. Update `.env` with your cluster's ingress URL
2. Ensure CORS is configured on your backend
3. Ensure WebSocket proxy settings allow long-lived connections

## 📦 Building for Production

### EAS Build (Recommended)

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Configure EAS:
   ```bash
   eas build:configure
   ```

3. Build for iOS/Android:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

### OTA Updates

Use EAS Update for JavaScript bundle updates:
```bash
eas update --branch production --message "Update message"
```

## 🐛 Troubleshooting

### WebSocket Connection Issues

- Verify `WS_URL` in `.env` is correct
- Check that your backend allows WebSocket connections
- Ensure JWT token is valid
- Check network connectivity

### Authentication Issues

- Verify `API_BASE_URL` in `.env`
- Check backend CORS settings
- Ensure session cookies are handled (may need backend changes for mobile)

### Build Issues

- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check Node.js version (18+)

## 📝 Notes

- The backend currently uses session-based auth (cookies), which may require modifications for mobile clients
- For production, consider modifying backend to return JWT tokens in response body for mobile clients
- WebSocket connection uses token in query parameter (backend supports this)
- Room listing endpoint may need to be implemented on backend for full functionality

## 🔮 Future Enhancements

- [ ] AI chat integration
- [ ] Multi-room support
- [ ] Push notifications
- [ ] Media attachments
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Presence status
- [ ] Voice/video calls

