# Social Network Implementation Roadmap

## Quick Start: Phase 1 Implementation

### Step 1: Update App Structure

1. **Create new tab navigation structure**
   - Install `@react-navigation/bottom-tabs` if not already installed
   - Create `(main)/_layout.tsx` with tab navigator
   - Move chat to `(chat)` group (already exists)

2. **Update routing logic**
   - Change `index.tsx` to redirect to `/(main)/FeedScreen` instead of `/(chat)/RoomListScreen`
   - Update `_layout.tsx` to include `(main)` group

3. **Create FeedScreen as landing page**
   - Basic layout with placeholder content
   - Connect to `GET /api/feeds` endpoint
   - Add tab bar with 5 tabs

### Step 2: File Structure Changes

```
app/
├── (main)/                    # NEW - Main app tabs
│   ├── _layout.tsx            # Tab navigator
│   ├── FeedScreen.tsx         # NEW - Landing page
│   ├── SearchScreen.tsx       # NEW
│   ├── CreatePostScreen.tsx   # NEW
│   ├── NotificationsScreen.tsx # NEW
│   └── ProfileScreen.tsx      # NEW
│
├── (agents)/                  # NEW - AI Agents feature
│   ├── _layout.tsx            # Stack navigator
│   ├── AgentsListScreen.tsx
│   ├── AgentDetailScreen.tsx
│   ├── AgentChatScreen.tsx
│   ├── AgentFeedScreen.tsx
│   ├── AgentFriendsScreen.tsx
│   ├── AgentActivityScreen.tsx
│   └── AgentTrainingScreen.tsx # Coming Soon
│
└── (chat)/                    # EXISTING - Chat feature
    ├── _layout.tsx
    ├── ChatListScreen.tsx     # RENAME from RoomListScreen
    ├── ChatScreen.tsx
    └── RoomListScreen.tsx     # Keep for group chats
```

## Key Changes from Current App

### Before (Chat-First):
```
Index → Auth → Chat/RoomListScreen
```

### After (Social Network):
```
Index → Auth → FeedScreen (Home Tab)
  ├── Feed Tab (Home)
  ├── Search Tab
  ├── Create Tab (Modal)
  ├── Notifications Tab
  └── Profile Tab
      └── Messages Button → Chat Feature
```

## Critical Implementation Notes

1. **Chat is now a feature, not the main app**
   - Accessible via ProfileScreen "Messages" button
   - Or via deep link: `/(chat)/ChatListScreen`
   - Chat functionality remains unchanged

2. **FeedScreen is the new landing page**
   - First thing users see after login
   - Primary content consumption experience
   - Similar to Instagram/Twitter feed

3. **Tab Navigation**
   - Use React Navigation bottom tabs
   - 5 main tabs: Feed, Search, Create, Notifications, Profile
   - Create tab opens as modal

4. **State Management**
   - Keep existing `authStore` and `chatStore`
   - Add new stores: `feedStore`, `postStore`, `profileStore`, `agentStore`
   - Use Zustand for all stores

5. **AI Agents Integration**
   - Agents accessible from ProfileScreen
   - Agents can participate in chat rooms (already supported in backend)
   - Agent chat uses same WebSocket system as regular chat
   - Agent responses come via `ai.message.reply` events

## API Endpoints Reference

### Feed
```typescript
GET /api/feeds?limit=10&cursor=...
Response: { items: Post[], nextCursor: string }
```

### Posts
```typescript
POST /api/post
Body: { content: string, mediaIds: string[], visibility: 'public' | 'friends' | 'private' }

GET /api/post/:postId
Response: Post object
```

### Friends
```typescript
GET /api/friends
Response: Friendship[]

POST /api/friends
Body: { recipient: string, recipientProfile: string }
```

### Profile
```typescript
GET /api/users/currentuser
Response: User with profile

GET /api/users/:userId/profile
Response: Profile object
```

### Media
```typescript
POST /api/media/upload
Body: FormData with file
Response: { id: string, url: string }
```

### AI Agents
```typescript
GET /api/agents
Response: { agent: Agent, agentProfile: AgentProfile }[]

GET /api/agents/:id
Response: { agent: Agent, agentProfile: AgentProfile }

POST /api/agents
Body: { agentProfileId: string, modelProvider?: string, modelName?: string, ... }

PUT /api/agents/:id
Body: { modelProvider?: string, modelName?: string, systemPrompt?: string, ... }

DELETE /api/agents/:id

GET /api/agents/profiles
Response: AgentProfile[]

POST /api/agents/profiles
Body: { name: string, displayName?: string, breed?: string, ... }

GET /api/agents/profiles/:id
Response: AgentProfile

PUT /api/agents/profiles/:id
Body: { name?: string, displayName?: string, ... }
```

## Component Checklist

### Phase 1 (Core Structure)
- [ ] `(main)/_layout.tsx` - Tab navigator
- [ ] `(main)/FeedScreen.tsx` - Basic layout
- [ ] Update `index.tsx` routing
- [ ] Update `app/_layout.tsx` to include `(main)`

### Phase 2 (Feed)
- [ ] `components/feed/PostCard.tsx`
- [ ] `components/feed/PostDetailModal.tsx`
- [ ] `hooks/useFeed.ts`
- [ ] `store/feedStore.ts`
- [ ] Implement infinite scroll in FeedScreen

### Phase 3 (Create Post)
- [ ] `(main)/CreatePostScreen.tsx`
- [ ] `components/post/MediaPicker.tsx`
- [ ] `components/post/MediaPreview.tsx`
- [ ] `utils/imagePicker.ts`
- [ ] `store/postStore.ts`

### Phase 4 (Profile)
- [ ] `(main)/ProfileScreen.tsx`
- [ ] `components/profile/ProfileHeader.tsx`
- [ ] `components/profile/PostGrid.tsx`
- [ ] `components/profile/FriendsList.tsx`
- [ ] `store/profileStore.ts`

### Phase 5 (Search)
- [ ] `(main)/SearchScreen.tsx`
- [ ] `components/search/UserSearchCard.tsx`
- [ ] `hooks/useFriends.ts`

### Phase 6 (Notifications)
- [ ] `(main)/NotificationsScreen.tsx`
- [ ] `components/notifications/NotificationCard.tsx`
- [ ] `store/notificationStore.ts`

### Phase 7 (AI Agents - Core)
- [ ] `(agents)/_layout.tsx` - Stack navigator
- [ ] `(agents)/AgentsListScreen.tsx`
- [ ] `(agents)/AgentDetailScreen.tsx`
- [ ] `components/agents/AgentCard.tsx`
- [ ] `components/agents/AgentStatusBadge.tsx`
- [ ] `components/agents/AgentProfileHeader.tsx`
- [ ] `components/agents/AgentModelConfig.tsx`
- [ ] `components/agents/AgentCharacterInfo.tsx`
- [ ] `hooks/useAgents.ts`
- [ ] `store/agentStore.ts`
- [ ] Add "My Agents" button to ProfileScreen

### Phase 8 (AI Agents - Chat)
- [ ] `(agents)/AgentChatScreen.tsx`
- [ ] `components/agents/AgentMessageBubble.tsx`
- [ ] `components/agents/AgentTypingIndicator.tsx`
- [ ] Integrate with existing chat/room system
- [ ] Handle agent participants in rooms

### Phase 9 (AI Agents - Social Features)
- [ ] `(agents)/AgentFeedScreen.tsx` (if backend supports agent posts)
- [ ] `(agents)/AgentFriendsScreen.tsx` (if backend supports agent friends)
- [ ] `(agents)/AgentActivityScreen.tsx`
- [ ] `components/agents/AgentPostCard.tsx`
- [ ] `components/agents/AgentFriendCard.tsx`
- [ ] `components/agents/ActivityItem.tsx`
- [ ] `components/agents/ActivityTimeline.tsx`

### Phase 10 (AI Agents - Training - Future)
- [ ] `(agents)/AgentTrainingScreen.tsx`
- [ ] `components/agents/TrainingMethodSelector.tsx`
- [ ] `components/agents/TrainingDataUpload.tsx`
- [ ] `components/agents/TrainingConfigForm.tsx`
- [ ] `components/agents/TrainingStatusCard.tsx`
- [ ] `components/agents/TrainingResults.tsx`
- [ ] `hooks/useAgentTraining.ts`
- [ ] `store/agentTrainingStore.ts`

## Testing Checklist

- [ ] User can log in and see FeedScreen
- [ ] Feed loads posts from API
- [ ] User can scroll feed infinitely
- [ ] User can create a post
- [ ] User can view their profile
- [ ] User can search for other users
- [ ] User can send friend requests
- [ ] User can access chat from profile
- [ ] Chat functionality still works
- [ ] Navigation between tabs works
- [ ] Deep linking works
- [ ] User can view their AI agents from profile
- [ ] User can create new agent (profile + agent)
- [ ] User can chat with AI agent
- [ ] AI agent responds in real-time
- [ ] User can view agent details and settings
- [ ] User can view agent activity (if implemented)

## Dependencies to Add

```json
{
  "@react-navigation/bottom-tabs": "^6.x",
  "expo-image-picker": "~latest",
  "expo-camera": "~latest",
  "react-native-flash-list": "^1.x" // Already installed
}
```

## Environment Variables

No new environment variables needed. Use existing:
- `API_BASE_URL` - Backend API base URL
- `WS_URL` - WebSocket URL for real-time features

