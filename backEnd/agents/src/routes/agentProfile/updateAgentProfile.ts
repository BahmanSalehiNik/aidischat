import express, { Request, Response } from 'express';
import { AgentProfile, BreedType } from '../../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';

const router = express.Router();

router.put(
  '/api/agents/profiles/:id',
  extractJWTPayload,
  loginRequired,
  [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
    if (!user) {
      throw new NotFoundError();
    }

    const agentProfile = await AgentProfile.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    });

    if (!agentProfile) {
      throw new NotFoundError();
    }

    const {
      name,
      displayName,
      title,
      age,
      ageRange,
      gender,
      nationality,
      ethnicity,
      breed,
      subtype,
      height,
      build,
      hairColor,
      eyeColor,
      skinTone,
      distinguishingFeatures,
      profession,
      role,
      specialization,
      organization,
      personality,
      communicationStyle,
      speechPattern,
      backstory,
      origin,
      currentLocation,
      goals,
      fears,
      interests,
      abilities,
      skills,
      limitations,
      relationshipToUser,
      avatarUrl,
      avatarPublicId,
      colorScheme,
      tags,
      isPublic,
      isActive,
    } = req.body;

    // Validate breed enum if provided
    if (breed !== undefined) {
      const validBreeds = Object.values(BreedType);
      if (!validBreeds.includes(breed)) {
        throw new BadRequestError('Invalid character breed/type');
      }
    }

    // Update character fields if provided
    if (name !== undefined) agentProfile.name = name.trim();
    if (displayName !== undefined) agentProfile.displayName = displayName;
    if (title !== undefined) agentProfile.title = title;
    if (age !== undefined) agentProfile.age = age;
    if (ageRange !== undefined) agentProfile.ageRange = ageRange;
    if (gender !== undefined) agentProfile.gender = gender;
    if (nationality !== undefined) agentProfile.nationality = nationality;
    if (ethnicity !== undefined) agentProfile.ethnicity = ethnicity;
    if (breed !== undefined) agentProfile.breed = breed;
    if (subtype !== undefined) agentProfile.subtype = subtype;
    if (height !== undefined) agentProfile.height = height;
    if (build !== undefined) agentProfile.build = build;
    if (hairColor !== undefined) agentProfile.hairColor = hairColor;
    if (eyeColor !== undefined) agentProfile.eyeColor = eyeColor;
    if (skinTone !== undefined) agentProfile.skinTone = skinTone;
    if (distinguishingFeatures !== undefined) agentProfile.distinguishingFeatures = distinguishingFeatures;
    if (profession !== undefined) agentProfile.profession = profession;
    if (role !== undefined) agentProfile.role = role;
    if (specialization !== undefined) agentProfile.specialization = specialization;
    if (organization !== undefined) agentProfile.organization = organization;
    if (personality !== undefined) agentProfile.personality = personality;
    if (communicationStyle !== undefined) agentProfile.communicationStyle = communicationStyle;
    if (speechPattern !== undefined) agentProfile.speechPattern = speechPattern;
    if (backstory !== undefined) agentProfile.backstory = backstory;
    if (origin !== undefined) agentProfile.origin = origin;
    if (currentLocation !== undefined) agentProfile.currentLocation = currentLocation;
    if (goals !== undefined) agentProfile.goals = goals;
    if (fears !== undefined) agentProfile.fears = fears;
    if (interests !== undefined) agentProfile.interests = interests;
    if (abilities !== undefined) agentProfile.abilities = abilities;
    if (skills !== undefined) agentProfile.skills = skills;
    if (limitations !== undefined) agentProfile.limitations = limitations;
    if (relationshipToUser !== undefined) agentProfile.relationshipToUser = relationshipToUser;
    if (avatarUrl !== undefined) agentProfile.avatarUrl = avatarUrl;
    if (avatarPublicId !== undefined) agentProfile.avatarPublicId = avatarPublicId;
    if (colorScheme !== undefined) agentProfile.colorScheme = colorScheme;
    if (tags !== undefined) agentProfile.tags = tags;
    if (isPublic !== undefined) agentProfile.isPublic = isPublic;
    if (isActive !== undefined) agentProfile.isActive = isActive;

    await agentProfile.save();

    res.send(agentProfile);
  }
);

export { router as updateAgentProfileRouter };

