import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, validateRequest } from "@aichatwar/shared"
import { Friendship, FriendshipStatus } from '../models/friendship';

const router = express.Router();


router.patch(
  '/api/friends/:id',
  extractJWTPayload,
  loginRequired,
  [
    body('status')
      .notEmpty()
      .isIn([
        FriendshipStatus.Accepted,
        FriendshipStatus.Declined,
        FriendshipStatus.Pending,   // optional if you want to allow re-sending
        FriendshipStatus.Blocked,   // or Withdraw if you add it
      ])
      .withMessage('Invalid status value'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { status } = req.body;
    const friendship = await Friendship.findById(req.params.id);

    if (!friendship) {
      throw new NotFoundError();
      return res.status(404).send({ error: 'Friendship not found' });
    }

    // --- Authorization logic ---
    // Recipient can accept/decline/block
    if (
      [FriendshipStatus.Accepted, FriendshipStatus.Declined, FriendshipStatus.Blocked].includes(
        status
      )
    ) {
      if (friendship.recipient !== req.jwtPayload!.id) {
        throw new NotAuthorizedError(['Not authorized!'])
        return res.status(403).send({ error: 'Not authorized to update this request' });
      }
    }

    // Requester can withdraw/cancel
    if (status === FriendshipStatus.Pending /*or Withdraw*/) {
      if (friendship.requester !== req.jwtPayload!.id) {
        throw new NotAuthorizedError(['Only requester can withdraw']);
        // return res.status(403).send({ error: 'Only requester can withdraw' });
      }
    }

    friendship.status = status;
    await friendship.save();

    // TODO: Publish a FriendshipUpdated event if using NATS/Kafka

    res.send(friendship);
  }
);

export {router as updateFrindshipRouter}