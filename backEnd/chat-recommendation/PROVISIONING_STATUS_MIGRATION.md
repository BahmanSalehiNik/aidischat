# Provisioning Status Migration

## Summary

Changed from using `isActive` boolean to `provisioningStatus` enum to accurately track agent provisioning state. This ensures we only recommend agents that have been successfully provisioned by the AI provider.

## Changes

### 1. AgentFeature Model
- **Added**: `provisioningStatus: AgentProvisioningStatus` field
- **Kept**: `isActive` boolean (deprecated, for backward compatibility)
- **Enum Values**: `Pending`, `Active`, `Failed`

### 2. Event Listeners

#### AgentIngestedListener
- Sets `provisioningStatus: Pending` (agent ingested but not yet provisioned)

#### AgentCreatedListener
- Sets `provisioningStatus: Active` (agent successfully provisioned)

#### AgentCreationFailedListener
- Sets `provisioningStatus: Failed` (provisioning failed)

#### AgentDeletedListener
- Sets `provisioningStatus: Failed` (agent deleted)

### 3. Agent Matching
- **Before**: Filtered by `isActive: true`
- **After**: Filters by `provisioningStatus: 'active'`

## Provisioning Status Flow

```
Agent Created
    ↓
AgentIngestedEvent → provisioningStatus: Pending
    ↓
Provisioning with AI Provider
    ↓
    ├─→ Success: AgentCreatedEvent → provisioningStatus: Active ✅
    │
    └─→ Failed: AgentCreationFailedEvent → provisioningStatus: Failed ❌
```

## Benefits

1. ✅ **Accurate Status**: Reflects actual provisioning state, not just a boolean
2. ✅ **No Failed Agents**: Only `Active` agents are recommended
3. ✅ **No Pending Agents**: Agents still provisioning are not recommended
4. ✅ **Clear State**: Three distinct states (Pending, Active, Failed) vs binary (active/inactive)

## Migration Notes

- `isActive` field is kept for backward compatibility but is deprecated
- New queries should use `provisioningStatus: 'active'`
- Old queries using `isActive: true` will still work but should be migrated

## Answer to User's Question

**Q: After how long inactivity the agent is marked as inactive?**

**A**: We don't mark agents as inactive based on inactivity time. Instead, we track the **provisioning status**:
- `Pending`: Agent is created but not yet provisioned
- `Active`: Agent is successfully provisioned and ready
- `Failed`: Agent provisioning failed or agent was deleted

We check `provisioningStatus === 'active'` to determine if an agent should be recommended, not inactivity time.

