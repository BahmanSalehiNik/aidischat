import { Listener, Subjects, AgentCreatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';
import { AgentProvisioningStatus } from '../../models/agent-feature';

/**
 * AgentCreatedListener
 * 
 * Builds agent feature projections from AgentCreatedEvent
 * Note: AgentCreatedEvent doesn't include profile/character data,
 * so we initialize with minimal data and wait for AgentIngestedEvent
 * or fetch profile data separately.
 * 
 * For now, we'll create a placeholder entry that will be updated
 * when AgentIngestedEvent arrives (which has full profile data).
 */
export class AgentCreatedListener extends Listener<AgentCreatedEvent> {
  readonly topic = Subjects.AgentCreated;
  readonly groupId = 'recommendation-agent-created';

  async onMessage(data: AgentCreatedEvent['data'], payload: EachMessagePayload) {
    const { id, ownerUserId, version } = data;

    console.log(`[AgentCreatedListener] Processing agent ${id} for feature store`);

    try {
      // AgentCreatedEvent doesn't have profile/character data
      // We'll create a minimal entry that will be updated by AgentIngestedEvent
      // or we could fetch from agents service (but that requires API call)
      
      // For now, check if agent features already exist (from AgentIngestedEvent)
      // If not, create minimal entry
      const existing = await featureStore.getAgentFeatures(id);
      
      // AgentCreatedEvent is published AFTER successful provisioning
      // This means the agent is now Active and ready to be recommended
      if (!existing) {
        // Create minimal entry - will be updated by AgentIngestedEvent
        await featureStore.updateAgentFeatures(id, {
          agentId: id,
          name: 'Unknown Agent',
          tags: [],
          skills: [],
          popularity: 0,
          rating: 0,
          isActive: true, // Deprecated: Use provisioningStatus
          provisioningStatus: AgentProvisioningStatus.Active, // CRITICAL: Successfully provisioned
          isPublic: false, // Default to false until we know
          language: 'en',
        });

        console.log(`[AgentCreatedListener] ✅ Created minimal agent features for ${id} (will be updated by AgentIngestedEvent)`);
      } else {
        // Update existing entry to mark as Active (provisioning succeeded)
        await featureStore.updateAgentFeatures(id, {
          isActive: true, // Deprecated: Use provisioningStatus
          provisioningStatus: AgentProvisioningStatus.Active, // CRITICAL: Mark as Active now that provisioning succeeded
        });
        console.log(`[AgentCreatedListener] ✅ Marked agent ${id} as Active (provisioning succeeded)`);
      }
    } catch (error: any) {
      console.error(`[AgentCreatedListener] ❌ Error processing agent ${id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

