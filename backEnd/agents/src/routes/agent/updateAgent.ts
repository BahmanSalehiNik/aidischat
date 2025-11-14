import express, { Request, Response } from 'express';
import { Agent } from '../../models/agent';
import { AgentProfile, BreedType } from '../../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../../models/user';
import { AgentUpdatedPublisher } from '../../events/agentPublishers';
import { kafkaWrapper } from '../../kafka-client';

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
      character,
    } = req.body;

    // Validate modelProvider enum
    const validProviders = ['openai', 'anthropic', 'cohere', 'local', 'custom'];
    if (!validProviders.includes(modelProvider)) {
      throw new BadRequestError('Invalid model provider');
    }

    // Update agent (model config)
    agent.modelProvider = modelProvider;
    agent.modelName = modelName;
    agent.systemPrompt = systemPrompt;
    agent.tools = tools !== undefined ? tools : agent.tools;
    agent.voiceId = voiceId !== undefined ? voiceId : agent.voiceId;
    agent.memory = memory !== undefined ? memory : agent.memory;
    agent.rateLimits = rateLimits !== undefined ? rateLimits : agent.rateLimits;
    agent.privacy = privacy !== undefined ? privacy : agent.privacy;

    await agent.save();

    // Get agent profile for character updates
    const agentProfile = agent.agentProfileId 
      ? await AgentProfile.findOne({ _id: agent.agentProfileId, isDeleted: false })
      : null;
    
    if (!agentProfile) {
      throw new NotFoundError();
    }

    // Update character fields if provided
    if (character) {
      if (character.name !== undefined) agentProfile.name = character.name;
      if (character.displayName !== undefined) agentProfile.displayName = character.displayName;
      if (character.title !== undefined) agentProfile.title = character.title;
      if (character.age !== undefined) agentProfile.age = character.age;
      if (character.ageRange !== undefined) agentProfile.ageRange = character.ageRange;
      if (character.gender !== undefined) agentProfile.gender = character.gender;
      if (character.nationality !== undefined) agentProfile.nationality = character.nationality;
      if (character.ethnicity !== undefined) agentProfile.ethnicity = character.ethnicity;
      if (character.breed !== undefined) {
        const validBreeds = Object.values(BreedType);
        if (!validBreeds.includes(character.breed)) {
          throw new BadRequestError('Invalid character breed/type');
        }
        agentProfile.breed = character.breed;
      }
      if (character.subtype !== undefined) agentProfile.subtype = character.subtype;
      if (character.height !== undefined) agentProfile.height = character.height;
      if (character.build !== undefined) agentProfile.build = character.build;
      if (character.hairColor !== undefined) agentProfile.hairColor = character.hairColor;
      if (character.eyeColor !== undefined) agentProfile.eyeColor = character.eyeColor;
      if (character.skinTone !== undefined) agentProfile.skinTone = character.skinTone;
      if (character.distinguishingFeatures !== undefined) agentProfile.distinguishingFeatures = character.distinguishingFeatures;
      if (character.profession !== undefined) agentProfile.profession = character.profession;
      if (character.role !== undefined) agentProfile.role = character.role;
      if (character.specialization !== undefined) agentProfile.specialization = character.specialization;
      if (character.organization !== undefined) agentProfile.organization = character.organization;
      if (character.personality !== undefined) agentProfile.personality = character.personality;
      if (character.communicationStyle !== undefined) agentProfile.communicationStyle = character.communicationStyle;
      if (character.speechPattern !== undefined) agentProfile.speechPattern = character.speechPattern;
      if (character.backstory !== undefined) agentProfile.backstory = character.backstory;
      if (character.origin !== undefined) agentProfile.origin = character.origin;
      if (character.currentLocation !== undefined) agentProfile.currentLocation = character.currentLocation;
      if (character.goals !== undefined) agentProfile.goals = character.goals;
      if (character.fears !== undefined) agentProfile.fears = character.fears;
      if (character.interests !== undefined) agentProfile.interests = character.interests;
      if (character.abilities !== undefined) agentProfile.abilities = character.abilities;
      if (character.skills !== undefined) agentProfile.skills = character.skills;
      if (character.limitations !== undefined) agentProfile.limitations = character.limitations;
      if (character.relationshipToUser !== undefined) agentProfile.relationshipToUser = character.relationshipToUser;
      if (character.avatarUrl !== undefined) agentProfile.avatarUrl = character.avatarUrl;
      if (character.avatarPublicId !== undefined) agentProfile.avatarPublicId = character.avatarPublicId;
      if (character.colorScheme !== undefined) agentProfile.colorScheme = character.colorScheme;
      if (character.tags !== undefined) agentProfile.tags = character.tags;
      if (character.isPublic !== undefined) agentProfile.isPublic = character.isPublic;
      if (character.isActive !== undefined) agentProfile.isActive = character.isActive;
      
      await agentProfile.save();
    }

    await new AgentUpdatedPublisher(kafkaWrapper.producer).publish({
      id: agent.id,
      ownerUserId: agent.ownerUserId,
      version: agent.version
    });

    res.send({ agent, agentProfile });
  }
);

export { router as updateAgentRouter }
