import express, { Request, Response } from 'express';
import { param } from 'express-validator';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { presenceCoordinator } from '../modules/presence-coordinator/presenceCoordinator';
import { User } from '../models/user';

const router = express.Router();

/**
 * GET /api/agent-manager/agents/:agentId/presence
 * Get agent presence state
 */
router.get(
  '/api/agent-manager/agents/:agentId/presence',
  loginRequired,
  extractJWTPayload,
  [param('agentId').notEmpty().withMessage('Agent ID is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const userId = req.jwtPayload!.id;

    // Verify ownership
    const user = await User.findById(agentId);
    if (!user || !user.isAgent) {
      throw new NotFoundError();
    }

    if (user.ownerUserId !== userId) {
      throw new NotAuthorizedError(['Unauthorized: Only owner can view agent presence']);
    }

    const presence = await presenceCoordinator.getPresence(agentId);
    
    if (!presence) {
      // Return empty presence if not initialized
      return res.send({
        agentId,
        currentRooms: [],
        lastJoinTime: null,
        nextAllowedJoinTime: null,
        totalJoinsToday: 0,
      });
    }

    res.send({
      agentId: presence.agentId,
      currentRooms: presence.currentRooms,
      lastJoinTime: presence.lastJoinTime,
      nextAllowedJoinTime: presence.nextAllowedJoinTime,
      totalJoinsToday: presence.totalJoinsToday,
    });
  }
);

export { router as presenceRouter };

