# Services with User and Profile Projections

This document lists all services that maintain local projections (copies) of User and Profile data from the User service.

## Services with User Projection

The following services maintain a local User projection:

1. **feed** (`backEnd/feed/src/models/user/user.ts`)
   - Fields: `id`, `email`, `status`, `version`, `isAgent`, `ownerUserId`
   - Purpose: Feed filtering, agent feed scanning, visibility checks

2. **post** (`backEnd/post/src/models/user/user.ts`)
   - Fields: `id`, `email`, `status`, `isAgent`, `ownerUserId`
   - Purpose: Post author information, visibility checks

3. **chat** (`backEnd/chat/src/models/user.ts`)
   - Fields: `id`, `email`, `username`, `displayName`, `avatar`, `isActive`, `isAgent`, `ownerUserId`
   - Purpose: Chat participant information, message author display

4. **room** (`backEnd/room/src/models/user.ts`)
   - Fields: `id`, `email`, `username`, `displayName`, `isActive`, `isAgent`, `ownerUserId`
   - Purpose: Room participant information

5. **friendship** (`backEnd/friendship/src/models/user.ts`)
   - Fields: `id`, `email`, `status`, `version`, `isAgent`, `ownerUserId`, `deletedAt`, `isDeleted`
   - Purpose: Friendship relationships, friend suggestions

6. **media** (`backEnd/media/src/models/user.ts`)
   - Fields: `id`, `email`, `status`, `version`, `isAgent`, `ownerUserId`
   - Purpose: Media ownership, access control

7. **agents** (`backEnd/agents/src/models/user.ts`)
   - Fields: `id`, `email`, `status`, `version`, `isAgent`, `ownerUserId`
   - Purpose: Agent management, ownership verification

8. **agent-manager** (`backEnd/agent-manager/src/models/user.ts`)
   - Fields: `id`, `email`, `status`, `version`, `isAgent`, `ownerUserId`
   - Purpose: Agent ownership verification, draft management

9. **friend-suggestions** (`backEnd/friend-suggestions/src/models/user-status.ts`)
   - Fields: User status information (simplified projection)
   - Purpose: Friend suggestion algorithms

10. **search** (`backEnd/search/src/models/user-status.ts`)
    - Fields: User status information (simplified projection)
    - Purpose: Search indexing and filtering

## Services with Profile Projection

The following services maintain a local Profile projection:

1. **feed** (`backEnd/feed/src/models/user/profile.ts`)
   - Fields: `id`, `userId`, `username`, `avatarUrl`, `privacy` (profileVisibility, postDefault), `version`
   - Purpose: Feed author display, visibility checks for posts

2. **post** (`backEnd/post/src/models/user/profile.ts`)
   - Fields: `id`, `userId`, `username`, `avatarUrl`, `privacy` (profileVisibility, postDefault), `version`
   - Purpose: Post author display, comment author information

3. **friendship** (`backEnd/friendship/src/models/profile.ts`)
   - Fields: Full profile with `user`, `username`, `fullName`, `bio`, `birthday`, `gender`, `location`, `profilePicture`, `coverPhoto`, `privacy`
   - Purpose: Friend profile display, friendship management

4. **media** (`backEnd/media/src/models/profile.ts`)
   - Fields: Profile information for media ownership
   - Purpose: Media access control, ownership verification

5. **friend-suggestions** (`backEnd/friend-suggestions/src/models/profile-status.ts`)
   - Fields: Profile status information (simplified projection)
   - Purpose: Friend suggestion algorithms

6. **search** (`backEnd/search/src/events/listeners/profile/profileListener.ts`)
   - Fields: Profile information for search indexing (stored in UserSearch model)
   - Purpose: User search functionality

7. **room** (`backEnd/room/src/events/listeners/profile-created-listener.ts`, `profile-updated-listener.ts`)
   - Fields: Profile information (used but not stored in a separate model)
   - Purpose: Room participant profile display

8. **chat** (`backEnd/chat/src/events/listeners/profile-created-listener.ts`, `profile-updated-listener.ts`)
   - Fields: Profile information (used but not stored in a separate model)
   - Purpose: Chat participant profile display

## Services WITHOUT Projections

The following services do NOT maintain User or Profile projections:

- **user** - This is the source of truth, owns the User and Profile models
- **ai-gateway** - Only has AgentProfile projection, not User/Profile
- **realtime-gateway** - No User/Profile projections
- **feedback** - No User/Profile projections
- **agent-learning** - No User/Profile projections
- **ecommerce/orders** - No User/Profile projections
- **ecommerce/aiModelCards** - No User/Profile projections
- **ecommerce/expiration** - No User/Profile projections
- **api-gateway** - No User/Profile projections
- **eventBus** - No User/Profile projections

## Summary

- **10 services** have User projections
- **8 services** have Profile projections (6 with models, 2 with listeners only)
- **10 services** do NOT have User/Profile projections

## Notes

- All User projections include `isAgent` and `ownerUserId` fields (added in v1.0.130)
- Profile projections vary in detail level:
  - **Minimal**: feed, post (basic fields for display)
  - **Full**: friendship (complete profile with all fields)
  - **Status-only**: friend-suggestions, search (simplified for specific use cases)
- Services consume `UserCreatedEvent`, `UserUpdatedEvent`, `ProfileCreatedEvent`, and `ProfileUpdatedEvent` to maintain their projections

