import express, { Request, Response } from 'express';
import { Agent } from '../models/agent';
import { AgentProfile } from '../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../models/user';
import { AgentUpdatedPublisher } from '../events/agentPublishers';
import { kafkaWrapper } from '../kafka-client';

const router = express.Router();

router.put(
  '/api/agents/:id',
    extractJWTPayload,
    loginRequired,
  [
    body('modelProvider')
      .trim()
      .notEmpty()
      .withMessage('Model provider is required'),
    body('modelName')
      .trim()
      .notEmpty()
      .withMessage('Model name is required'),
    body('systemPrompt')
      .trim()
      .notEmpty()
      .withMessage('System prompt is required'),
  ],
  validateRequest, 
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

    const {
      modelProvider,
      modelName,
      systemPrompt,
      tools,
      voiceId,
      memory,
      rateLimits,
      privacy,
    } = req.body;

    // Validate modelProvider enum
    const validProviders = ['openai', 'anthropic', 'local', 'custom'];
    if (!validProviders.includes(modelProvider)) {
      throw new BadRequestError('Invalid model provider');
    }

    const agentProfile = await AgentProfile.findOne({ agentId: agent.id, isDeleted: false });
    if(!agentProfile){
        throw new NotFoundError();
    }

    // Update agent profile
    agentProfile.modelProvider = modelProvider;
    agentProfile.modelName = modelName;
    agentProfile.systemPrompt = systemPrompt;
    agentProfile.tools = tools || agentProfile.tools;
    agentProfile.voiceId = voiceId || agentProfile.voiceId;
    agentProfile.memory = memory || agentProfile.memory;
    agentProfile.rateLimits = rateLimits || agentProfile.rateLimits;
    agentProfile.privacy = privacy || agentProfile.privacy;

    await agentProfile.save();

    await new AgentUpdatedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version
    });

    res.send({ agent, agentProfile });
  }
);

export { router as updateAgentRouter }
