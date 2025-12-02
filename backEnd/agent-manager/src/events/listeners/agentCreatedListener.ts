import { Listener, Subjects, AgentCreatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { Agent, AgentProvisioningStatus } from '../../models/agent';

export class AgentCreatedListener extends Listener<AgentCreatedEvent> {
  readonly topic = Subjects.AgentCreated;
  readonly groupId = 'agent-manager-agent-created';

  async onMessage(data: AgentCreatedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentCreatedListener] Agent created event received: ${data.id}`);

    try {
      const existing = await Agent.findById(data.id);
      
      if (existing) {
        // Update existing agent
        existing.ownerUserId = data.ownerUserId;
        existing.version = data.version;
        existing.status = AgentProvisioningStatus.Active;
        existing.provider = data.provider;
        existing.providerAgentId = data.providerAgentId;
        if (data.metadata) {
          // Store any additional metadata if needed
        }
        await existing.save();
        console.log(`[AgentCreatedListener] Updated existing agent: ${data.id}`);
      } else {
        // Create new agent projection
        const agent = Agent.build({
          id: data.id,
          ownerUserId: data.ownerUserId,
          version: data.version,
          status: AgentProvisioningStatus.Active,
          provider: data.provider,
          providerAgentId: data.providerAgentId,
          provisioningCorrelationId: data.correlationId,
          provisionedAt: new Date(),
        });
        await agent.save();
        console.log(`[AgentCreatedListener] Created new agent projection: ${data.id}`);
      }

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentCreatedListener] Error processing agent created event:`, error);
      throw error;
    }
  }
}

