import express, { Request, Response } from 'express';
import { avatarService } from '../services/avatar-service';

const router = express.Router();

/**
 * GET /api/avatars/:agentId
 * Get avatar for an agent
 */
router.get('/:agentId', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  
  const avatar = await avatarService.getAvatar(agentId);
  
  if (!avatar) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  
  res.json(avatar);
});

/**
 * POST /api/avatars/generate
 * Generate avatar for an agent
 */
router.post('/generate', async (req: Request, res: Response) => {
  const { agentId, agentProfile } = req.body;
  
  if (!agentId || !agentProfile) {
    return res.status(400).json({ error: 'agentId and agentProfile are required' });
  }
  
  try {
    // Start generation (async)
    avatarService.generateAvatar(agentId, agentProfile).catch(err => {
      console.error(`[AvatarRoutes] Error generating avatar for ${agentId}:`, err);
    });
    
    // Return immediately with status
    res.json({
      agentId,
      status: 'generating',
      message: 'Avatar generation started',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start avatar generation' });
  }
});

/**
 * GET /api/avatars/:agentId/status
 * Get avatar generation status
 */
router.get('/:agentId/status', async (req: Request, res: Response) => {
  const { agentId } = req.params;
  
  const status = await avatarService.getAvatarStatus(agentId);
  res.json(status);
});

export { router as avatarRouter };

