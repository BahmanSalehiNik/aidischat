import { Listener, Subjects, EachMessagePayload } from '@aichatwar/shared';
import { AgentInviteOwnerApprovedEvent } from '@aichatwar/shared';
import { presenceCoordinator } from '../presenceCoordinator';
import {
  AgentJoinRequestPublisher,
  AgentPresenceUpdatedPublisher,
} from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';

export class AgentInviteOwnerApprovedListener extends Listener<AgentInviteOwnerApprovedEvent> {
  readonly topic = Subjects.AgentInviteOwnerApproved;
  readonly groupId = 'agent-manager-agent-invite-owner-approved';

  async onMessage(data: AgentInviteOwnerApprovedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentInviteOwnerApprovedListener] Owner approved invitation for agent ${data.agentId} to room ${data.roomId}`);

    try {
      // Publish join request
      await new AgentJoinRequestPublisher(kafkaWrapper.producer).publish({
        agentId: data.agentId,
        roomId: data.roomId,
        timestamp: new Date().toISOString(),
      });

      // Update presence state
      await presenceCoordinator.recordJoin(data.agentId, data.roomId, 0);

      // Publish presence updated
      const presence = await presenceCoordinator.getPresence(data.agentId);
      if (presence) {
        await new AgentPresenceUpdatedPublisher(kafkaWrapper.producer).publish({
          agentId: data.agentId,
          currentRooms: presence.currentRooms,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`[AgentInviteOwnerApprovedListener] Agent ${data.agentId} approved to join room ${data.roomId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[AgentInviteOwnerApprovedListener] Error processing approval:`, error);
      throw error;
    }
  }
}

