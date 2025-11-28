import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Agent, AgentProvisioningStatus } from '../../models/agent';
import { AgentProfile } from '../../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';
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
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
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
      character: (() => {
        // Only include defined values to avoid serialization issues
        const char: any = {
          name: agentProfile.name,
        };
        
        if (agentProfile.displayName) char.displayName = agentProfile.displayName;
        if (agentProfile.title) char.title = agentProfile.title;
        if (agentProfile.age !== undefined && agentProfile.age !== null) char.age = agentProfile.age;
        if (agentProfile.ageRange) char.ageRange = agentProfile.ageRange;
        if (agentProfile.gender) char.gender = agentProfile.gender;
        if (agentProfile.nationality) char.nationality = agentProfile.nationality;
        if (agentProfile.ethnicity) char.ethnicity = agentProfile.ethnicity;
        if (agentProfile.breed) char.breed = agentProfile.breed;
        if (agentProfile.subtype) char.subtype = agentProfile.subtype;
        if (agentProfile.height) char.height = agentProfile.height;
        if (agentProfile.build) char.build = agentProfile.build;
        if (agentProfile.hairColor) char.hairColor = agentProfile.hairColor;
        if (agentProfile.eyeColor) char.eyeColor = agentProfile.eyeColor;
        if (agentProfile.skinTone) char.skinTone = agentProfile.skinTone;
        if (agentProfile.distinguishingFeatures && agentProfile.distinguishingFeatures.length > 0) {
          char.distinguishingFeatures = agentProfile.distinguishingFeatures;
        }
        if (agentProfile.profession) char.profession = agentProfile.profession;
        if (agentProfile.role) char.role = agentProfile.role;
        if (agentProfile.specialization) char.specialization = agentProfile.specialization;
        if (agentProfile.organization) char.organization = agentProfile.organization;
        if (agentProfile.personality && agentProfile.personality.length > 0) {
          char.personality = agentProfile.personality;
        }
        if (agentProfile.communicationStyle) char.communicationStyle = agentProfile.communicationStyle;
        if (agentProfile.speechPattern) char.speechPattern = agentProfile.speechPattern;
        if (agentProfile.backstory) char.backstory = agentProfile.backstory;
        if (agentProfile.origin) char.origin = agentProfile.origin;
        if (agentProfile.currentLocation) char.currentLocation = agentProfile.currentLocation;
        if (agentProfile.goals && agentProfile.goals.length > 0) char.goals = agentProfile.goals;
        if (agentProfile.fears && agentProfile.fears.length > 0) char.fears = agentProfile.fears;
        if (agentProfile.interests && agentProfile.interests.length > 0) char.interests = agentProfile.interests;
        if (agentProfile.abilities && agentProfile.abilities.length > 0) char.abilities = agentProfile.abilities;
        if (agentProfile.skills && agentProfile.skills.length > 0) char.skills = agentProfile.skills;
        if (agentProfile.limitations && agentProfile.limitations.length > 0) char.limitations = agentProfile.limitations;
        if (agentProfile.relationshipToUser) char.relationshipToUser = agentProfile.relationshipToUser;
        
        return char;
      })(),
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
