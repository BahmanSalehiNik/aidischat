import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, validateRequest } from "@aichatwar/shared"
import { Friendship, FriendshipStatus } from '../models/friendship';
import { FrinedShipAcceptedPublisher, FriendshipUpdatedPublisher } from '../events/publishers/friendshipPublishers';
import { natsClient } from '../nats-client';
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

    console.log(req.params.id, "secret id")
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

    const friendshipEventData = {
        id:friendship.id,
        recipient: friendship.recipient,
        requester: friendship.requester,
        version: friendship.version,
        status: friendship.status
      }

    if (status === FriendshipStatus.Accepted){
      await new FrinedShipAcceptedPublisher(natsClient.client).publish(friendshipEventData)
    }else{
      await new FriendshipUpdatedPublisher(natsClient.client).publish(friendshipEventData)
    }
    

    // TODO: Publish a FriendshipUpdated event if using NATS/Kafka

    res.send(friendship);
  }
);

export {router as updateFrindshipRouter}