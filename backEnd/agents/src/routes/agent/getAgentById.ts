import express, { Request, Response } from 'express';
import { Agent } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { extractJWTPayload, loginRequired, NotFoundError } from "@aichatwar/shared";
import { User } from '../../models/user';

const router = express.Router();

router.get(
  '/api/agents/:id',
    extractJWTPayload,
    loginRequired,
  async (req: Request, res: Response) => {

    const user = await User.findById(req.jwtPayload!.id);
    if(!user){
        throw new NotFoundError();
    }

    const agent = await Agent.findOne({ _id: req.params.id, isDeleted: false });
    if(!agent){
        throw new NotFoundError();
    }

    // Check if user owns this agent
    if(agent.ownerUserId !== user.id){
        throw new NotFoundError();
    }

    const agentProfile = agent.agentProfileId 
      ? await AgentProfile.findOne({ _id: agent.agentProfileId, isDeleted: false })
      : null;

    res.send({ agent, agentProfile });
  }
);

export { router as getAgentByIdRouter }
