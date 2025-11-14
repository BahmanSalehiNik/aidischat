import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Agent, AgentProvisioningStatus } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../../models/user';
import { AgentIngestedPublisher } from '../../events/agentPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.post(
  '/api/agents',
    extractJWTPayload,
    loginRequired,
  [
    body('agentProfileId')
      .trim()
      .notEmpty()
      .withMessage('Agent profile ID is required'),
    body('modelProvider')
      .optional()
      .trim()
      .isIn(['openai', 'anthropic', 'cohere', 'local', 'custom'])
      .withMessage('Invalid model provider'),
  ],
  validateRequest, 
  async (req: Request, res: Response) => {

    const user = await User.findById(req.jwtPayload!.id);
    if(!user){
        throw new NotFoundError();
    }

    // Check agent limit (2 for now, will be subscription-based later)
    const existingAgentsCount = await Agent.countDocuments({ 
      ownerUserId: user.id, 
      isDeleted: false 
    });
    
    if (existingAgentsCount >= 2) {
      throw new BadRequestError('Agent limit reached. Maximum 2 agents allowed.');
    }

    const {
      agentProfileId,
      modelProvider,
      modelName,
      systemPrompt,
      tools,
      voiceId,
      memory,
      rateLimits,
      privacy,
    } = req.body;

    // Validate and fetch agent profile
    const agentProfile = await AgentProfile.findOne({ 
      _id: agentProfileId, 
      isDeleted: false 
    });

    if (!agentProfile) {
      throw new NotFoundError();
    }

    // Validate modelProvider enum if provided
    if (modelProvider) {
      const validProviders = ['openai', 'anthropic', 'cohere', 'local', 'custom'];
      if (!validProviders.includes(modelProvider)) {
        throw new BadRequestError('Invalid model provider');
      }
    }

    const correlationId = randomUUID();
    const now = new Date();

    // Create agent with model configuration
    const agent = Agent.build({
      id: new Date().getTime().toString(),
      ownerUserId: user.id,
      status: AgentProvisioningStatus.Pending,
      provisioningCorrelationId: correlationId,
      agentProfileId: agentProfile.id,
      modelProvider: modelProvider || 'openai',
      modelName: modelName || 'gpt-4o',
      systemPrompt: systemPrompt || '',
      tools: tools || [],
      voiceId: voiceId || '',
      memory: memory || {},
      rateLimits: rateLimits || { rpm: 60, tpm: 1000 },
      privacy: privacy || { shareMessagesWithOwner: true },
    });

    await agent.save();

    const metadata = {
      correlationId,
      requestedAt: now.toISOString(),
      requesterUserId: user.id,
    };

    await new AgentIngestedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      agentId: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version,
      correlationId,
      profile: {
        modelProvider: agent.modelProvider,
        modelName: agent.modelName,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools || [],
        rateLimits: agent.rateLimits,
        voiceId: agent.voiceId || '',
        memory: agent.memory || {},
        privacy: agent.privacy,
      },
      character: {
        name: agentProfile.name,
        displayName: agentProfile.displayName,
        title: agentProfile.title,
        personaTraits: agentProfile.personality || [],
      },
      metadata,
      ingestedAt: now.toISOString(),
    });

    res.status(201).send({
      agent,
      agentProfile,
      provisioning: {
        status: agent.status,
        correlationId,
      },
    });
  }
);

export { router as createAgentRouter }
