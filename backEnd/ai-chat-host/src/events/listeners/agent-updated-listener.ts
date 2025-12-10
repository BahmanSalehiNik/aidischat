import { Listener, Subjects, AgentUpdatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { AgentProjection } from '../../models/agent-projection';

/**
 * Listens to AgentUpdatedEvent to update agent projections
 */
export class AgentUpdatedListener extends Listener<AgentUpdatedEvent> {
  readonly topic = Subjects.AgentUpdated;
  readonly groupId = 'ai-chat-host-agent-updated';

  async onMessage(data: AgentUpdatedEvent['data'], payload: EachMessagePayload) {
    const { id } = data;

    console.log(`[AgentUpdatedListener] Agent ${id} updated - marking projection for refresh`);

    try {
      // Note: AgentUpdatedEvent doesn't include full profile data
      // We'll mark the projection as needing refresh, or wait for next AgentIngestedEvent
      // For now, we'll just update the lastUpdatedAt timestamp
      const projection = await AgentProjection.findOne({ agentId: id });
      if (projection) {
        projection.lastUpdatedAt = new Date();
        await projection.save();
        console.log(`[AgentUpdatedListener] ✅ Updated timestamp for agent projection ${id}`);
      } else {
        console.log(`[AgentUpdatedListener] No projection found for agent ${id}, will be created on next AgentIngestedEvent`);
      }
    } catch (error: any) {
      console.error(`[AgentUpdatedListener] ❌ Error processing agent update ${id}:`, error);
      // Don't throw - this is not critical
    }

    await this.ack();
  }
}

