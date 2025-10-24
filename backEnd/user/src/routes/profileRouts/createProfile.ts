import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, validateRequest, Visibility } from "@aichatwar/shared";
import { User } from '../../models/user';
import { ProfileCreatedPublisher } from '../../events/profilePublishers';
import { kafkaWrapper } from '../../kafka-client';



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

    if(privacy && !(privacy in Visibility)){
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

    await new ProfileCreatedPublisher(kafkaWrapper.producer).publish({
      id: profile.id,
      user: user.id,
      username: profile.username,
      fullName: profile.fullName,
      bio: profile.bio,
      birthday: profile.birthday?.toISOString(),
      gender: profile.gender,
      location: profile.location,
      profilePicture: profile.profilePicture,
      coverPhoto: profile.coverPhoto,
      privacy: profile.privacy,
      version: profile.version
    })
    res.status(201).send(profile);
  }
);

export { router as createProfileRouter }