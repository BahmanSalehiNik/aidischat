import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import mongoose from 'mongoose';
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, validateRequest } from "@aichatwar/shared"
import { Friendship, FriendshipStatus } from '../models/friendship';
import { Profile } from '../models/profile'


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

    // Prevent sending a request to self
    if (recipient === req.jwtPayload!.id) {
      throw new BadRequestError('you are already friend with yourself.');
    }

    // Check profile id
    const profile = await Profile.findById(req.body.recipientProfile);
    if(!profile || profile.user.toHexString()!==req.body.recipient){
        throw new NotFoundError()
    } 
    // TODO: check for blocked etc..

    // Check for existing pending request
    const existing = await Friendship.findOne({
      requester: req.jwtPayload!.id,
      recipient,
      status: FriendshipStatus.Pending,
    });

    if (existing) {
      throw new BadRequestError('Request already pending!')
      // return res.status(400).send({ error: 'Request already pending' });
    }



    const friendship = Friendship.build({
      requester: req.jwtPayload!.id,
      recipient,
      requesterProfile: profile.id, // stored in JWT or looked up from user service
      recipientProfile,
      status: FriendshipStatus.Pending,
    });

    await friendship.save();

    // TODO: Publish FriendRequestCreated event here

    res.status(201).send(friendship);
  }
);

export {router as createFriendshipRouter}