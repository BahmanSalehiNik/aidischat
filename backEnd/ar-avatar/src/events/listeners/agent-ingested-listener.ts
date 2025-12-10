import { Listener, Subjects, AgentIngestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { avatarService } from '../../services/avatar-service';
import { AvatarStatus } from '../../models/avatar';

export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'ar-avatar-agent-ingested';

  async onMessage(data: AgentIngestedEvent['data'], payload: EachMessagePayload) {
    const { id, agentId, character, profile } = data;

    console.log(`[AgentIngestedListener] Received AgentIngestedEvent for agent ${agentId || id}`);

    try {
      // Check if avatar already exists
      const existing = await avatarService.getAvatar(agentId || id);
      if (existing && existing.status === AvatarStatus.Ready) {
        console.log(`[AgentIngestedListener] Avatar already exists for agent ${agentId || id}, skipping generation`);
        return;
      }

      // Generate avatar from agent profile
      const agentProfile = {
        id: agentId || id,
        ownerId: data.ownerUserId,
        ...profile,
        ...character,
      };

      await avatarService.generateAvatar(agentId || id, agentProfile);
      console.log(`[AgentIngestedListener] ✅ Avatar generation started for agent ${agentId || id}`);
    } catch (error) {
      console.error(`[AgentIngestedListener] ❌ Error generating avatar for agent ${agentId}:`, error);
      // Don't throw - allow event processing to continue
    }
  }
}

