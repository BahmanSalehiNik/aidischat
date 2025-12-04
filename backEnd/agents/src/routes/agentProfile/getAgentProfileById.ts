import express, { Request, Response } from 'express';
import { AgentProfile } from '../../models/agentProfile';
import { extractJWTPayload, loginRequired, NotFoundError } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';

const router = express.Router();

router.get(
  '/api/agents/profiles/:id',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
    if (!user) {
      throw new NotFoundError();
    }

    const agentProfile = await AgentProfile.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    });

    if (!agentProfile) {
      throw new NotFoundError();
    }

    res.send(agentProfile);
  }
);

export { router as getAgentProfileByIdRouter };

