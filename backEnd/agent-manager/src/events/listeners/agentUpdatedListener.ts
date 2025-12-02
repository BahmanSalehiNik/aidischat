import { Listener, Subjects, AgentUpdatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { Agent } from '../../models/agent';

export class AgentUpdatedListener extends Listener<AgentUpdatedEvent> {
  readonly topic = Subjects.AgentUpdated;
  readonly groupId = 'agent-manager-agent-updated';

  async onMessage(data: AgentUpdatedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentUpdatedListener] Agent updated event received: ${data.id}`);

    try {
      const agent = await Agent.findById(data.id);
      
      if (!agent) {
        console.warn(`[AgentUpdatedListener] Agent ${data.id} not found, skipping update`);
        await this.ack();
        return;
      }

      // Update version
      agent.version = data.version;
      await agent.save();
      console.log(`[AgentUpdatedListener] Updated agent: ${data.id} to version ${data.version}`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentUpdatedListener] Error processing agent updated event:`, error);
      throw error;
    }
  }
}

