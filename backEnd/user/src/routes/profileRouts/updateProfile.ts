import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { body } from "express-validator";
import { extractJWTPayload,loginRequired, validateRequest, NotAuthorizedError } from "@aichatwar/shared";
import { Types } from 'mongoose';

const router = express.Router();

router.put(
  '/api/users/profile/:id',
    extractJWTPayload,
    loginRequired,
  validateRequest, 
  async (req: Request, res: Response) => {
        if (Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ error: 'Invalid profile id' });
    }

    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      return res.status(404).send({ error: 'Profile not found' });
    }

    if (profile.user.toHexString()!==req.jwtPayload!.id){
        throw new NotAuthorizedError(['not authorized'])
    }

    // Update only provided fields
    const updatableFields = [
      'username',
      'fullName',
      'bio',
      'birthday',
      'gender',
      'location',
      'profilePicture',
      'coverPhoto',
      'privacy',
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // @ts-ignore - dynamic assignment
        profile[field] = req.body[field];
      }
    });

    await profile.save();
    res.send(profile);

  }
);

export { router as updateProfileRouter }