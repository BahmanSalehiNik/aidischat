# Mobile App Setup & Integration Guide

## ✅ Completed Changes

### Backend Modifications

1. **Authentication Endpoints Updated** (`backEnd/user/src/routes/authRouts/`)
   - `signin.ts`: Now returns JWT token in response body (`{ ...user, token: userJwt }`)
   - `signup.ts`: Now returns JWT token in response body (`{ ...user, token: userJwt }`)
   - Both endpoints still set session cookies for web compatibility

2. **New Room Endpoint** (`backEnd/room/src/routes/getUserRooms.ts`)
   - Added `GET /api/users/rooms` endpoint
   - Returns all rooms where user is a participant
   - Includes participant info (role, joinedAt) for each room

3. **CORS Configuration Updated**
   - Updated CORS in `user`, `room`, and `chat` services
   - Added support for:
     - `http://localhost:8081` (Expo dev server)
     - `exp://localhost:8081` (Expo)
     - `/.expo\.go/` (Expo Go app)
     - `http://localhost:3000` (local dev)

### Mobile App Updates

1. **Auth Hook** (`hooks/useAuth.ts`)
   - Updated to extract token from response body
   - Properly handles user data from backend

2. **Room List Screen** (`app/(chat)/RoomListScreen.tsx`)
   - Now calls `getUserRooms()` API endpoint
   - Displays user's rooms from backend

3. **API Client** (`utils/api.ts`)
   - Added `getUserRooms()` method

## 🚀 Next Steps

### 1. Create Environment File

Create `.env` file in `client/mobile-app/`:

```env
# For local development
API_BASE_URL=http://localhost:3000
WS_URL=ws://localhost:3000

# For production/staging (update with your cluster URL)
# API_BASE_URL=https://api.myapp.com
# WS_URL=wss://api.myapp.com/api/realtime
```

### 2. Start Backend Services

Make sure your backend services are running:
- User service (port 3000)
- Room service (port 3000)
- Chat service (port 3000)
- Realtime Gateway (port 3000)

### 3. Start Mobile App

```bash
cd client/mobile-app
npx expo start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code for physical device

## 🧪 Testing Checklist

- [ ] Sign up with new account
- [ ] Sign in with existing account
- [ ] Create a new room
- [ ] View room list
- [ ] Join a room (WebSocket connection)
- [ ] Send a message
- [ ] Receive messages in real-time
- [ ] Test reconnection (close app, reopen)

## 🔧 Troubleshooting

### WebSocket Connection Issues
- Verify `WS_URL` in `.env` matches your backend
- Check backend WebSocket server is running
- Ensure JWT token is valid

### Authentication Issues
- Verify `API_BASE_URL` in `.env`
- Check backend CORS settings
- Ensure token is being returned in response (check Network tab)

### Room List Empty
- Create a room first
- Check backend logs for errors
- Verify user is participant in rooms

## 📝 Notes

- Backend still uses session cookies for web compatibility
- Mobile app uses JWT tokens from response body
- WebSocket authentication uses token in query parameter
- All CORS settings updated to allow mobile app origins

