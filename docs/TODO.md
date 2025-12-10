# TODO List

## AR Avatar Service - Phase 2 Migration

### API Gateway Routes to Remove (Phase 2)
**Status:** Routes added for Phase 1 testing, will be removed in Phase 2  
**Location:** `backEnd/api-gateway/src/config/routes.ts`  
**Routes to Remove:**
- [ ] `/api/tts/*` - TTS routes (will be client-side only in Phase 2)
  - Currently: `ar-avatar-tts-service` route in API gateway
  - Phase 2: Clients call TTS providers directly with ephemeral tokens
  - **Action**: Remove TTS route from API gateway in Phase 2

**Note**: `/api/avatars/*` routes will remain (avatar management is backend-only)

### AI Provider Calls Migration (Phase 2)
**Status:** Phase 1 uses direct calls, Phase 2 will use events + AI Gateway  
**Location:** `backEnd/ar-avatar/src/services/character-description-generator.ts`  
**Current Implementation:**
- Direct API calls to OpenAI/Claude from AR Avatar Service
- Direct API calls to TTS providers (Phase 1 only)

**Phase 2 Changes:**
- [ ] **LLM Calls**: Migrate to event-driven architecture
  - AR Avatar Service publishes `CharacterDescriptionRequestedEvent`
  - AI Gateway consumes event and calls LLM provider
  - AI Gateway publishes `CharacterDescriptionGeneratedEvent`
  - AR Avatar Service consumes event and continues generation
  - **Benefit**: Centralized AI provider management, better separation

- [ ] **TTS Calls**: Move to client-side (already planned)
  - Clients call TTS providers directly with ephemeral tokens
  - No backend TTS service needed
  - **Benefit**: 70-90% backend load reduction

**Design Document**: Updated in `docs/ar-avatar-consolidated-design.md`

---

## High Priority

### Participant Name Display Issue
**Status:** Needs investigation  
**Location:** `client/mobile-app/components/chat/ParticipantsModal.tsx`  
**Issue:** In the participants modal, participant names are not consistently displayed:
- Other participants show user ID instead of username or email prefix
- Current user shows both email prefix AND user ID (should only show email prefix)
- All participants should display only username or email prefix, never user ID

**Expected Behavior:**
- All participants (including current user) should show:
  - Username (if available)
  - OR email prefix (if username not available)
  - Never show user ID

**Current Behavior:**
- Current user: Shows email prefix + user ID
- Other participants: Shows user ID instead of name

**Next Steps:**
- [ ] Review name extraction logic in `ParticipantsModal.tsx`
- [ ] Ensure current user's name extraction doesn't include user ID
- [ ] Fix name extraction for other participants to use username/email prefix
- [ ] Test with multiple participants to verify all show names correctly
- [ ] Check if messages have `senderName` populated for all participants
- [ ] Verify search API returns proper names for all users

**Related Files:**
- `client/mobile-app/components/chat/ParticipantsModal.tsx`
- `client/mobile-app/app/(main)/chat/ChatScreen.tsx` (passes messages to modal)

### API Error Handling - Agent Lookup 404 Suppression
**Status:** Temporary workaround in place  
**Location:** `client/mobile-app/utils/api.ts`  
**Issue:** Currently suppressing 404 errors for agent API lookups (`/api/agents/{id}`) because these are expected when checking if a participant ID is an agent. However, this is a workaround that hides legitimate errors.

**Current Implementation:**
- Suppresses 404 errors in API client when URL contains `/api/agents/`
- Only calls agent API in `ParticipantsModal` when `knownType === 'agent'` (from messages)

**Problems:**
1. Suppressing errors is not ideal - legitimate 404s might be hidden
2. Still making unnecessary API calls in some edge cases
3. Error handling logic is scattered (both in API client and ParticipantsModal)

**Better Solutions to Investigate:**
1. **Type information in participant list**: If the room/participant API returns participant type, we wouldn't need to guess
2. **Batch participant lookup endpoint**: Create an endpoint that takes multiple participant IDs and returns their types and names in one call
3. **Participant type in messages**: Ensure all messages include `senderType` so we can build a reliable type map
4. **Caching participant types**: Cache participant type information locally after first lookup
5. **Separate error handling for "probing" vs "expected" calls**: Distinguish between calls where 404 is expected vs unexpected

**Next Steps:**
- [ ] Check if room API returns participant types
- [ ] Investigate if we can get participant types from room membership events
- [ ] Consider creating a batch lookup endpoint
- [ ] Review message event structure to ensure `senderType` is always present

**Related Files:**
- `client/mobile-app/utils/api.ts` (lines ~82-84, ~118-128)
- `client/mobile-app/components/chat/ParticipantsModal.tsx` (lines ~207-252)

### Agent Feedback – Detailed Owner Input
**Status:** Deferred planning  
**Location:** Feedback service backlog  
**Note:** Current implementation will emit events for reactions/implicit signals. We still need to collect richer, direct owner feedback (long-form + structured ratings) once designs are finalized. Track this so we remember to expand the feedback APIs/models when the requirements arrive.  

**Next Steps:**
- [ ] Revisit once enhanced owner feedback requirements are delivered
- [ ] Extend feedback model/API to capture structured + free-form owner data
- [ ] Ensure rate limiting/security implications are covered

### RLHF – Churn Flag Monitoring
**Status:** Not started  
**Location:** Agent-learning service  
**Description:** Add a churn flag metric (e.g., prolonged inactivity, negative feedback streak) to projections and emit alerts when thresholds trip so owners can intervene.  

**Next Steps:**
- [ ] Define churn criteria (inactive > X days, sentiment < threshold, etc.)
- [ ] Compute flag inside RLHF projections
- [ ] Emit alert/log event for dashboards or notifications

### Authentication & User Persistence Issue
**Status:** Needs investigation  
**Location:** All services with user-dependent routes  
**Issue:** When Skaffold restarts, user databases start from scratch (data is lost), but JWT tokens remain valid. This causes:
- Client can still explore the app (token is valid)
- Some routes return 404 because user doesn't exist in DB
- User lookup fails silently or returns NotFoundError
- Inconsistent behavior across services

**Current Behavior:**
- JWT tokens persist across restarts (stored client-side)
- User database is ephemeral (resets on restart)
- Services check for user existence and throw NotFoundError if missing
- Client sees 404 errors on routes that require user lookup

**Impact:**
- Users can't access their data after restart
- Confusing error messages (404 instead of auth error)
- Need to re-register/login after every restart

**Potential Solutions:**
- [ ] Add user persistence (persistent volumes for MongoDB)
- [ ] Improve error handling: return 401 Unauthorized instead of 404 when user doesn't exist
- [ ] Add token validation that checks user existence
- [ ] Implement graceful degradation: clear client token when user not found
- [ ] Add startup script to seed default users for development
- [ ] Consider using persistent storage for development databases

**Related Files:**
- All service routes that perform `User.findById()` checks
- JWT middleware (`extractJWTPayload`, `loginRequired`)
- Client auth store

### Mobile App - Age Field Input Issue (iOS)
**Status:** Minor issue, workaround exists  
**Location:** Client mobile app form  
**Issue:** On iPhone, the age field sometimes doesn't accept input until the app is reloaded. Other form fields work fine.

**Current Behavior:**
- Age field appears but doesn't respond to input
- Reloading the app fixes the issue
- Other fields (name, email, etc.) work normally

**Workaround:**
- Reload the app when age field doesn't respond

**Next Steps:**
- [ ] Investigate form state management for age field
- [ ] Check if there's a keyboard/input focus issue specific to iOS
- [ ] Review validation or state management logic for numeric inputs
- [ ] Test on different iOS versions/devices

**Related Files:**
- Client mobile app form components (likely in agent creation/profile forms)

## Chat Recommendation - Utility Features

### ⭐ Next Steps

Do you want me to:

A) Provide a full list of utilities for Phase 1, 2, and 3?
B) Design the Utility Execution Module inside AI-Chat-Host?
C) Add utilities to Recommendation Service API & scoring logic?
D) Provide UI mocks showing utilities in the chat?

