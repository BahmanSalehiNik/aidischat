# Event Listener Strategy for Agent Features

## Problem Statement

The recommendation service needs to build and maintain agent feature projections. We need to decide which events to listen to for building these projections.

## Available Events

### 1. AgentIngestedEvent
- **Published**: When agent is created (in `createAgent.ts`)
- **Data**: ✅ **Full profile/character data** (name, tags, skills, interests, etc.)
- **Limitation**: Only published on creation, not on updates

### 2. AgentCreatedEvent
- **Published**: After agent is provisioned by AI provider (in `agentProvisionListeners.ts`)
- **Data**: ❌ **No profile/character data** (only id, ownerUserId, version, provider info)
- **Use case**: Lifecycle tracking (agent is ready)

### 3. AgentUpdatedEvent
- **Published**: When agent is updated (in `updateAgent.ts`)
- **Data**: ❌ **No profile/character data** (only id, ownerUserId, version)
- **Use case**: Lifecycle tracking (agent was updated)
- **Note**: Profile updates in `updateAgent.ts` don't trigger an event with profile data

## Current Strategy

We listen to **all three events** for different purposes:

1. **AgentIngestedListener**: 
   - Primary source for full profile/character data
   - Builds complete agent feature projections
   - Only fires on creation

2. **AgentCreatedListener**:
   - Handles agent lifecycle (provisioned)
   - Creates minimal placeholder if features don't exist yet
   - Will be updated by AgentIngestedEvent when it arrives

3. **AgentUpdatedListener**:
   - Tracks agent updates
   - Acknowledges updates but can't update features (no profile data)
   - Relies on AgentIngestedEvent being republished on profile updates (if implemented)

## Limitations

### Issue: Profile Updates Don't Include Profile Data

When agent profile is updated:
- `updateAgent.ts` publishes `AgentUpdatedEvent` (no profile data)
- `updateAgentProfile.ts` doesn't publish any event

**Result**: Profile updates won't be reflected in feature store unless:
1. `AgentIngestedEvent` is republished on profile updates, OR
2. `AgentUpdatedEvent` is enhanced to include profile data, OR
3. A new `AgentProfileUpdatedEvent` is created

## Recommended Solution

### Option 1: Enhance AgentUpdatedEvent (Recommended)
Modify `AgentUpdatedEvent` in `agents` service to include profile/character data when profile is updated:

```typescript
interface AgentUpdatedEvent {
  subject: Subjects.AgentUpdated;
  data: {
    id: string;
    ownerUserId: string;
    version: number;
    character?: { ... };  // Include when profile is updated
    profile?: { ... };     // Include when profile is updated
  };
}
```

### Option 2: Republish AgentIngestedEvent on Profile Updates
When profile is updated in `updateAgent.ts` or `updateAgentProfile.ts`, republish `AgentIngestedEvent` with updated data.

### Option 3: Create AgentProfileUpdatedEvent
Create a new event specifically for profile updates with full profile data.

## Current Implementation

For now, we:
- ✅ Listen to `AgentIngestedEvent` for full data on creation
- ✅ Listen to `AgentCreatedEvent` for lifecycle tracking
- ✅ Listen to `AgentUpdatedEvent` for lifecycle tracking
- ⚠️ **Note**: Profile updates won't be reflected until one of the solutions above is implemented

## Future Enhancement

Consider implementing Option 1 (enhance AgentUpdatedEvent) to ensure feature projections stay up-to-date when profiles are updated.

