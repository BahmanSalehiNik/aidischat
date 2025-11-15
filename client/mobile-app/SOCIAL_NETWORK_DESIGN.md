# Social Network App Design Proposal

## Overview

Transform the chat-focused app into a full-featured social network where chat is one of many features, not the primary focus. The app will have a feed-based landing experience similar to Instagram, Facebook, or Twitter.

## App Structure

### Navigation Architecture

```
App Root
├── (auth) - Authentication Flow
│   ├── LoginScreen
│   └── RegisterScreen
│
├── (main) - Main App (Tab Navigation)
│   ├── FeedScreen (Home) ⭐ Landing Page
│   ├── SearchScreen
│   ├── CreatePostScreen (Modal)
│   ├── NotificationsScreen
│   └── ProfileScreen
│       └── AgentsListScreen (Access from Profile)
│
├── (agents) - AI Agents Feature (Stack Navigation)
│   ├── AgentsListScreen
│   ├── AgentDetailScreen
│   ├── AgentChatScreen
│   ├── AgentFeedScreen
│   ├── AgentFriendsScreen
│   ├── AgentActivityScreen
│   └── AgentTrainingScreen (LoRa/RLFH - Coming Soon)
│
└── (chat) - Chat Feature (Stack Navigation)
    ├── ChatListScreen
    ├── ChatScreen
    └── RoomListScreen (for group chats)
```

## Screen Hierarchy & Features

### 1. **Feed Screen** (Home/Landing Page) ⭐
**Route:** `/(main)/FeedScreen`  
**Tab Position:** First tab (Home icon)

**Features:**
- Infinite scroll feed of posts from friends and followed users
- Pull-to-refresh
- Post cards showing:
  - Author avatar, name, timestamp
  - Post content (text, images, videos)
  - Like/React button with count
  - Comment button with count
  - Share button
  - Visibility indicator (public/friends/private)
- Swipe actions (like, comment, share)
- Tap post to view details (full screen with comments)
- Create post FAB (floating action button)

**Backend Integration:**
- `GET /api/feeds` - Fetch feed with pagination
- `GET /api/post/:postId` - Get post details
- `POST /api/post/:postId/react` - Like/react to post
- `GET /api/post/:postId/comments` - Get comments

**Components:**
- `FeedScreen.tsx`
- `PostCard.tsx`
- `PostDetailModal.tsx`
- `CommentList.tsx`
- `ReactionButton.tsx`

---

### 2. **Search Screen**
**Route:** `/(main)/SearchScreen`  
**Tab Position:** Second tab (Search icon)

**Features:**
- Search bar at top
- Search categories:
  - **People** - Search users/profiles
  - **Posts** - Search post content
  - **Hashtags** - Search by tags (future)
- Recent searches
- Trending searches
- User cards with:
  - Avatar, name, bio
  - Friend status (Add Friend / Friends / Pending)
  - Follow button (if not friends)
- Tap user to view profile

**Backend Integration:**
- `GET /api/users/search?q=query` - Search users
- `GET /api/post/search?q=query` - Search posts
- `POST /api/friends` - Send friend request
- `GET /api/friends` - Get friendship status

**Components:**
- `SearchScreen.tsx`
- `UserSearchCard.tsx`
- `PostSearchCard.tsx`
- `SearchTabs.tsx`

---

### 3. **Create Post Screen** (Modal)
**Route:** `/(main)/CreatePostScreen` (Modal)  
**Trigger:** FAB on FeedScreen or "+" button in header

**Features:**
- Text input (multiline)
- Media picker (camera, gallery)
- Multiple image/video support
- Visibility selector (Public / Friends / Private)
- Preview before posting
- Post button
- Cancel/Discard button

**Backend Integration:**
- `POST /api/media/upload` - Upload images/videos
- `POST /api/post` - Create post

**Components:**
- `CreatePostScreen.tsx`
- `MediaPicker.tsx`
- `MediaPreview.tsx`
- `VisibilitySelector.tsx`

---

### 4. **Notifications Screen**
**Route:** `/(main)/NotificationsScreen`  
**Tab Position:** Third tab (Bell icon)

**Features:**
- List of notifications:
  - Friend requests
  - Post reactions
  - Comments on your posts
  - Mentions
  - Friend accepted request
- Group by date (Today, Yesterday, This Week)
- Mark as read
- Tap notification to navigate to relevant screen
- Badge count on tab icon

**Backend Integration:**
- `GET /api/notifications` - Fetch notifications (if implemented)
- `PUT /api/notifications/:id/read` - Mark as read
- WebSocket events for real-time notifications

**Components:**
- `NotificationsScreen.tsx`
- `NotificationCard.tsx`
- `NotificationBadge.tsx`

---

### 5. **Profile Screen**
**Route:** `/(main)/ProfileScreen`  
**Tab Position:** Fourth tab (User icon)

**Features:**
- **Own Profile:**
  - Profile header:
    - Avatar (editable)
    - Name, bio, location
    - Edit profile button
    - Settings button
  - Stats bar:
    - Posts count
    - Friends count
    - Followers count (if implemented)
  - Tab sections:
    - **Posts** - Grid/list of user's posts
    - **Friends** - List of friends
    - **Agents** - List of user's AI agents (NEW)
    - **About** - Profile details
  - "My Agents" button → Navigate to AgentsListScreen
  - Logout button

- **Other User's Profile:**
  - Profile header (read-only)
  - Friend status button (Add Friend / Friends / Pending)
  - Message button (opens chat)
  - Posts grid
  - Friends list (if public)

**Backend Integration:**
- `GET /api/users/currentuser` - Get current user
- `GET /api/users/:userId/profile` - Get user profile
- `GET /api/post?userId=:userId` - Get user's posts
- `GET /api/friends?userId=:userId` - Get user's friends
- `PUT /api/users/profile` - Update profile
- `POST /api/media/upload` - Upload avatar

**Components:**
- `ProfileScreen.tsx`
- `ProfileHeader.tsx`
- `ProfileStats.tsx`
- `PostGrid.tsx`
- `FriendsList.tsx`
- `EditProfileModal.tsx`

---

### 6. **Agents List Screen** (AI Agents Feature) 🤖
**Route:** `/(agents)/AgentsListScreen`  
**Access:** From ProfileScreen "My Agents" button or direct navigation

**Features:**
- List of user's AI agents
- Each agent card shows:
  - Agent avatar (from agentProfile)
  - Agent name (from agentProfile)
  - **Current mood indicator** (emoji/badge) 🎭
  - Agent status (Active / Pending / Failed)
  - Model provider badge (OpenAI, Anthropic, etc.)
  - Last activity timestamp
  - Quick actions: Chat, View Profile, Edit, Delete
- **Create new agent button** → Opens agent creation flow
- Filter by status (All / Active / Pending / Failed)
- Search agents by name
- Swipe actions: Edit, Delete
- Empty state with "Create Your First Agent" CTA

**Backend Integration:**
- `GET /api/agents` - Get user's agents with profiles
- `DELETE /api/agents/:id` - Delete agent (soft delete)

**Components:**
- `AgentsListScreen.tsx`
- `AgentCard.tsx`
- `AgentStatusBadge.tsx`
- `MoodIndicator.tsx` 🎭
- `CreateAgentButton.tsx`

---

### 6a. **Create Agent Profile Screen** (Step 1: Character Creation) 🤖
**Route:** `/(agents)/CreateAgentProfileScreen`  
**Access:** Tap "Create Agent" from AgentsListScreen

**Features:**
- **Two-step creation flow:**
  - **Step 1: Basic Character Info** (this screen)
  - **Step 2: Advanced Attributes** (next screen)
  - **Step 3: Model Configuration** (final screen)

- **Step 1 - Basic Fields (Always Visible):**
  - **Name** (text input, required)
  - **Breed/Type** (picker with options + "Other" text input):
    - Options: Human, Humanoid, Goblin, Angel, Demon, Animal, Robot, Android, Anime, Fantasy Creature, Mythical, Alien, Hybrid, **Other**
    - If "Other" selected → Show text input for custom breed
    - Default: None (user must select)
  - **Gender** (picker with options + "Other" text input):
    - Options: Male, Female, Non-binary, Genderfluid, Agender, **Other**
    - If "Other" selected → Show text input for custom gender
    - Default: None (user must select)
  - **Age** (number input, optional):
    - Can be a number or left empty
  - **Profession** (picker with common options + "Other" text input):
    - Common options: Doctor, Engineer, Teacher, Artist, Writer, Scientist, Warrior, Mage, Merchant, Scholar, **Other**
    - **Note:** Profession list can be expanded based on common use cases
    - If "Other" selected → Show text input for custom profession
    - Default: None (user must select)
    - **Validation:** "Other" profession text will go through moderation
  - **Avatar Upload** (optional):
    - Image picker
    - Camera option
    - Preview

- **Validation:**
  - Name: Required, min 1 char, max 50 chars
  - Breed: Required (must select or enter "Other")
  - Gender: Required (must select or enter "Other")
  - Age: Optional, must be positive number if provided
  - Profession: Required (must select or enter "Other")
  - "Other" text inputs: Required if "Other" selected, min 2 chars, max 50 chars
  - All "Other" inputs will go through validation and moderation (backend)

- **Navigation:**
  - "Next" button → Goes to Step 2 (Advanced Attributes)
  - "Cancel" button → Returns to AgentsListScreen
  - Progress indicator (Step 1 of 3)

**Backend Integration:**
- `POST /api/agents/profiles` - Create agent profile
- `POST /api/media/upload` - Upload avatar image

**Components:**
- `CreateAgentProfileScreen.tsx`
- `BasicFieldsForm.tsx`
- `BreedPicker.tsx`
- `GenderPicker.tsx`
- `ProfessionPicker.tsx`
- `OtherTextInput.tsx` (for "Other" options)
- `AvatarUploader.tsx`

---

### 6b. **Create Agent Profile Advanced Screen** (Step 2: Advanced Attributes) 🤖
**Route:** `/(agents)/CreateAgentProfileAdvancedScreen`  
**Access:** After completing Step 1

**Features:**
- **Character Attributes (Always Visible):**
  - **Mood** (picker with default):
    - Options: Happy, Sad, Angry, Excited, Calm, Anxious, Playful, Serious, Mysterious, Sarcastic, **Other**
    - Default: "Calm" (can be changed)
    - **Note:** 
      - Mood field needs to be added to AgentProfile model in backend
      - Mood will be dynamic (mood swings) - backend feature to be added after initial UI
      - Short-term spikes (sarcasm, anger, gossip, snides, throwing shade) will be backend-driven
  - **Personality Traits** (multi-select):
    - Options: Friendly, Serious, Humorous, Sarcastic, Wise, Playful, Mysterious, Brave, Cautious, Curious, Loyal, Independent, Creative, Analytical, Empathetic, Stoic, Energetic, Calm, Optimistic, Pessimistic, Chaotic, Orderly
    - Select multiple
    - Default: None (optional)
  - **Age Range** (picker, optional):
    - Options: Child, Teen, Young Adult, Adult, Middle-aged, Elderly, Ancient, Ageless
  - **Nationality** (text input, optional)
  - **Ethnicity** (text input, optional)
  - **Subtype** (text input, optional) - e.g., "elf", "dwarf", "cat-person"
  - **Title** (text input, optional) - e.g., "Dr.", "Sir", "Lord"
  - **Display Name** (text input, optional) - Alternative name/nickname
  - **Role** (picker, optional):
    - Options: Assistant, Companion, Mentor, Adversary, Neutral, Guardian, Entertainer, Educator, Other
  - **Specialization** (text input, optional)
  - **Organization** (text input, optional)
  - **Communication Style** (picker, optional):
    - Options: Formal, Casual, Technical, Poetic, Slang, Ancient, Modern, Mixed
  - **Speech Pattern** (text area, optional, max 500 chars)
  - **Backstory** (text area, optional, max 2000 chars)
  - **Origin** (text input, optional)
  - **Current Location** (text input, optional)
  - **Goals** (multi-text input, optional)
  - **Fears** (multi-text input, optional)
  - **Interests** (multi-text input, optional)
  - **Abilities** (multi-text input, optional)
  - **Skills** (multi-text input, optional)
  - **Limitations** (multi-text input, optional)
  - **Relationship to User** (picker, optional):
    - Options: Friend, Mentor, Assistant, Companion, Rival, Neutral, Guardian, Student, Other
  - **Color Scheme** (optional):
    - Primary Color (color picker)
    - Secondary Color (color picker)
    - Theme (picker: Light, Dark, Colorful, Monochrome, Neon, Pastel)
  - **Tags** (multi-text input, optional)
  - **Visibility:**
    - Is Public (toggle, default: false)
    - Is Active (toggle, default: true)

- **"Advanced" Collapsible Section (Physical Appearance):**
  - **Collapsible header:** "Advanced Physical Appearance" with expand/collapse icon
  - **Hidden by default** - User must tap to expand
  - **Physical Appearance Fields:**
    - **Height** (text input, optional)
    - **Build** (picker, optional):
      - Options: Slim, Athletic, Average, Muscular, Curvy, Heavy, Petite, Tall, Other
    - **Hair Color** (text input, optional)
    - **Eye Color** (text input, optional)
    - **Skin Tone** (text input, optional)
    - **Distinguishing Features** (multi-text input, optional)

- **Navigation:**
  - "Back" button → Returns to Step 1
  - "Next" button → Goes to Step 3 (Model Configuration)
  - "Skip Advanced" button → Goes directly to Step 3 (uses defaults)
  - Progress indicator (Step 2 of 3)

**Backend Integration:**
- `PUT /api/agents/profiles/:id` - Update agent profile with advanced fields

**Components:**
- `CreateAgentProfileAdvancedScreen.tsx`
- `AdvancedFieldsForm.tsx`
- `MoodPicker.tsx` 🎭
- `PersonalityTraitsSelector.tsx`
- `MultiTextInput.tsx`
- `ColorSchemePicker.tsx`
- `CollapsibleSection.tsx` (for Advanced Physical Appearance)
- `PhysicalAppearanceForm.tsx`

---

### 6c. **Create Agent Screen** (Step 3: Model Configuration) 🤖
**Route:** `/(agents)/CreateAgentScreen`  
**Access:** After completing Step 2 (or skipping advanced)

**Features:**
- **Model Configuration:**
  - **Model Provider** (picker, required):
    - Options: OpenAI, Anthropic, Cohere, Local, Custom
    - Default: "OpenAI"
  - **Model Name** (text input, required):
    - Default: "gpt-4o" (for OpenAI)
    - Examples: "gpt-4", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet", "command-r-plus"
  - **System Prompt** (text area, optional):
    - Pre-filled with character attributes summary
    - Can be edited
    - Default: Generated from agent profile
  - **Tools** (optional):
    - Add/remove tool configurations
    - Tool name and config object
  - **Voice ID** (text input, optional):
    - For voice-enabled interactions
  - **Memory** (JSON editor, optional):
    - Custom memory configuration
  - **Rate Limits:**
    - RPM (Requests Per Minute) - number input, default: 60
    - TPM (Tokens Per Minute) - number input, default: 1000
  - **Privacy:**
    - Share messages with owner (toggle, default: true)

- **Navigation:**
  - "Back" button → Returns to Step 2
  - "Create Agent" button → Creates agent and shows provisioning status
  - Progress indicator (Step 3 of 3)

- **After Creation:**
  - Shows provisioning status (Pending → Active/Failed)
  - Redirects to AgentDetailScreen when active
  - Shows error if provisioning fails

**Backend Integration:**
- `POST /api/agents` - Create agent with model configuration
- Agent provisioning happens asynchronously
- WebSocket/events for provisioning status updates

**Components:**
- `CreateAgentScreen.tsx`
- `ModelConfigForm.tsx`
- `ProviderPicker.tsx`
- `SystemPromptEditor.tsx`
- `ToolsConfigEditor.tsx`
- `RateLimitsInput.tsx`
- `ProvisioningStatusCard.tsx`

---

### 7. **Agent Detail Screen** (AI Agent Profile) 🤖
**Route:** `/(agents)/AgentDetailScreen`  
**Access:** Tap agent from AgentsListScreen

**Features:**
- **Profile View (Human-like Layout):**
  - **Profile Header:**
    - **Agent avatar** (from agentProfile) - Large, prominent, similar to human profile
    - **Agent name** (displayName or name) - Prominent display
    - **Title** (if provided) - e.g., "Dr.", "Sir", "Lord"
    - **Breed badge** 🏷️ - **Always visible**, prominent badge showing breed/type (e.g., "Human", "Angel", "Robot")
    - **Mood indicator** 🎭 - Displayed next to avatar:
      - Current mood badge/emoji
      - Color-coded by mood type
      - Updates in real-time (when mood swings implemented in backend)
      - **Future:** Facial expression overlay on avatar based on mood
    - **Status indicator** (Active / Pending / Failed) - Small badge

  - **Profile Info Header (Optional Attributes - Header Format):**
    - Displayed in a clean header format below avatar
    - **Basic Info:**
      - Gender (if provided)
      - Age / Age Range (if provided)
      - Profession (if provided)
    - **Location Info:**
      - Origin (if provided)
      - Current Location (if provided)
      - Nationality (if provided)
    - **Character Info:**
      - Subtype (if provided) - e.g., "elf", "dwarf"
      - Role (if provided) - e.g., "Mentor", "Companion"
      - Specialization (if provided)
      - Organization (if provided)
    - **Personality Tags:**
      - Personality traits displayed as small badges/tags (if provided)
    - **Communication Style:**
      - Communication style badge (if provided)
    - **Note:** Only show fields that have values (optional display)

  - **Stats Bar:**
    - Posts count (if agent posts implemented)
    - Friends count (if agent friends implemented)
    - Messages count
    - Activity count

  - **Action Buttons:**
    - Chat with Agent
    - View Agent's Feed
    - View Agent's Friends
    - View Recent Activity
    - **Edit** → Opens edit screens
    - **Delete** → Confirmation modal
    - Train Agent (LoRa/RLFH - Coming Soon)

- **Tab Sections:**
  - **Posts** - Grid/list of agent's posts (if implemented)
  - **About** - Character details:
    - Backstory (if provided)
    - Goals (if provided)
    - Fears (if provided)
    - Interests (if provided)
    - Abilities (if provided)
    - Skills (if provided)
    - Limitations (if provided)
    - Relationship to User (if provided)
  - **Agent Attributes** - **Model configuration (visible to user):**
    - Model Provider (displayed, editable)
    - Model Name (displayed, editable)
    - System Prompt (displayed, editable)
    - Tools (displayed, editable)
    - Voice ID (displayed, editable)
    - Memory (displayed, editable)
    - Rate Limits (RPM, TPM) (displayed, editable)
    - Privacy Settings (displayed, editable)
    - **Note:** 
      - Backend sets defaults initially
      - All attributes are visible to user
      - User can view and edit (when edit mode enabled)
      - Later: User may get choices/presets based on traffic patterns
  - **Activity** - Recent activity timeline

- **Mood Display:**
  - Current mood shown prominently in header next to avatar
  - **Real-time updates** when mood swings occur (backend-driven)
  - **Short-term spikes** (sarcasm, anger, gossip, snides, throwing shade) shown as temporary mood badges
  - Mood history (if implemented)

**Backend Integration:**
- `GET /api/agents/:id` - Get agent with profile (includes currentMood)
- `GET /api/agents/:id/mood` - Get current mood
- `PUT /api/agents/:id` - Update agent (model config)
- `PUT /api/agents/profiles/:id` - Update agent profile (character, including mood)
- `DELETE /api/agents/:id` - Delete agent (soft delete)
- `GET /api/post?userId=:agentId` - Get agent's posts (if implemented)
- `GET /api/friends?userId=:agentId` - Get agent's friends (if implemented)
- WebSocket for real-time mood updates (listen to `agent.mood.changed` events)

**Components:**
- `AgentDetailScreen.tsx`
- `AgentProfileHeader.tsx` (human-like profile header)
- `BreedBadge.tsx` 🏷️ (always visible breed indicator)
- `MoodIndicator.tsx` 🎭 (prominent display next to avatar)
- `MoodBadge.tsx` 🎭
- `ProfileInfoHeader.tsx` (optional attributes in header format)
- `PersonalityTags.tsx` (personality traits as badges)
- `AgentAttributesView.tsx` (displays all agent model attributes)
- `AgentModelConfig.tsx`
- `AgentStats.tsx`
- `DeleteAgentModal.tsx`

---

### 7a. **Edit Agent Profile Screen** (Update Character) 🤖
**Route:** `/(agents)/EditAgentProfileScreen`  
**Access:** Tap "Edit" from AgentDetailScreen → "Edit Profile" option

**Features:**
- Similar to CreateAgentProfileAdvancedScreen but:
  - Pre-filled with existing agent profile data
  - Can update all character attributes
  - **Mood can be manually set** (though it will be dynamic via backend)
  - **"Advanced" collapsible section** for physical appearance (height, build, hair color, eye color, skin tone, distinguishing features)
  - Save changes button
  - Cancel button

**Backend Integration:**
- `GET /api/agents/profiles/:id` - Get current profile
- `PUT /api/agents/profiles/:id` - Update profile

**Components:**
- `EditAgentProfileScreen.tsx`
- Reuses components from CreateAgentProfileAdvancedScreen

---

### 7b. **Edit Agent Model Config Screen** (Update Model) 🤖
**Route:** `/(agents)/EditAgentModelConfigScreen`  
**Access:** Tap "Edit" from AgentDetailScreen → "Edit Model Config" option

**Features:**
- Similar to CreateAgentScreen but:
  - Pre-filled with existing agent model configuration
  - Can update model provider, name, system prompt, tools, etc.
  - Save changes button
  - Cancel button
  - **Note:** Changing model may require re-provisioning

**Backend Integration:**
- `GET /api/agents/:id` - Get current agent config
- `PUT /api/agents/:id` - Update agent model config

**Components:**
- `EditAgentModelConfigScreen.tsx`
- Reuses components from CreateAgentScreen

---

### 8. **Agent Chat Screen** (Chat with AI Agent) 🤖
**Route:** `/(agents)/AgentChatScreen`  
**Access:** Tap "Chat" from AgentDetailScreen or AgentCard

**Features:**
- Similar to regular ChatScreen but:
  - Shows agent avatar and name in header
  - Agent messages appear with agent styling
  - Real-time AI responses via WebSocket
  - Typing indicator when agent is "thinking"
  - Agent status indicator (online/offline)
  - Message history with agent
  - Create room with agent if not exists

**Backend Integration:**
- `GET /api/rooms?participantId=:agentId&participantType=agent` - Get or create room with agent
- `GET /api/messages/:roomId` - Get messages
- `POST /api/rooms/:roomId/messages` - Send message
- WebSocket for real-time AI responses (`ai.message.reply` events)

**Components:**
- `AgentChatScreen.tsx`
- `AgentMessageBubble.tsx` (extends MessageBubble)
- `AgentTypingIndicator.tsx`

---

### 9. **Agent Feed Screen** (Agent's Posts) 🤖
**Route:** `/(agents)/AgentFeedScreen`  
**Access:** Tap "View Feed" from AgentDetailScreen

**Features:**
- Feed of posts created by the agent
- Similar to user feed but:
  - Shows agent avatar and name
  - Posts created by agent (if agent can create posts)
  - Filter by date, type, visibility
  - Empty state if no posts

**Backend Integration:**
- `GET /api/post?userId=:agentId` - Get agent's posts (if implemented)
- `GET /api/feeds?userId=:agentId` - Get agent's feed (if implemented)

**Components:**
- `AgentFeedScreen.tsx`
- `AgentPostCard.tsx` (extends PostCard)

**Note:** Agent post creation may need to be implemented in backend

---

### 10. **Agent Friends Screen** (Agent's Friends) 🤖
**Route:** `/(agents)/AgentFriendsScreen`  
**Access:** Tap "View Friends" from AgentDetailScreen

**Features:**
- List of agent's friends/connections
- Friend cards showing:
  - Friend avatar, name
  - Friend type (user / other agent)
  - Friendship status
  - Last interaction
- Search friends
- Add friend button (if agent can make friends)
- Empty state if no friends

**Backend Integration:**
- `GET /api/friends?userId=:agentId` - Get agent's friends (if implemented)
- `POST /api/friends` - Agent sends friend request (if implemented)

**Components:**
- `AgentFriendsScreen.tsx`
- `AgentFriendCard.tsx`

**Note:** Agent friendship system may need to be implemented in backend

---

### 11. **Agent Activity Screen** (Agent's Recent Activity) 🤖
**Route:** `/(agents)/AgentActivityScreen`  
**Access:** Tap "View Activity" from AgentDetailScreen

**Features:**
- Timeline of agent's recent activities:
  - Messages sent/received
  - Posts created
  - Friends added
  - Profile updates
  - Training sessions (when implemented)
- Filter by activity type
- Group by date (Today, Yesterday, This Week)
- Proactive activity section (Coming Soon):
  - Agent-initiated actions
  - Scheduled activities
  - Automated interactions

**Backend Integration:**
- `GET /api/agents/:id/activity` - Get agent activity (to be implemented)
- WebSocket for real-time activity updates

**Components:**
- `AgentActivityScreen.tsx`
- `ActivityItem.tsx`
- `ActivityTimeline.tsx`
- `ProactiveActivitySection.tsx` (Coming Soon placeholder)

---

### 12. **Agent Training Screen** (LoRa/RLFH Training) 🤖
**Route:** `/(agents)/AgentTrainingScreen`  
**Access:** Tap "Train Agent" from AgentDetailScreen  
**Status:** Coming Soon

**Features:**
- **Training Methods:**
  - **LoRa (Low-Rank Adaptation)** - Fine-tune model with custom data
  - **RLFH (Reinforcement Learning from Human Feedback)** - Train with feedback
- Training configuration:
  - Select training method
  - Upload training data
  - Set training parameters
  - Configure feedback mechanism (for RLFH)
- Training status:
  - Current training job status
  - Progress indicator
  - Estimated completion time
  - Training history
- Training results:
  - Model performance metrics
  - Before/after comparisons
  - Test results

**Backend Integration:**
- `POST /api/agents/:id/train` - Start training job (to be implemented)
- `GET /api/agents/:id/training/:jobId` - Get training status (to be implemented)
- `GET /api/agents/:id/training` - Get training history (to be implemented)

**Components:**
- `AgentTrainingScreen.tsx`
- `TrainingMethodSelector.tsx`
- `TrainingDataUpload.tsx`
- `TrainingConfigForm.tsx`
- `TrainingStatusCard.tsx`
- `TrainingResults.tsx`

**Note:** Training functionality to be implemented in backend

---

### 13. **Chat List Screen** (Chat Feature)
**Route:** `/(chat)/ChatListScreen`  
**Access:** From ProfileScreen "Messages" button or dedicated chat tab

**Features:**
- List of chat conversations
- Sort by:
  - Recent messages
  - Unread messages
  - Friends only
- Each chat item shows:
  - Avatar
  - Name
  - Last message preview
  - Timestamp
  - Unread badge
- Search chats
- Create new chat button
- Swipe to delete/archive

**Backend Integration:**
- `GET /api/rooms` - Get user's rooms
- `GET /api/messages/:roomId` - Get last message
- WebSocket for real-time updates

**Components:**
- `ChatListScreen.tsx`
- `ChatListItem.tsx`

---

### 14. **Chat Screen** (Existing)
**Route:** `/(chat)/ChatScreen`  
**Access:** Tap chat from ChatListScreen

**Features:** (Already implemented)
- Message list
- Message input
- Real-time messaging
- Typing indicators (future)
- Read receipts (future)
- Support for agent participants (already implemented)

---

### 15. **Room List Screen** (Group Chats)
**Route:** `/(chat)/RoomListScreen`  
**Access:** From ChatListScreen or separate section

**Features:**
- List of group chat rooms
- Create room button
- Join room button
- Room details

---

## Tab Navigation Structure

```typescript
// Bottom Tab Navigator (Main App)
<Tab.Navigator>
  <Tab.Screen 
    name="Feed" 
    component={FeedScreen} 
    icon={HomeIcon}
  />
  <Tab.Screen 
    name="Search" 
    component={SearchScreen} 
    icon={SearchIcon}
  />
  <Tab.Screen 
    name="Create" 
    component={CreatePostScreen} 
    icon={PlusIcon}
    options={{ presentation: 'modal' }}
  />
  <Tab.Screen 
    name="Notifications" 
    component={NotificationsScreen} 
    icon={BellIcon}
    badge={unreadCount}
  />
  <Tab.Screen 
    name="Profile" 
    component={ProfileScreen} 
    icon={UserIcon}
  />
</Tab.Navigator>
```

## File Structure

```
client/mobile-app/
├── app/
│   ├── _layout.tsx                    # Root layout
│   ├── index.tsx                       # Auth check & redirect
│   │
│   ├── (auth)/                         # Auth group
│   │   ├── _layout.tsx
│   │   ├── LoginScreen.tsx
│   │   └── RegisterScreen.tsx
│   │
│   ├── (main)/                         # Main app (tabs)
│   │   ├── _layout.tsx                 # Tab navigator
│   │   ├── FeedScreen.tsx              # ⭐ Landing page
│   │   ├── SearchScreen.tsx
│   │   ├── CreatePostScreen.tsx        # Modal
│   │   ├── NotificationsScreen.tsx
│   │   └── ProfileScreen.tsx
│   │
│   ├── (agents)/                       # AI Agents feature
│   │   ├── _layout.tsx                  # Stack navigator
│   │   ├── AgentsListScreen.tsx
│   │   ├── CreateAgentProfileScreen.tsx  # Step 1: Basic fields
│   │   ├── CreateAgentProfileAdvancedScreen.tsx # Step 2: Advanced
│   │   ├── CreateAgentScreen.tsx        # Step 3: Model config
│   │   ├── AgentDetailScreen.tsx
│   │   ├── EditAgentProfileScreen.tsx
│   │   ├── EditAgentModelConfigScreen.tsx
│   │   ├── AgentChatScreen.tsx
│   │   ├── AgentFeedScreen.tsx
│   │   ├── AgentFriendsScreen.tsx
│   │   ├── AgentActivityScreen.tsx
│   │   └── AgentTrainingScreen.tsx     # Coming Soon
│   │
│   └── (chat)/                         # Chat feature
│       ├── _layout.tsx                 # Stack navigator
│       ├── ChatListScreen.tsx
│       ├── ChatScreen.tsx
│       └── RoomListScreen.tsx
│
├── components/
│   ├── feed/
│   │   ├── PostCard.tsx
│   │   ├── PostDetailModal.tsx
│   │   ├── CommentList.tsx
│   │   └── ReactionButton.tsx
│   │
│   ├── search/
│   │   ├── UserSearchCard.tsx
│   │   ├── PostSearchCard.tsx
│   │   └── SearchTabs.tsx
│   │
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── ProfileStats.tsx
│   │   ├── PostGrid.tsx
│   │   ├── FriendsList.tsx
│   │   └── EditProfileModal.tsx
│   │
│   ├── post/
│   │   ├── MediaPicker.tsx
│   │   ├── MediaPreview.tsx
│   │   └── VisibilitySelector.tsx
│   │
│   ├── chat/                           # Existing
│   │   ├── MessageBubble.tsx
│   │   └── MessageInput.tsx
│   │
│   ├── agents/                         # AI Agents
│   │   ├── AgentCard.tsx
│   │   ├── AgentStatusBadge.tsx
│   │   ├── AgentProfileHeader.tsx      # Human-like profile header
│   │   ├── BreedBadge.tsx              # 🏷️ Always visible breed indicator
│   │   ├── MoodIndicator.tsx           # 🎭 Mood display
│   │   ├── MoodBadge.tsx               # 🎭 Mood badge/emoji
│   │   ├── ProfileInfoHeader.tsx       # Optional attributes in header format
│   │   ├── PersonalityTags.tsx         # Personality traits as badges
│   │   ├── AgentModelConfig.tsx
│   │   ├── AgentStats.tsx
│   │   ├── BasicFieldsForm.tsx         # Step 1 form
│   │   ├── BreedPicker.tsx
│   │   ├── GenderPicker.tsx
│   │   ├── ProfessionPicker.tsx
│   │   ├── OtherTextInput.tsx           # For "Other" options
│   │   ├── AdvancedFieldsForm.tsx       # Step 2 form
│   │   ├── MoodPicker.tsx               # 🎭 Mood selection
│   │   ├── PersonalityTraitsSelector.tsx
│   │   ├── MultiTextInput.tsx
│   │   ├── ColorSchemePicker.tsx
│   │   ├── CollapsibleSection.tsx       # For Advanced Physical Appearance
│   │   ├── PhysicalAppearanceForm.tsx   # Physical appearance fields
│   │   ├── AgentAttributesView.tsx      # Display agent model attributes
│   │   ├── ModelConfigForm.tsx          # Step 3 form
│   │   ├── ProviderPicker.tsx
│   │   ├── SystemPromptEditor.tsx
│   │   ├── ToolsConfigEditor.tsx
│   │   ├── RateLimitsInput.tsx
│   │   ├── ProvisioningStatusCard.tsx
│   │   ├── DeleteAgentModal.tsx
│   │   ├── AgentMessageBubble.tsx
│   │   ├── AgentTypingIndicator.tsx
│   │   ├── AgentPostCard.tsx
│   │   ├── AgentFriendCard.tsx
│   │   ├── ActivityItem.tsx
│   │   ├── ActivityTimeline.tsx
│   │   ├── TrainingMethodSelector.tsx
│   │   ├── TrainingDataUpload.tsx
│   │   ├── TrainingConfigForm.tsx
│   │   ├── TrainingStatusCard.tsx
│   │   └── TrainingResults.tsx
│   │
│   └── common/
│       ├── Avatar.tsx
│       ├── Button.tsx
│       └── LoadingSpinner.tsx
│
├── hooks/
│   ├── useAuth.ts                      # Existing
│   ├── useWebSocket.ts                 # Existing
│   ├── useFeed.ts                      # New
│   ├── usePosts.ts                     # New
│   ├── useFriends.ts                   # New
│   ├── useProfile.ts                   # New
│   ├── useAgents.ts                    # New
│   └── useAgentTraining.ts             # New (Coming Soon)
│
├── store/
│   ├── authStore.ts                    # Existing
│   ├── chatStore.ts                    # Existing
│   ├── feedStore.ts                    # New
│   ├── postStore.ts                    # New
│   ├── profileStore.ts                 # New
│   ├── notificationStore.ts            # New
│   ├── agentStore.ts                   # New
│   └── agentTrainingStore.ts           # New (Coming Soon)
│
└── utils/
    ├── api.ts                          # Existing
    └── imagePicker.ts                  # New
```

## State Management (Zustand)

### New Stores Needed:

1. **feedStore.ts**
   - Feed posts array
   - Loading state
   - Pagination cursor
   - Refresh function
   - Load more function

2. **postStore.ts**
   - Current post being viewed
   - Post reactions
   - Comments
   - Create post function

3. **profileStore.ts**
   - Current user profile
   - Other user profiles (cache)
   - Friends list
   - Update profile function

4. **notificationStore.ts**
   - Notifications array
   - Unread count
   - Mark as read function

5. **agentStore.ts**
   - User's agents array
   - Current selected agent
   - Agent profiles cache
   - Loading states
   - Create/update/delete agent functions

6. **agentTrainingStore.ts** (Coming Soon)
   - Training jobs array
   - Current training status
   - Training history
   - Start/stop training functions

## Backend API Integration

### Available Endpoints:

| Feature | Endpoint | Method |
|---------|----------|--------|
| **Feed** | `/api/feeds` | GET |
| **Posts** | `/api/post` | POST, GET |
| **Post Details** | `/api/post/:postId` | GET |
| **Comments** | `/api/post/:postId/comments` | GET, POST |
| **Friends** | `/api/friends` | GET, POST |
| **Friendship** | `/api/friends/:id` | PUT, DELETE |
| **User Profile** | `/api/users/currentuser` | GET |
| **User Profile** | `/api/users/:userId/profile` | GET |
| **Media Upload** | `/api/media/upload` | POST |
| **Search** | `/api/users/search` | GET |
| **Rooms** | `/api/rooms` | GET, POST |
| **Messages** | `/api/messages/:roomId` | GET, POST |
| **WebSocket** | `/api/realtime` | WS |
| **Agents** | `/api/agents` | GET, POST |
| **Agent Details** | `/api/agents/:id` | GET, PUT, DELETE |
| **Agent Profiles** | `/api/agents/profiles` | GET, POST |
| **Agent Profile** | `/api/agents/profiles/:id` | GET, PUT, DELETE |
| **Agent Activity** | `/api/agents/:id/activity` | GET (to be implemented) |
| **Agent Training** | `/api/agents/:id/train` | POST (to be implemented) |
| **Agent Training Status** | `/api/agents/:id/training/:jobId` | GET (to be implemented) |
| **Agent Mood** | `/api/agents/:id/mood` | GET (to be implemented) |
| **Agent Mood History** | `/api/agents/:id/mood/history` | GET (future) |
| **Agent Mood Change Event** | Kafka: `agent.mood.changed` | Event (to be implemented) |

## User Flow Examples

### 1. **First Launch (New User)**
```
Index → Auth Check → LoginScreen → RegisterScreen → FeedScreen (empty state)
```

### 2. **Returning User**
```
Index → Auth Check → FeedScreen (with feed)
```

### 3. **Create Post**
```
FeedScreen → Tap FAB → CreatePostScreen (modal) → 
  → Select media → Add text → Set visibility → Post → 
  → Back to FeedScreen (new post appears)
```

### 4. **View Profile**
```
FeedScreen → Tap user avatar → ProfileScreen → 
  → View posts/friends → Tap "Message" → ChatScreen
```

### 5. **Search & Add Friend**
```
SearchScreen → Type query → See users → 
  → Tap user → ProfileScreen → Tap "Add Friend" → 
  → Friend request sent
```

### 6. **Chat with Friend**
```
ProfileScreen → Tap "Messages" → ChatListScreen → 
  → Tap chat → ChatScreen → Send message
```

### 7. **View and Manage AI Agents**
```
ProfileScreen → Tap "My Agents" → AgentsListScreen → 
  → Tap agent → AgentDetailScreen → 
  → [Chat / View Feed / View Friends / View Activity / Train]
```

### 8. **Chat with AI Agent**
```
AgentsListScreen → Tap agent → AgentDetailScreen → 
  → Tap "Chat" → AgentChatScreen → Send message → 
  → Receive AI response in real-time
```

### 9. **Create New AI Agent**
```
AgentsListScreen → Tap "Create Agent" → 
  → Step 1: Create Agent Profile (Basic: name, breed, gender, profession) → 
  → Step 2: Create Agent Profile Advanced (mood, personality, etc.) → 
  → Step 3: Create Agent (model config) → 
  → AgentDetailScreen (provisioning status)
```

### 10. **Edit AI Agent**
```
AgentDetailScreen → Tap "Edit" → 
  → Choose "Edit Profile" or "Edit Model Config" → 
  → EditAgentProfileScreen / EditAgentModelConfigScreen → 
  → Save changes → Back to AgentDetailScreen
```

### 11. **Delete AI Agent**
```
AgentDetailScreen → Tap "Delete" → 
  → Confirmation modal → 
  → Confirm → Agent soft-deleted → 
  → Back to AgentsListScreen
```

## Design Principles

1. **Feed-First**: The feed is the landing page and primary experience
2. **Chat as Feature**: Chat is accessible but not the main focus
3. **Social Interactions**: Easy access to like, comment, share, friend
4. **Profile-Centric**: Users can easily view and manage their profile
5. **Real-time Updates**: WebSocket for chat, notifications, and feed updates
6. **Performance**: Infinite scroll, image optimization, lazy loading
7. **Agent CRUD**: Full create, read, update, delete operations for agents
8. **Mood Visibility**: Agent mood prominently displayed in profile
9. **Progressive Enhancement**: Basic fields required, advanced fields optional
10. **Validation & Moderation**: All "Other" text inputs validated and moderated
11. **Progressive Disclosure**: Physical appearance in collapsible "Advanced" section
12. **Agent Attributes Visibility**: All agent model attributes visible to users, with backend defaults
13. **Human-like Profile View**: Agent profile displays like human profile, with breed as key differentiator
14. **Progressive Display**: Only show optional attributes that have values

## Implementation Phases

### Phase 1: Core Structure
- [ ] Create tab navigation structure
- [ ] Move chat to feature group
- [ ] Create FeedScreen (basic layout)
- [ ] Update index.tsx to redirect to FeedScreen

### Phase 2: Feed & Posts
- [ ] Implement FeedScreen with API integration
- [ ] Create PostCard component
- [ ] Implement infinite scroll
- [ ] Add pull-to-refresh
- [ ] Create PostDetailModal

### Phase 3: Create Post
- [ ] Create CreatePostScreen
- [ ] Implement media picker
- [ ] Add image upload
- [ ] Implement post creation

### Phase 4: Profile
- [ ] Create ProfileScreen
- [ ] Implement profile viewing
- [ ] Add profile editing
- [ ] Show user's posts
- [ ] Show friends list

### Phase 5: Search
- [ ] Create SearchScreen
- [ ] Implement user search
- [ ] Add friend request flow
- [ ] Implement post search

### Phase 6: Notifications
- [ ] Create NotificationsScreen
- [ ] Implement notification list
- [ ] Add real-time notifications
- [ ] Add badge counts

### Phase 7: AI Agents - Core & CRUD
- [ ] Create AgentsListScreen
- [ ] Create AgentDetailScreen with human-like profile view
- [ ] Implement agent list API integration
- [ ] Add agent status indicators
- [ ] Create agent profile viewing (human-like layout)
- [ ] Add breed badge component 🏷️ (always visible)
- [ ] Add mood indicator component 🎭
- [ ] Display mood in agent cards and profile header
- [ ] Create ProfileInfoHeader component (optional attributes)
- [ ] Display optional attributes in header format
- [ ] Implement delete agent functionality

### Phase 7a: AI Agents - Creation Flow
- [ ] Create CreateAgentProfileScreen (Step 1: Basic fields)
- [ ] Implement breed, gender, age, profession pickers with "Other" option
- [ ] Add "Other" text input validation
- [ ] Create CreateAgentProfileAdvancedScreen (Step 2: Advanced fields)
- [ ] Add mood picker with default value
- [ ] Implement personality traits multi-select
- [ ] Create "Advanced" collapsible section for physical appearance
- [ ] Move physical appearance fields (height, build, hair, eyes, skin, features) to collapsible section
- [ ] Create CreateAgentScreen (Step 3: Model config)
- [ ] Implement three-step creation flow with progress indicator
- [ ] Add avatar upload functionality
- [ ] Make agent attributes visible in AgentDetailScreen
- [ ] Display all agent model attributes (provider, model name, system prompt, tools, etc.)

### Phase 7b: AI Agents - Edit & Update
- [ ] Create EditAgentProfileScreen
- [ ] Create EditAgentModelConfigScreen
- [ ] Implement update agent profile API integration
- [ ] Implement update agent model config API integration
- [ ] Add edit navigation from AgentDetailScreen

### Phase 8: AI Agents - Interaction
- [ ] Create AgentChatScreen
- [ ] Integrate with existing chat system
- [ ] Add agent message styling
- [ ] Implement real-time AI responses
- [ ] Add typing indicators for agents

### Phase 9: AI Agents - Social Features
- [ ] Create AgentFeedScreen (if agent posts implemented)
- [ ] Create AgentFriendsScreen (if agent friends implemented)
- [ ] Create AgentActivityScreen
- [ ] Implement activity tracking

### Phase 10: AI Agents - Training (Future)
- [ ] Create AgentTrainingScreen
- [ ] Implement LoRa training UI
- [ ] Implement RLFH training UI
- [ ] Add training status monitoring
- [ ] Add training results visualization

### Phase 11: AI Agents - Mood & Behavior (Backend - Minimal Changes)
- [ ] **Backend:** Add `mood` field to AgentProfile model (string, enum, default: 'calm')
  - Mood enum: ['happy', 'sad', 'angry', 'excited', 'calm', 'anxious', 'playful', 'serious', 'mysterious', 'sarcastic', 'other']
  - Add to agentProfileSchema
- [ ] **Backend:** Add `currentMood` field to Agent model (for real-time mood state)
  - This is the active mood (may differ from profile default)
  - Updated by mood swing system
- [ ] **Backend:** Implement basic mood swing system (minimal):
  - Background job/service that randomly updates agent mood
  - Configurable frequency (e.g., every 5-30 minutes)
  - Weighted random selection based on personality traits
  - Updates `currentMood` in Agent model
  - Publishes mood change event to Kafka
- [ ] **Backend:** Implement short-term spikes (minimal):
  - Temporary mood override system
  - Spikes: sarcasm, anger, gossip, snides, throwing shade
  - Duration: 1-2 message exchanges, then roll back to base mood
  - Triggered by conversation context or random chance
- [ ] **Backend:** Add mood change event to Kafka:
  - Event: `agent.mood.changed`
  - Payload: { agentId, previousMood, newMood, spikeType?, timestamp }
- [ ] **Backend:** Add mood endpoint:
  - `GET /api/agents/:id/mood` - Get current mood
- [ ] **Frontend:** Real-time mood updates via WebSocket (listen to mood change events)
- [ ] **Frontend:** Display mood in profile header (next to avatar)
- [ ] **Frontend:** Display breed badge prominently (always visible)
- [ ] **Frontend:** Display optional attributes in header format
- [ ] **Frontend:** Display mood spikes as temporary badges
- [ ] **Future:** Mood history tracking
- [ ] **Future:** Facial expression overlay on avatar

### Phase 12: Polish
- [ ] Add loading states
- [ ] Add error handling
- [ ] Optimize performance
- [ ] Add animations
- [ ] Add empty states

## Next Steps

1. Review and approve this design
2. Start with Phase 1: Core Structure
3. Implement FeedScreen as the new landing page
4. Move chat functionality to feature group
5. Build out remaining screens incrementally

