import { Listener, Subjects, EachMessagePayload } from '@aichatwar/shared';
import {
  ModerationAgentSuspendedEvent,
  ModerationAgentMutedEvent,
  ModerationAgentForceLeaveRoomEvent,
  ModerationContentBlockedEvent,
} from '@aichatwar/shared';
import { safetyEnforcer } from '../safetyEnforcer';

export class ModerationAgentSuspendedListener extends Listener<ModerationAgentSuspendedEvent> {
  readonly topic = Subjects.ModerationAgentSuspended;
  readonly groupId = 'agent-manager-moderation-agent-suspended';

  async onMessage(data: ModerationAgentSuspendedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[ModerationAgentSuspendedListener] Agent ${data.agentId} suspended for ${data.duration} hours`);

    try {
      await safetyEnforcer.handleSuspension({
        agentId: data.agentId,
        duration: data.duration,
        reason: data.reason,
        appliedBy: data.appliedBy,
      });

      await this.ack();
    } catch (error: any) {
      console.error(`[ModerationAgentSuspendedListener] Error handling suspension:`, error);
      throw error;
    }
  }
}

export class ModerationAgentMutedListener extends Listener<ModerationAgentMutedEvent> {
  readonly topic = Subjects.ModerationAgentMuted;
  readonly groupId = 'agent-manager-moderation-agent-muted';

  async onMessage(data: ModerationAgentMutedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[ModerationAgentMutedListener] Agent ${data.agentId} muted for ${data.duration} hours`);

    try {
      await safetyEnforcer.handleMute({
        agentId: data.agentId,
        duration: data.duration,
        reason: data.reason,
        appliedBy: data.appliedBy,
      });

      await this.ack();
    } catch (error: any) {
      console.error(`[ModerationAgentMutedListener] Error handling mute:`, error);
      throw error;
    }
  }
}

export class ModerationAgentForceLeaveRoomListener extends Listener<ModerationAgentForceLeaveRoomEvent> {
  readonly topic = Subjects.ModerationAgentForceLeaveRoom;
  readonly groupId = 'agent-manager-moderation-agent-force-leave-room';

  async onMessage(data: ModerationAgentForceLeaveRoomEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[ModerationAgentForceLeaveRoomListener] Agent ${data.agentId} forced to leave room ${data.roomId}`);

    try {
      await safetyEnforcer.handleForceLeaveRoom({
        agentId: data.agentId,
        roomId: data.roomId,
        reason: data.reason,
        appliedBy: data.appliedBy,
      });

      await this.ack();
    } catch (error: any) {
      console.error(`[ModerationAgentForceLeaveRoomListener] Error handling force leave:`, error);
      throw error;
    }
  }
}

export class ModerationContentBlockedListener extends Listener<ModerationContentBlockedEvent> {
  readonly topic = Subjects.ModerationContentBlocked;
  readonly groupId = 'agent-manager-moderation-content-blocked';

  async onMessage(data: ModerationContentBlockedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[ModerationContentBlockedListener] Content ${data.contentId} blocked for agent ${data.agentId}`);

    try {
      await safetyEnforcer.handleContentBlocked({
        agentId: data.agentId,
        contentId: data.contentId,
        contentType: data.contentType,
        reason: data.reason,
        appliedBy: data.appliedBy,
      });

      // If it's a draft, reject it
      if (data.contentType === 'draft') {
        // TODO: Reject draft via DraftHandler
        // This will be handled when we add the listener for draft rejection
      }

      await this.ack();
    } catch (error: any) {
      console.error(`[ModerationContentBlockedListener] Error handling content blocked:`, error);
      throw error;
    }
  }
}

