import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { extractJWTPayload,loginRequired, NotAuthorizedError, validateRequest } from "@aichatwar/shared";
import { Types} from 'mongoose';

const router = express.Router();


/**
 * GET /api/profiles/:id
 * Fetch a single profile by ID
 */
router.get(
  '/api/users/profile/:id',
    extractJWTPayload,
    loginRequired,
    validateRequest,
  async (req: Request<{ id: string }>, res: Response) => {
        if (!Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).send({ error: 'Invalid profile id' });
    }

    const profile = await Profile.findById(req.params.id);

    if (!profile) {
      return res.status(404).send({ error: 'Profile not found' });
    }


    const porfileUserIdString = profile.user.toHexString()

    if(porfileUserIdString !== req.jwtPayload!.id){
        throw new NotAuthorizedError(['not authorized']);
    }

    res.send(profile);
  }
);

export { router as getProfileByIdRouter };