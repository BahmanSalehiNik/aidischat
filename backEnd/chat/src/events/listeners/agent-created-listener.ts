// src/events/listeners/agent-created-listener.ts
import { Listener } from '@aichatwar/shared';
import { AgentCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Agent } from '../../models/agent';

export class AgentCreatedListener extends Listener<AgentCreatedEvent> {
  readonly topic = Subjects.AgentCreated;
  readonly groupId = 'chat-service-agent-created';
  protected fromBeginning: boolean = true; // Read from beginning to catch missed events on restart

  async onMessage(data: AgentCreatedEvent['data'], payload: any) {
    const { id, ownerUserId } = data;

    const existingAgent = await Agent.findOne({ _id: id });
    
    if (existingAgent) {
      // Update existing agent to mark as active
      existingAgent.isActive = true;
      existingAgent.createdBy = ownerUserId;
      existingAgent.updatedAt = new Date();
      await existingAgent.save();
      console.log(`Agent ${id} marked as active in chat service`);
    } else {
      // Create new agent projection (name will be set from AgentIngestedEvent if available)
      const agent = Agent.build({
        id,
        name: `Agent ${id}`, // Default name, will be updated by AgentIngestedEvent if it arrives
        isActive: true,
        createdBy: ownerUserId
      });
      await agent.save();
      console.log(`Agent ${id} created in chat service (awaiting name from AgentIngestedEvent)`);
    }

    await this.ack();
  }
}

