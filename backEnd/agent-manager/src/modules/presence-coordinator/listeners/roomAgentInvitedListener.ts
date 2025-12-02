import { Listener, Subjects, EachMessagePayload } from '@aichatwar/shared';
import { RoomAgentInvitedEvent } from '@aichatwar/shared';
import { presenceCoordinator } from '../presenceCoordinator';
import {
  AgentJoinRequestPublisher,
  AgentInviteOwnerApprovalRequiredPublisher,
  AgentPresenceUpdatedPublisher,
} from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';
import { randomUUID } from 'crypto';

export class RoomAgentInvitedListener extends Listener<RoomAgentInvitedEvent> {
  readonly topic = Subjects.RoomAgentInvited;
  readonly groupId = 'agent-manager-room-agent-invited';

  async onMessage(data: RoomAgentInvitedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[RoomAgentInvitedListener] Agent ${data.agentId} invited to room ${data.roomId} by ${data.invitedBy}`);

    try {
      // Get agent to check invitation policy
      const { Agent } = await import('../../../models/agent');
      const agent = await Agent.findById(data.agentId);
      
      // Default policy - TODO: Store invitationPolicy in Agent model or fetch from AgentProfile
      // For now, use default policy
      const decision = await presenceCoordinator.evaluateInvitation({
        agentId: data.agentId,
        roomId: data.roomId,
        invitedBy: data.invitedBy,
        source: 'users', // Default, should be determined from event or agent policy
      });

      if (!decision.allowed) {
        console.log(`[RoomAgentInvitedListener] Invitation declined: ${decision.reason}`);
        await this.ack();
        return;
      }

      if (decision.requiresApproval) {
        // Request owner approval
        const invitationId = randomUUID();
        // Get ownerUserId from agent or user projection
        const { Agent } = await import('../../../models/agent');
        const agent = await Agent.findById(data.agentId);
        const ownerUserId = agent?.ownerUserId || '';
        
        await new AgentInviteOwnerApprovalRequiredPublisher(kafkaWrapper.producer).publish({
          invitationId,
          agentId: data.agentId,
          ownerUserId,
          roomId: data.roomId,
          invitedBy: data.invitedBy,
          timestamp: new Date().toISOString(),
        });
        console.log(`[RoomAgentInvitedListener] Owner approval required for invitation ${invitationId}`);
        await this.ack();
        return;
      }

      // Auto-approve: publish join request
      await new AgentJoinRequestPublisher(kafkaWrapper.producer).publish({
        agentId: data.agentId,
        roomId: data.roomId,
        timestamp: new Date().toISOString(),
      });

      // Update presence state
      await presenceCoordinator.recordJoin(data.agentId, data.roomId, 0); // No cooldown for now

      // Publish presence updated
      const presence = await presenceCoordinator.getPresence(data.agentId);
      if (presence) {
        await new AgentPresenceUpdatedPublisher(kafkaWrapper.producer).publish({
          agentId: data.agentId,
          currentRooms: presence.currentRooms,
          timestamp: new Date().toISOString(),
        });
      }

      console.log(`[RoomAgentInvitedListener] Agent ${data.agentId} auto-approved to join room ${data.roomId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[RoomAgentInvitedListener] Error processing invitation:`, error);
      throw error;
    }
  }
}

