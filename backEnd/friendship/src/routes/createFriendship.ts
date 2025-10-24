import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import mongoose, { Types } from 'mongoose';
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared"
import { Friendship, FriendshipStatus } from '../models/friendship';
import { Profile } from '../models/profile'
import { FriendshipRequestedPublisher } from '../events/publishers/friendshipPublishers';
import {kafkaWrapper} from "../kafka-client";

const router = express.Router();

/**
 * Create a new friend request
 * POST /api/friends
 */
router.post(
  '/api/friends/',
    extractJWTPayload,
    loginRequired,
  [
    body('recipient')
      .notEmpty()
      .withMessage('Recipient userId is required'),
    body('recipientProfile')
      .notEmpty()
      .custom((input: string) => mongoose.Types.ObjectId.isValid(input))
      .withMessage('Valid recipientProfile ObjectId is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { recipient, recipientProfile } = req.body;
    console.log(recipient, recipientProfile, "secret recipient")
    // Prevent sending a request to self
    if (recipient === req.jwtPayload!.id) {
      throw new BadRequestError('you are already friend with yourself.');
    }
    // TODO: check the recipient profile and userid
    // Check profile id //TODO: add this after the listener is created 
    // TODO: FIX THIS, find the profile of the user
    // const profile = await Profile.find(req.jwtPayload.id);
    // if(!profile){
    // you don't have a profile!
    //     throw new NotFoundError()
    // } 
    // TODO: check for blocked etc..

    // Check for existing pending request
    const existingF = await Friendship.find({
      requester: req.jwtPayload!.id,
      recipient,
      status: FriendshipStatus.Pending,
    });



    if (existingF && existingF.length>0) {
      throw new BadRequestError('Request already pending!')
      // return res.status(400).send({ error: 'Request already pending' });
    }

    
    const temp = new Types.ObjectId().toHexString(); 
    const friendship = Friendship.build({
      requester: req.jwtPayload!.id,
      recipient,
      // TODO: !!!!!!!!!!!! edit this back to profile.id
      requesterProfile: temp,//,req.jwtPayload!.id,//profile.id, // stored in JWT or looked up from user service
      recipientProfile,
      status: FriendshipStatus.Pending,
    });

    await friendship.save();
    await new FriendshipRequestedPublisher(kafkaWrapper.producer).publish({
        id: friendship.id,
        recipient: friendship.recipient,
        requester: friendship.requester,
        version: friendship.version,
        status: friendship.status
    })

    res.status(201).send(friendship);
  }
);

export {router as createFriendshipRouter}