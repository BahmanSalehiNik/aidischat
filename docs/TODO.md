# TODO List

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

