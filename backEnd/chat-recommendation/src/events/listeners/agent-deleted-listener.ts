import { Listener, Subjects, AgentDeletedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';
import { AgentProvisioningStatus } from '../../models/agent-feature';

/**
 * AgentDeletedListener
 * 
 * Handles AgentDeletedEvent - marks agent as inactive when deleted
 * This ensures we don't recommend deleted agents
 */
export class AgentDeletedListener extends Listener<AgentDeletedEvent> {
  readonly topic = Subjects.AgentDeleted;
  readonly groupId = 'recommendation-agent-deleted';

  async onMessage(data: AgentDeletedEvent['data'], payload: EachMessagePayload) {
    const { id } = data;

    console.log(`[AgentDeletedListener] Processing agent ${id} - deleted`);

    try {
      // Mark agent as Failed - agent was deleted (can't be recommended)
      await featureStore.updateAgentFeatures(id, {
        isActive: false, // Deprecated: Use provisioningStatus
        provisioningStatus: AgentProvisioningStatus.Failed, // CRITICAL: Mark as Failed - agent was deleted
      });

      console.log(`[AgentDeletedListener] ✅ Marked agent ${id} as Failed (deleted)`);
    } catch (error: any) {
      console.error(`[AgentDeletedListener] ❌ Error processing agent ${id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

