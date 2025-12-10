import { AgentMatch } from './agent-matcher';
import { AnalysisResult } from './nlp-analyzer';
import { RoomAnalysisState, RoomAnalysisStateDoc } from '../models/room-analysis-state';
import { ANALYSIS_CONFIG } from '../config/constants';
import { RoomAgentInvitedPublisher } from '../events/publishers/room-agent-invited-publisher';
import { kafkaWrapper } from '../kafka-client';

export class InvitationCoordinator {
  /**
   * Coordinate agent invitations based on analysis results
   * Checks existing participants and respects limits
   */
  async inviteAgents(
    agentMatches: AgentMatch[],
    roomId: string,
    analysis: AnalysisResult
  ): Promise<void> {
    if (agentMatches.length === 0) {
      console.log(`[InvitationCoordinator] No agents to invite for room ${roomId}`);
      return;
    }

    // Get room analysis state
    let state = await RoomAnalysisState.findOne({ roomId });
    if (!state) {
      const newState = RoomAnalysisState.build({ roomId });
      await newState.save();
      state = await RoomAnalysisState.findOne({ roomId });
    }

    // Ensure state is not null
    if (!state) {
      console.error(`[InvitationCoordinator] Failed to create state for room ${roomId}`);
      return;
    }

    // Check existing participants (we'll get this from an event or projection)
    // For now, we'll track invited agents in the state to prevent duplicates
    const recentlyInvited = await this.getRecentlyInvitedAgents(roomId, state);
    
    // Filter out recently invited agents
    const eligibleMatches = agentMatches.filter(
      match => !recentlyInvited.has(match.agentId)
    );

    if (eligibleMatches.length === 0) {
      console.log(`[InvitationCoordinator] All agents were recently invited for room ${roomId}`);
      return;
    }

    // Limit number of invitations
    const matchesToInvite = eligibleMatches.slice(0, ANALYSIS_CONFIG.MAX_INVITATIONS_PER_ANALYSIS);

    // Invite each agent
    const invitedAgentIds: string[] = [];
    for (const match of matchesToInvite) {
      try {
        await this.publishInvitation(match, roomId, analysis);
        invitedAgentIds.push(match.agentId);
        console.log(`[InvitationCoordinator] ✅ Invited agent ${match.agentId} to room ${roomId}`, {
          relevanceScore: match.relevanceScore,
          reasons: match.matchReasons,
        });
      } catch (error) {
        console.error(`[InvitationCoordinator] ❌ Failed to invite agent ${match.agentId}:`, error);
      }
    }

    // Update state
    state.lastInvitationAt = new Date();
    state.totalInvitations += invitedAgentIds.length;
    await state.save();

    console.log(`[InvitationCoordinator] Invited ${invitedAgentIds.length} agents to room ${roomId}`);
  }

  /**
   * Get agents that were recently invited (within cooldown period)
   */
  private async getRecentlyInvitedAgents(
    roomId: string,
    state: RoomAnalysisStateDoc
  ): Promise<Set<string>> {
    const recentlyInvited = new Set<string>();

    // Check invitation history in analysis results
    const cooldownTime = new Date(Date.now() - ANALYSIS_CONFIG.AGENT_INVITATION_COOLDOWN_MS);
    
    const { RoomAnalysisResult } = await import('../models/room-analysis-result');
    const recentResults = await RoomAnalysisResult.find({
      roomId,
      analyzedAt: { $gte: cooldownTime },
    }).lean();

    for (const result of recentResults) {
      for (const agentId of result.invitedAgentIds || []) {
        recentlyInvited.add(agentId);
      }
    }

    return recentlyInvited;
  }

  /**
   * Publish RoomAgentInvitedEvent to Kafka
   */
  private async publishInvitation(
    match: AgentMatch,
    roomId: string,
    analysis: AnalysisResult
  ): Promise<void> {
    const reason = match.matchReasons.join(', ');
    
    // Publish invitation event
    // RoomAgentInvitedEvent expects: agentId, roomId, invitedBy, timestamp
    await new RoomAgentInvitedPublisher(kafkaWrapper.producer).publish({
      agentId: match.agentId,
      roomId,
      invitedBy: 'ai-chat-host',
      timestamp: new Date().toISOString(),
    });

    console.log(`[InvitationCoordinator] Published RoomAgentInvitedEvent for agent ${match.agentId} to room ${roomId}`);
  }
}

export const invitationCoordinator = new InvitationCoordinator();

