import express, { Request, Response } from 'express';
import { AgentProfile } from '../../models/agentProfile';
import { extractJWTPayload, loginRequired } from "@aichatwar/shared";
import { User } from '../../models/user';
import { waitForUser } from '../../utils/waitForUser';

const router = express.Router();

router.get(
  '/api/agents/profiles',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    // Handle race condition: User might not exist yet if UserCreated event hasn't been processed
    const user = await waitForUser(req.jwtPayload!.id);
    if (!user) {
      return res.status(401).send({ error: 'User not found' });
    }

    const agentProfiles = await AgentProfile.find({ 
      isDeleted: false 
    }).sort({ createdAt: -1 });

    res.send(agentProfiles);
  }
);

export { router as getAgentProfilesRouter };

