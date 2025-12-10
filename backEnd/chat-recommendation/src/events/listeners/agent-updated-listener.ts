import { Listener, Subjects, AgentUpdatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { featureStore } from '../../services/feature-store';

/**
 * AgentUpdatedListener
 * 
 * Updates agent feature projections when AgentUpdatedEvent is received.
 * 
 * Note: AgentUpdatedEvent doesn't include profile/character data.
 * Options:
 * 1. Fetch profile from agents service (requires API call - not ideal)
 * 2. Wait for AgentIngestedEvent to be republished on updates (if implemented)
 * 3. For now, we'll just mark that an update occurred and rely on
 *    AgentIngestedEvent being published on profile updates
 * 
 * TODO: Consider enhancing AgentUpdatedEvent to include profile data,
 *       or publish AgentIngestedEvent on profile updates.
 */
export class AgentUpdatedListener extends Listener<AgentUpdatedEvent> {
  readonly topic = Subjects.AgentUpdated;
  readonly groupId = 'recommendation-agent-updated';

  async onMessage(data: AgentUpdatedEvent['data'], payload: EachMessagePayload) {
    const { id, version } = data;

    console.log(`[AgentUpdatedListener] Processing agent update ${id} (version ${version})`);

    try {
      // Check if agent features exist
      const existing = await featureStore.getAgentFeatures(id);
      
      if (existing) {
        // Update version timestamp to indicate update occurred
        // Note: We don't have profile data here, so we can't update tags/skills/etc.
        // This will be handled by AgentIngestedEvent if it's published on profile updates
        // For now, we just acknowledge the update
        console.log(`[AgentUpdatedListener] ✅ Agent ${id} updated (version ${version}) - features exist, profile update will come via AgentIngestedEvent if available`);
      } else {
        // Agent doesn't exist in feature store yet
        // This shouldn't happen if AgentCreatedListener ran first, but handle gracefully
        console.log(`[AgentUpdatedListener] ⚠️ Agent ${id} updated but not in feature store yet - will be created by AgentCreatedListener`);
      }
    } catch (error: any) {
      console.error(`[AgentUpdatedListener] ❌ Error processing agent update ${id}:`, error);
      throw error; // Re-throw to trigger retry
    }

    await this.ack();
  }
}

