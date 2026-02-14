import express, { type Request, type Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { CostAlert } from '../models/cost/cost-alert';

function asNumber(value: any, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export const alertsRouter = express.Router();

/**
 * GET /api/ai-gateway/alerts?days=7
 * Returns recent cost alerts for the current user.
 */
alertsRouter.get('/api/ai-gateway/alerts', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const ownerUserId = (req as any).jwtPayload!.id as string;
  const days = Math.max(1, Math.min(30, asNumber(req.query.days, 7)));

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await CostAlert.find({ ownerUserId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(200);

  res.status(200).send({
    ownerUserId,
    days,
    items: rows.map((a) => ({
      id: a.id,
      day: a.day,
      metric: a.metric,
      threshold: a.threshold,
      severity: a.severity,
      currentValue: a.currentValue,
      limitValue: a.limitValue,
      message: a.message,
      acknowledged: a.acknowledged,
      createdAt: a.createdAt,
    })),
  });
});

// Alias (user-facing): /api/alerts
alertsRouter.get('/api/alerts', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const ownerUserId = (req as any).jwtPayload!.id as string;
  const days = Math.max(1, Math.min(30, asNumber(req.query.days, 7)));

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await CostAlert.find({ ownerUserId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(200);

  res.status(200).send({
    ownerUserId,
    days,
    items: rows.map((a) => ({
      id: a.id,
      day: a.day,
      metric: a.metric,
      threshold: a.threshold,
      severity: a.severity,
      currentValue: a.currentValue,
      limitValue: a.limitValue,
      message: a.message,
      acknowledged: a.acknowledged,
      createdAt: a.createdAt,
    })),
  });
});


