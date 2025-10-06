import express, { Request, Response } from 'express';
import { extractJWTPayload,loginRequired } from "@aichatwar/shared"
import { Friendship, FriendshipStatus } from '../models/friendship';

const router = express.Router();
router.get('/api/friends/',
     extractJWTPayload,
     loginRequired ,
     async (req: Request, res: Response) => {
  const requests = await Friendship.find({
    recipient: req.jwtPayload!.id,
    status: FriendshipStatus.Pending,
    //TODO: populate after profile and user listeners are completed.
  })//.populate('requesterProfile');

  res.send(requests);
});

export { router as getUserFriendsRouter }