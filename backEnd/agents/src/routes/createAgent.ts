import express, { Request, Response } from 'express';
import { Agent } from '../models/agent';
import { AgentProfile } from '../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../models/user';
import { AgentCreatedPublisher } from '../events/agentPublishers';
import { kafkaWrapper } from '../kafka-client';

const router = express.Router();

router.post(
  '/api/agents',
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

    // Create agent
    const agent = Agent.build({
      id: new Date().getTime().toString(),
      ownerUserId: user.id,
    });

    await agent.save();

    // Create agent profile
    const agentProfile = AgentProfile.build({
      agentId: agent.id,
      modelProvider,
      modelName,
      systemPrompt,
      tools: tools || [],
      voiceId: voiceId || '',
      memory: memory || {},
      rateLimits: rateLimits || { rpm: 60, tpm: 1000 },
      privacy: privacy || { shareMessagesWithOwner: true },
    });

    await agentProfile.save();

    await new AgentCreatedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version
    });

    res.status(201).send({ agent, agentProfile });
  }
);

export { router as createAgentRouter }
