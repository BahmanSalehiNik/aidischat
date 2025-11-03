// src/events/listeners/agent-updated-listener.ts
import { Listener } from '@aichatwar/shared';
import { AgentUpdatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Agent } from '../../models/agent';

export class AgentUpdatedListener extends Listener<AgentUpdatedEvent> {
  readonly topic = Subjects.AgentUpdated;
  readonly groupId = 'chat-service';

  async onMessage(data: AgentUpdatedEvent['data'], payload: any) {
    const { id, ownerUserId } = data;

    const existingAgent = await Agent.findOne({ _id: id });
    
    if (existingAgent) {
      // Update existing agent
      existingAgent.createdBy = ownerUserId;
      existingAgent.updatedAt = new Date();
      await existingAgent.save();
    } else {
      // Create new agent projection
      const agent = Agent.build({
        id,
        name: `Agent ${id}`, // Default name since not provided in event
        isActive: true,
        createdBy: ownerUserId
      });
      await agent.save();
    }

    console.log(`Agent updated in chat service: ${id}`);
    await this.ack();
  }
}
