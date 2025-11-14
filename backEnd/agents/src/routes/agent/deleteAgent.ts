import express, { Request, Response } from 'express';
import { Agent } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { extractJWTPayload, loginRequired, NotFoundError } from "@aichatwar/shared";
import { User } from '../../models/user';
import { AgentDeletedPublisher } from '../../events/agentPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.delete(
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

    // Check if agent is already soft deleted
    if(agent.isDeleted){
        throw new NotFoundError();
    }

    // Soft delete agent profile if linked
    if (agent.agentProfileId) {
      const agentProfile = await AgentProfile.findOne({ _id: agent.agentProfileId, isDeleted: false });
      if(agentProfile){
          agentProfile.isDeleted = true;
          agentProfile.deletedAt = new Date();
          await agentProfile.save();
      }
    }

    // Soft delete agent
    agent.isDeleted = true;
    agent.deletedAt = new Date();
    await agent.save();

    await new AgentDeletedPublisher(kafkaWrapper.producer).publish({
      id: agent.id
    });

    res.status(204).send();
  }
);

export { router as deleteAgentRouter }
