import { Listener, Subjects, AgentCreationFailedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';
import { AgentProvisioningStatus } from '../../models/agent-feature';

/**
 * AgentCreationFailedListener
 * 
 * Handles AgentCreationFailedEvent - marks agent as inactive when provisioning fails
 * This ensures we don't recommend agents that failed to be created by the AI provider
 */
export class AgentCreationFailedListener extends Listener<AgentCreationFailedEvent> {
  readonly topic = Subjects.AgentCreationFailed;
  readonly groupId = 'recommendation-agent-creation-failed';

  async onMessage(data: AgentCreationFailedEvent['data'], payload: EachMessagePayload) {
    const { id, agentId, reason } = data;

    console.log(`[AgentCreationFailedListener] Processing agent ${agentId || id} - provisioning failed: ${reason}`);

    try {
      // Mark agent as Failed - provisioning failed, so agent is not ready
      await featureStore.updateAgentFeatures(agentId || id, {
        isActive: false, // Deprecated: Use provisioningStatus
        provisioningStatus: AgentProvisioningStatus.Failed, // CRITICAL: Mark as Failed - agent provisioning failed
      });

      console.log(`[AgentCreationFailedListener] ✅ Marked agent ${agentId || id} as Failed (provisioning failed)`);
    } catch (error: any) {
      console.error(`[AgentCreationFailedListener] ❌ Error processing agent ${agentId || id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

