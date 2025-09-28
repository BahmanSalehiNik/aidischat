import express, { Request, Response } from "express";
import { body } from "express-validator";

import { validateRequest, BadRequestError, loginRequired, 
    extractJWTPayload, UserStatus, NotFoundError, NotAuthorizedError } from "@aichatwar/shared";
import { User } from "../../models/user";

import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * PATCH /api/users/:id/status
 * Updates the lifecycle status of a user (active, suspended, banned, deleted).
 * Only an admin (or your chosen role) should be allowed to perform this action.
 */
router.patch(
  '/:id/status',
  extractJWTPayload,
  loginRequired,
  //TODOD: add Admin account later//requireAdmin, // or any custom authorization
  
  [
    body('status')
      .notEmpty()
      .isIn(Object.values(UserStatus))
      .withMessage(`Status must be one of: ${Object.values(UserStatus).join(', ')}`),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status: UserStatus };

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError();
    }

    //TODO: make admin able of doing this
    if(req.jwtPayload!.id !== user.id ){
        throw new NotAuthorizedError(['not authorized!']);
    }

    // Example of preventing self-lockout if needed
    if (req.jwtPayload!.id === user.id && 
        // user can modify if the account is Active or Deactive
       (
        !(user.status in [UserStatus.Active, 'Deactive']) ||
        !(status in [UserStatus.Active, 'Deactive'])
    ))

    {
      throw new NotAuthorizedError(['not authorized!']);
    }

    user.status = status;
    await user.save();

    // 🔔 Publish a UserStatusUpdated event to NATS/Kafka if using event-driven services
    // new UserStatusUpdatedPublisher(natsWrapper.client).publish({
    //   id: user.id,
    //   status: user.status,
    //   version: user.version,
    // });

    res.status(200).send(user);
  }
);

export { router as updateUserStatusRouter };