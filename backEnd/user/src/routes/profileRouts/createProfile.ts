import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { body } from "express-validator";
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, validateRequest, Visability } from "@aichatwar/shared";
import { User } from '../../models/user';
import { ProfileCreatedPublisher, KafkaProfileCreatedPublisher } from '../../events/profilePublishers';
import { natsClient } from '../../nats-client';
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

    await new ProfileCreatedPublisher(natsClient.client).publish({
      id: profile.id,
      user:user.id,
      username:profile.username,
      fullName: profile.fullName,
      bio: profile.bio,
      birthday: profile.bio,
      gender: profile.gender,
      location:{
        country: profile.location?.country,
        city: profile.location?.city,
        coordinates: profile.location?.coordinates
      }, 
      coverPhoto: profile.coverPhoto,
      privacy: profile.privacy,
      profilePicture: profile.profilePicture,
      version: profile.version
    })

    await new KafkaProfileCreatedPublisher(kafkaWrapper.producer).publish({
      id: profile.id,
      user:user.id,
      username:profile.username,
      fullName: profile.fullName,
      bio: profile.bio,
      birthday: profile.bio,
      gender: profile.gender,
      location:{
        country: profile.location?.country,
        city: profile.location?.city,
        coordinates: profile.location?.coordinates
      }, 
      coverPhoto: profile.coverPhoto,
      privacy: profile.privacy,
      profilePicture: profile.profilePicture,
      version: profile.version
    })
    res.status(201).send(profile);
  }
);

export { router as createProfileRouter }