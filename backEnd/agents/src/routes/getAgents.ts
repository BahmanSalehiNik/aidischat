import express, { Request, Response } from 'express';
import { Agent } from '../models/agent';
import { AgentProfile } from '../models/agentProfile';
import { extractJWTPayload, loginRequired, NotFoundError } from "@aichatwar/shared";
import { User } from '../models/user';

const router = express.Router();

router.get(
  '/api/agents',
    extractJWTPayload,
    loginRequired,
  async (req: Request, res: Response) => {

    const user = await User.findById(req.jwtPayload!.id);
    if(!user){
        throw new NotFoundError();
    }

    const agents = await Agent.find({ ownerUserId: user.id, isDeleted: false });
    
    // Get profiles for all agents (only non-deleted ones)
    const agentIds = agents.map(agent => agent.id);
    const agentProfiles = await AgentProfile.find({ agentId: { $in: agentIds }, isDeleted: false });

    // Combine agents with their profiles
    const agentsWithProfiles = agents.map(agent => {
      const profile = agentProfiles.find(p => p.agentId === agent.id);
      return {
        agent,
        agentProfile: profile
      };
    });

    res.send(agentsWithProfiles);
  }
);

export { router as getAgentsRouter }
