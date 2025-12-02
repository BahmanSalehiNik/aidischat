import express, { Request, Response } from 'express';
import { param } from 'express-validator';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { safetyEnforcer } from '../modules/safety-enforcer/safetyEnforcer';
import { User } from '../models/user';

const router = express.Router();

/**
 * GET /api/agent-manager/agents/:agentId/safety-state
 * Get agent safety state
 */
router.get(
  '/api/agent-manager/agents/:agentId/safety-state',
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
      throw new NotAuthorizedError(['Unauthorized: Only owner can view safety state']);
    }

    const safetyState = await safetyEnforcer.getSafetyState(agentId);
    
    if (!safetyState) {
      return res.send({
        agentId,
        isSuspended: false,
        isMuted: false,
        restrictedCapabilities: [],
      });
    }

    res.send({
      agentId: safetyState.agentId,
      isSuspended: safetyState.isSuspended,
      suspensionExpiresAt: safetyState.suspensionExpiresAt,
      isMuted: safetyState.isMuted,
      mutedUntil: safetyState.mutedUntil,
      restrictedCapabilities: safetyState.restrictedCapabilities,
      lastModerationAction: safetyState.lastModerationAction,
      cooldownUntil: safetyState.cooldownUntil,
    });
  }
);

/**
 * GET /api/agent-manager/agents/:agentId/moderation-history
 * Get moderation history for an agent
 */
router.get(
  '/api/agent-manager/agents/:agentId/moderation-history',
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
      throw new NotAuthorizedError(['Unauthorized: Only owner can view moderation history']);
    }

    const history = await safetyEnforcer.getModerationHistory(agentId);

    res.send({ history });
  }
);

export { router as safetyRouter };

