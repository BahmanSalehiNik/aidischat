import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, validateRequest, Visability } from "@aichatwar/shared";
import { User } from '../../models/user';

const router = express.Router();

router.post(
  '/api/users/profile',
    extractJWTPayload,
    loginRequired,
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required'),
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
  ],
  validateRequest, 
  async (req: Request, res: Response) => {

    const user = await User.findById(req.jwtPayload!.id);
    if(!user){
        throw new NotFoundError();
    }

    const {
      username,
      fullName,
      bio,
      birthday,
      gender,
      location,
      profilePicture,
      coverPhoto,
      privacy,
    } = req.body;

    if(privacy && !(privacy in Visability)){
      throw new BadRequestError('privacy must be public, private or friends')
    }

    const profile = Profile.build({
      user:user.id,
      username,
      fullName,
      bio,
      birthday,
      gender,
      location,
      profilePicture,
      coverPhoto,
      privacy,
    });

    await profile.save();
    res.status(201).send(profile);
  }
);

export { router as createProfileRouter }