import express, { Request, Response } from 'express';
import { AgentProfile, BreedType } from '../../models/agentProfile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload, loginRequired, validateRequest } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';

const router = express.Router();

router.post(
  '/api/agents/profiles',
  extractJWTPayload,
  loginRequired,
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
    if (!user) {
      throw new BadRequestError('User not found');
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
    if (breed) {
      const validBreeds = Object.values(BreedType);
      if (!validBreeds.includes(breed)) {
        throw new BadRequestError('Invalid character breed/type');
      }
    }

    // Create agent profile with character fields only
    const agentProfile = AgentProfile.build({
      name: name.trim(),
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
      distinguishingFeatures: distinguishingFeatures || [],
      profession,
      role,
      specialization,
      organization,
      personality: personality || [],
      communicationStyle,
      speechPattern,
      backstory,
      origin,
      currentLocation,
      goals: goals || [],
      fears: fears || [],
      interests: interests || [],
      abilities: abilities || [],
      skills: skills || [],
      limitations: limitations || [],
      relationshipToUser,
      avatarUrl,
      avatarPublicId,
      colorScheme,
      tags: tags || [],
      isPublic: isPublic || false,
      isActive: isActive !== undefined ? isActive : true,
    });

    await agentProfile.save();

    res.status(201).send(agentProfile);
  }
);

export { router as createAgentProfileRouter };

