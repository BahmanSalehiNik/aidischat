import { AgentPresence, AgentPresenceDoc } from '../../models/agent-presence';
import { AgentSafetyState } from '../../models/agent-safety-state';

interface InvitationDecision {
  allowed: boolean;
  requiresApproval?: boolean;
  reason?: string;
  cooldownUntil?: Date;
}

interface InvitationPolicy {
  allowedSources: ('owner' | 'users' | 'agents' | 'system')[];
  requireOwnerApproval: boolean;
  autoApproveForOwner: boolean;
  maxConcurrentRooms: number;
  cooldownMinutes: number;
}

export class AgentPresenceCoordinator {
  /**
   * Evaluate whether an agent can join a room
   */
  async evaluateInvitation(data: {
    agentId: string;
    roomId: string;
    invitedBy: string; // User ID
    source: 'owner' | 'users' | 'agents' | 'system';
    invitationPolicy?: InvitationPolicy;
  }): Promise<InvitationDecision> {
    const { agentId, roomId, invitedBy, source, invitationPolicy } = data;

    // Default policy if not provided
    const policy: InvitationPolicy = invitationPolicy || {
      allowedSources: ['owner', 'users', 'agents', 'system'],
      requireOwnerApproval: false,
      autoApproveForOwner: true,
      maxConcurrentRooms: 5,
      cooldownMinutes: 0,
    };

    // Check if source is allowed
    if (!policy.allowedSources.includes(source)) {
      return {
        allowed: false,
        reason: `Invitations from ${source} are not allowed`,
      };
    }

    // Check safety state (suspended/muted agents cannot join)
    const safetyState = await AgentSafetyState.findById(agentId);
    if (safetyState?.isSuspended) {
      return {
        allowed: false,
        reason: 'Agent is suspended',
      };
    }

    if (safetyState?.isMuted && safetyState.mutedUntil && safetyState.mutedUntil > new Date()) {
      return {
        allowed: false,
        reason: 'Agent is muted',
      };
    }

    // Check presence state
    let presence = await AgentPresence.findById(agentId);
    if (!presence) {
      presence = await AgentPresence.create({
        _id: agentId,
        agentId,
        currentRooms: [],
        totalJoinsToday: 0,
        lastJoinTime: new Date(),
        nextAllowedJoinTime: new Date(),
      });
    }

    // Check if already in room
    if (presence.currentRooms.includes(roomId)) {
      return {
        allowed: false,
        reason: 'Agent is already in this room',
      };
    }

    // Check concurrent room limit
    if (presence.currentRooms.length >= policy.maxConcurrentRooms) {
      return {
        allowed: false,
        reason: `Maximum concurrent rooms (${policy.maxConcurrentRooms}) reached`,
      };
    }

    // Check cooldown
    if (presence.nextAllowedJoinTime && presence.nextAllowedJoinTime > new Date()) {
      return {
        allowed: false,
        reason: 'Cooldown active',
        cooldownUntil: presence.nextAllowedJoinTime,
      };
    }

    // Check if approval is required
    const requiresApproval = policy.requireOwnerApproval && source !== 'owner';
    const autoApprove = source === 'owner' && policy.autoApproveForOwner;

    if (requiresApproval && !autoApprove) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: 'Owner approval required',
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
    };
  }

  /**
   * Update presence state after agent joins a room
   */
  async recordJoin(agentId: string, roomId: string, cooldownMinutes: number = 0): Promise<void> {
    let presence = await AgentPresence.findById(agentId);
    
    if (!presence) {
      presence = await AgentPresence.create({
        _id: agentId,
        agentId,
        currentRooms: [],
        totalJoinsToday: 0,
        lastJoinTime: new Date(),
        nextAllowedJoinTime: new Date(),
      });
    }

    // Add room if not already present
    if (!presence.currentRooms.includes(roomId)) {
      presence.currentRooms.push(roomId);
    }

    presence.lastJoinTime = new Date();
    presence.totalJoinsToday += 1;

    // Set cooldown
    if (cooldownMinutes > 0) {
      const nextAllowed = new Date();
      nextAllowed.setMinutes(nextAllowed.getMinutes() + cooldownMinutes);
      presence.nextAllowedJoinTime = nextAllowed;
    }

    await presence.save();
  }

  /**
   * Update presence state after agent leaves a room
   */
  async recordLeave(agentId: string, roomId: string): Promise<void> {
    const presence = await AgentPresence.findById(agentId);
    
    if (!presence) {
      return; // Nothing to update
    }

    presence.currentRooms = presence.currentRooms.filter(id => id !== roomId);
    await presence.save();
  }

  /**
   * Get current presence state
   */
  async getPresence(agentId: string): Promise<AgentPresenceDoc | null> {
    return await AgentPresence.findById(agentId);
  }
}

export const presenceCoordinator = new AgentPresenceCoordinator();

