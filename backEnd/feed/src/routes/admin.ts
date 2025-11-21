import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { trendingWorker } from '../modules/trending/trendingWorker';

const router = express.Router();

/**
 * POST /api/feed/admin/trending/refresh
 * Manually trigger trending refresh
 * Requires authentication (can be enhanced with admin role check)
 */
router.post(
  '/api/feed/admin/trending/refresh',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const manualTriggerEnabled = process.env.TRENDING_MANUAL_TRIGGER_ENABLED !== 'false';
    
    if (!manualTriggerEnabled) {
      return res.status(403).json({
        success: false,
        error: 'Manual trigger is disabled',
      });
    }

    try {
      await trendingWorker.refreshNow();
      res.status(200).json({
        success: true,
        message: 'Trending refresh triggered',
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to trigger trending refresh',
      });
    }
  }
);

/**
 * GET /api/feed/admin/trending/status
 * Get trending worker status
 * No authentication required (can be added if needed)
 */
router.get(
  '/api/feed/admin/trending/status',
  async (req: Request, res: Response) => {
    const status = trendingWorker.getStatus();
    res.json({
      enabled: status.enabled,
      isRunning: status.isRunning,
      lastRunTime: status.lastRunTime?.toISOString() || null,
      lastError: status.lastError?.message || null,
      schedule: status.schedule,
    });
  }
);

export { router as adminRouter };

