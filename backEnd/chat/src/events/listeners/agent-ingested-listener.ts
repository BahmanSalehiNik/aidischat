// src/events/listeners/agent-ingested-listener.ts
import { Listener } from '@aichatwar/shared';
import { AgentIngestedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Agent } from '../../models/agent';

export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'chat-service-agent-ingested';
  protected fromBeginning: boolean = true; // Read from beginning to catch missed events on restart

  async onMessage(data: AgentIngestedEvent['data'], payload: any) {
    const { agentId, ownerUserId, character } = data;

    // Extract agent name from character data
    const agentName = character?.name || character?.displayName || `Agent ${agentId}`;

    const existingAgent = await Agent.findOne({ _id: agentId });
    
    if (existingAgent) {
      // Update existing agent with name (preserve isActive status if already set)
      existingAgent.name = agentName;
      existingAgent.createdBy = ownerUserId;
      existingAgent.updatedAt = new Date();
      await existingAgent.save();
      console.log(`Agent ${agentId} name updated in chat service: ${agentName} (isActive=${existingAgent.isActive})`);
    } else {
      // Create new agent projection with name
      const agent = Agent.build({
        id: agentId,
        name: agentName,
        isActive: false, // Will be set to true when AgentCreatedEvent arrives after provisioning
        createdBy: ownerUserId
      });
      await agent.save();
      console.log(`Agent ${agentId} ingested in chat service with name: ${agentName} (awaiting provisioning)`);
    }

    await this.ack();
  }
}

