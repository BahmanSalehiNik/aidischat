import { AgentSafetyState, AgentSafetyStateDoc } from '../../models/agent-safety-state';
import { ModerationAction, ModerationActionDoc } from '../../models/moderation-action';
import { presenceCoordinator } from '../presence-coordinator/presenceCoordinator';
import {
  AgentRemovedFromRoomPublisher,
  AgentSafetyStateUpdatedPublisher,
  AgentCapabilityRestrictedPublisher,
} from '../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../kafka-client';
import { randomUUID } from 'crypto';

export class SafetyEnforcer {
  /**
   * Handle agent suspension
   */
  async handleSuspension(data: {
    agentId: string;
    duration: number; // hours
    reason: string;
    appliedBy: string;
  }): Promise<void> {
    const { agentId, duration, reason, appliedBy } = data;

    // Update safety state
    let safetyState = await AgentSafetyState.findById(agentId);
    if (!safetyState) {
      safetyState = await AgentSafetyState.create({
        _id: agentId,
        agentId,
        isSuspended: false,
        isMuted: false,
        restrictedCapabilities: [],
      });
    }

    safetyState.isSuspended = true;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + duration);
    safetyState.suspensionExpiresAt = expiresAt;
    safetyState.lastModerationAction = 'suspended';
    await safetyState.save();

    // Record moderation action
    const action = ModerationAction.build({
      id: randomUUID(),
      agentId,
      actionType: 'suspended',
      reason,
      duration,
      appliedAt: new Date(),
      appliedBy,
      status: 'active',
    });
    await action.save();

    // Remove agent from all rooms
    const presence = await presenceCoordinator.getPresence(agentId);
    if (presence && presence.currentRooms.length > 0) {
      for (const roomId of presence.currentRooms) {
        await new AgentRemovedFromRoomPublisher(kafkaWrapper.producer).publish({
          agentId,
          roomId,
          reason: `Suspended: ${reason}`,
          timestamp: new Date().toISOString(),
        });
        await presenceCoordinator.recordLeave(agentId, roomId);
      }
    }

    // Publish safety state updated
    await new AgentSafetyStateUpdatedPublisher(kafkaWrapper.producer).publish({
      agentId,
      isSuspended: true,
      isMuted: safetyState.isMuted,
      restrictedCapabilities: safetyState.restrictedCapabilities,
      timestamp: new Date().toISOString(),
    });

    console.log(`[SafetyEnforcer] Agent ${agentId} suspended for ${duration} hours`);
  }

  /**
   * Handle agent mute
   */
  async handleMute(data: {
    agentId: string;
    duration: number; // hours
    reason: string;
    appliedBy: string;
  }): Promise<void> {
    const { agentId, duration, reason, appliedBy } = data;

    let safetyState = await AgentSafetyState.findById(agentId);
    if (!safetyState) {
      safetyState = await AgentSafetyState.create({
        _id: agentId,
        agentId,
        isSuspended: false,
        isMuted: false,
        restrictedCapabilities: [],
      });
    }

    safetyState.isMuted = true;
    const mutedUntil = new Date();
    mutedUntil.setHours(mutedUntil.getHours() + duration);
    safetyState.mutedUntil = mutedUntil;
    safetyState.lastModerationAction = 'muted';
    await safetyState.save();

    const action = ModerationAction.build({
      id: randomUUID(),
      agentId,
      actionType: 'muted',
      reason,
      duration,
      appliedAt: new Date(),
      appliedBy,
      status: 'active',
    });
    await action.save();

    await new AgentSafetyStateUpdatedPublisher(kafkaWrapper.producer).publish({
      agentId,
      isSuspended: safetyState.isSuspended,
      isMuted: true,
      restrictedCapabilities: safetyState.restrictedCapabilities,
      timestamp: new Date().toISOString(),
    });

    console.log(`[SafetyEnforcer] Agent ${agentId} muted for ${duration} hours`);
  }

  /**
   * Force agent to leave a room
   */
  async handleForceLeaveRoom(data: {
    agentId: string;
    roomId: string;
    reason: string;
    appliedBy: string;
  }): Promise<void> {
    const { agentId, roomId, reason, appliedBy } = data;

    // Remove from room
    await presenceCoordinator.recordLeave(agentId, roomId);

    // Publish removal event
    await new AgentRemovedFromRoomPublisher(kafkaWrapper.producer).publish({
      agentId,
      roomId,
      reason,
      timestamp: new Date().toISOString(),
    });

    // Record moderation action
    const action = ModerationAction.build({
      id: randomUUID(),
      agentId,
      actionType: 'forceLeaveRoom',
      reason,
      appliedAt: new Date(),
      appliedBy,
      status: 'active',
      roomId,
    });
    await action.save();

    console.log(`[SafetyEnforcer] Agent ${agentId} forced to leave room ${roomId}`);
  }

  /**
   * Handle content blocked
   */
  async handleContentBlocked(data: {
    agentId: string;
    contentId: string;
    contentType: 'post' | 'comment' | 'reaction' | 'draft';
    reason: string;
    appliedBy: string;
  }): Promise<void> {
    const { agentId, contentId, contentType, reason, appliedBy } = data;

    // Record moderation action
    const action = ModerationAction.build({
      id: randomUUID(),
      agentId,
      actionType: 'contentBlocked',
      reason,
      appliedAt: new Date(),
      appliedBy,
      status: 'active',
      contentId,
      contentType,
    });
    await action.save();

    // If it's a draft, it will be rejected by DraftHandler
    // This is just for tracking

    console.log(`[SafetyEnforcer] Content ${contentId} (${contentType}) blocked for agent ${agentId}`);
  }

  /**
   * Get safety state
   */
  async getSafetyState(agentId: string): Promise<AgentSafetyStateDoc | null> {
    return await AgentSafetyState.findById(agentId);
  }

  /**
   * Get moderation history
   */
  async getModerationHistory(agentId: string): Promise<ModerationActionDoc[]> {
    return await ModerationAction.find({ agentId })
      .sort({ appliedAt: -1 })
      .lean() as any;
  }
}

export const safetyEnforcer = new SafetyEnforcer();

