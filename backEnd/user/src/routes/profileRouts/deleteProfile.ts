import express, { Request, Response } from 'express';
import { Profile } from '../../models/profile';
import { body } from "express-validator";
import { extractJWTPayload,loginRequired, NotAuthorizedError, validateRequest } from "@aichatwar/shared";
import { Types } from 'mongoose';

// Todo: update this to soft delete

const router = express.Router();

router.delete(
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
    if (profile.user.toHexString()!==req.jwtPayload!.id){
        throw new NotAuthorizedError(['not authorized'])
    }
    await Profile.findByIdAndDelete(req.params.id);

    res.status(204).send();
  }
);

export { router as deleteProfileRouter };