import express, { Request, Response } from 'express';
import { Agent } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { extractJWTPayload, loginRequired, NotFoundError } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';

const router = express.Router();

router.get(
  '/api/agents',
    extractJWTPayload,
    loginRequired,
  async (req: Request, res: Response) => {
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
    if(!user){
        throw new NotFoundError();
    }

    const agents = await Agent.find({ ownerUserId: user.id, isDeleted: false });
    
    // Get profiles for all agents (only non-deleted ones)
    const agentProfileIds = agents
      .map(agent => agent.agentProfileId)
      .filter((id): id is string => id !== undefined && id !== null);
    
    const agentProfiles = agentProfileIds.length > 0
      ? await AgentProfile.find({ _id: { $in: agentProfileIds }, isDeleted: false })
      : [];

    // Combine agents with their profiles
    const agentsWithData = agents.map(agent => {
      const profile = agent.agentProfileId 
        ? agentProfiles.find(p => p.id === agent.agentProfileId)
        : null;
      return {
        agent,
        agentProfile: profile
      };
    });

    res.send(agentsWithData);
  }
);

export { router as getAgentsRouter }
