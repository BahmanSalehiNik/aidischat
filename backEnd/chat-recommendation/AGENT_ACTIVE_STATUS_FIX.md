# Agent Active Status Fix

## Problem

Previously, agents were marked as `isActive: true` immediately when `AgentIngestedEvent` was received, even though the agent hadn't been successfully provisioned by the AI provider yet. This meant we could recommend agents that:
- Failed to be created by the AI provider
- Were still in the provisioning process
- Were deleted

## Root Cause

The agent lifecycle flow is:
1. **AgentIngestedEvent** - Published when agent is created (BEFORE provisioning)
2. **AgentCreationReplySuccessEvent** → **AgentCreatedEvent** - Published when provisioning succeeds
3. **AgentCreationReplyFailedEvent** → **AgentCreationFailedEvent** - Published when provisioning fails
4. **AgentDeletedEvent** - Published when agent is deleted

We were marking agents as active at step 1, but they're only truly active after step 2.

## Solution

### 1. AgentIngestedListener
- **Before**: Set `isActive: true` immediately
- **After**: Set `isActive: false` initially (agent is ingested but not yet provisioned)

### 2. AgentCreatedListener
- **Before**: Created minimal entry with `isActive: true` or didn't update existing
- **After**: 
  - If agent features exist: Update `isActive: true` (provisioning succeeded)
  - If agent features don't exist: Create minimal entry with `isActive: true`

### 3. AgentCreationFailedListener (NEW)
- Listens to `AgentCreationFailedEvent`
- Sets `isActive: false` when provisioning fails
- Ensures failed agents are never recommended

### 4. AgentDeletedListener (NEW)
- Listens to `AgentDeletedEvent`
- Sets `isActive: false` when agent is deleted
- Ensures deleted agents are never recommended

## Agent Matching Filter

The `AgentMatcher.getCandidateAgents()` method already filters by `isActive: true`:

```typescript
const query: any = {
  isActive: true,  // Only recommend active agents
  isPublic: true,
};
```

This ensures that only agents with `isActive: true` are considered for recommendations.

## Event Flow

```
Agent Created
    ↓
AgentIngestedEvent → isActive: false (not ready yet)
    ↓
Provisioning with AI Provider
    ↓
    ├─→ Success: AgentCreatedEvent → isActive: true ✅ (ready to recommend)
    │
    └─→ Failed: AgentCreationFailedEvent → isActive: false ❌ (never recommend)
```

## Benefits

1. ✅ **No failed agents recommended**: Agents that fail provisioning are marked inactive
2. ✅ **No deleted agents recommended**: Deleted agents are marked inactive
3. ✅ **Accurate status**: Agent status reflects actual provisioning state
4. ✅ **Better UX**: Users only see agents that are actually ready to use

## Testing

To verify the fix works:
1. Create an agent → Should be `isActive: false` initially
2. Wait for provisioning success → Should become `isActive: true`
3. If provisioning fails → Should remain `isActive: false`
4. Delete an agent → Should become `isActive: false`
5. Only agents with `isActive: true` should appear in recommendations

