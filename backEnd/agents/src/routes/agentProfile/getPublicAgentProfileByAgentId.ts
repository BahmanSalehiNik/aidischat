import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, Visibility } from '@aichatwar/shared';
import { Agent } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { Friendship } from '../../models/friendship';

const router = express.Router();

/**
 * GET /api/agents/public/:agentId
 * Viewer-aware agent profile endpoint.
 */
router.get(
  '/api/agents/public/:agentId',
  extractJWTPayload,
  loginRequired,
  async (req: Request<{ agentId: string }>, res: Response) => {
    const viewerId = req.jwtPayload!.id;
    const agentId = String(req.params.agentId || '');

    const agent = await Agent.findOne({ _id: agentId, isDeleted: false }).lean();
    if (!agent) {
      return res.status(404).send({ error: 'Agent not found' });
    }

    const agentProfile = agent.agentProfileId
      ? await AgentProfile.findOne({ _id: agent.agentProfileId, isDeleted: false }).lean()
      : null;

    // Owner can always view.
    if (agent.ownerUserId === viewerId) {
      return res.send({
        allowed: true,
        isAgent: true,
        agent,
        agentProfile,
        relationship: { status: 'owner' },
      });
    }

    // Determine visibility (prefer new privacy, fallback to legacy isPublic)
    const visibility =
      agentProfile?.privacy?.profileVisibility ??
      (agentProfile?.isPublic ? Visibility.Public : Visibility.Private);

    // Determine friendship
    const friendship = await Friendship.findOne({
      status: 'accepted',
      $or: [
        { requester: agentId, recipient: viewerId },
        { requester: viewerId, recipient: agentId },
      ],
    })
      .select('status')
      .lean();
    const isFriend = Boolean(friendship);

    if (visibility === Visibility.Public) {
      return res.send({ allowed: true, isAgent: true, agent, agentProfile, relationship: { status: friendship?.status || 'none' } });
    }

    if (visibility === Visibility.Friends) {
      if (isFriend) {
        return res.send({ allowed: true, isAgent: true, agent, agentProfile, relationship: { status: friendship?.status || 'none' } });
      }
      return res.status(403).send({
        allowed: false,
        reason: 'not_friends',
        isAgent: true,
        agent: { id: agentId },
        agentProfile: agentProfile
          ? {
              id: agentProfile.id,
              name: agentProfile.name,
              displayName: agentProfile.displayName,
              avatarUrl: agentProfile.avatarUrl,
              privacy: agentProfile.privacy,
            }
          : null,
      });
    }

    // Private
    return res.status(403).send({
      allowed: false,
      reason: 'private',
      isAgent: true,
      agent: { id: agentId },
      agentProfile: agentProfile
        ? {
            id: agentProfile.id,
            name: agentProfile.name,
            displayName: agentProfile.displayName,
            avatarUrl: agentProfile.avatarUrl,
            privacy: agentProfile.privacy,
          }
        : null,
    });
  }
);

export { router as getPublicAgentProfileByAgentIdRouter };






