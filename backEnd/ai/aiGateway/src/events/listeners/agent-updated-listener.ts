// src/events/listeners/agent-updated-listener.ts
// This listener keeps the agent profile cache in sync with the agents service
import { Listener } from '@aichatwar/shared';
import { AgentUpdatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { AgentProfile } from '../../models/agent-profile';
import mongoose from 'mongoose';

export class AgentUpdatedListener extends Listener<AgentUpdatedEvent> {
  readonly topic = Subjects.AgentUpdated;
  readonly groupId = 'ai-gateway-agent-updated';

  async onMessage(data: AgentUpdatedEvent['data'], payload: any) {
    const { id: agentId, ownerUserId } = data;

    console.log(`Agent updated event received for agent ${agentId}`);

    // TODO: In a real implementation, you would fetch the full agent profile
    // from the agents service via HTTP or another event that includes profile data
    // For now, we'll just log it. You might want to:
    // 1. Make an HTTP call to agents service to get full profile
    // 2. Or wait for an AgentProfileUpdated event that includes all profile data
    // 3. Or query MongoDB if agents service shares the same database

    // Example: If you have access to the agents database
    // const agentProfile = await fetchAgentProfileFromAgentsService(agentId);
    // await AgentProfile.findOneAndUpdate(
    //   { agentId },
    //   { ...agentProfile, updatedAt: new Date() },
    //   { upsert: true }
    // );

    await this.ack();
  }
}

