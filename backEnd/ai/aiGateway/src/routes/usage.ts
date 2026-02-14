import express, { type Request, type Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { LlmInteraction } from '../models/cost/llm-interaction';
import { UserDailyUsage } from '../models/cost/user-daily-usage';
import { UserMonthlyUsage } from '../models/cost/user-monthly-usage';
import { UsageLimitService, utcDayStringForNow, utcMonthStringForNow } from '../services/usage/usage-limit-service';

const usageLimitService = new UsageLimitService();

function asNumber(value: any, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonthsUtc(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 0, 0, 0, 0));
}

export const usageRouter = express.Router();

/**
 * GET /api/ai-gateway/usage/current
 * Returns today's usage + month-to-date usage (real-time aggregates) + tier limits.
 */
usageRouter.get(
  '/api/ai-gateway/usage/current',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();
    const day = utcDayStringForNow(now);
    const month = utcMonthStringForNow(now);

    const [daily, monthly, tierName] = await Promise.all([
      UserDailyUsage.findByOwnerUserAndDay(ownerUserId, day),
      UserMonthlyUsage.findByOwnerUserAndMonth(ownerUserId, month),
      usageLimitService.getUserTier(ownerUserId),
    ]);

    const limits = await usageLimitService.getTierLimits(tierName);

    const dayUsage = {
      day,
      totalAiCalls: daily?.totalAiCalls ?? 0,
      totalMessages: daily?.totalMessages ?? 0,
      totalTokens: daily?.totalTokens ?? 0,
      totalCostMicros: daily?.totalCostMicros ?? 0,
    };

    const monthUsage = {
      month,
      totalAiCalls: monthly?.totalAiCalls ?? 0,
      totalMessages: monthly?.totalMessages ?? 0,
      totalTokens: monthly?.totalTokens ?? 0,
      totalCostMicros: monthly?.totalCostMicros ?? 0,
    };

    const percent = (value: number, cap: number | null) => {
      if (cap == null || cap <= 0) return null;
      return Math.min(1, value / cap);
    };

    res.status(200).send({
      ownerUserId,
      tierName,
      limits,
      day: {
        ...dayUsage,
        percentOfCostCap: percent(dayUsage.totalCostMicros, limits.dailyCostCapMicros),
        percentOfTokenCap: percent(dayUsage.totalTokens, limits.dailyTokenLimit),
        percentOfMessageCap: percent(dayUsage.totalMessages, limits.dailyMessageLimit),
      },
      monthToDate: monthUsage,
      timestamp: now.toISOString(),
    });
  }
);

// Alias (user-facing): /api/usage/*
usageRouter.get(
  '/api/usage/current',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    // delegate by calling the same logic via a local redirect-less reimplementation (keep behavior identical)
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();
    const day = utcDayStringForNow(now);
    const month = utcMonthStringForNow(now);

    const [daily, monthly, tierName] = await Promise.all([
      UserDailyUsage.findByOwnerUserAndDay(ownerUserId, day),
      UserMonthlyUsage.findByOwnerUserAndMonth(ownerUserId, month),
      usageLimitService.getUserTier(ownerUserId),
    ]);

    const limits = await usageLimitService.getTierLimits(tierName);

    const dayUsage = {
      day,
      totalAiCalls: daily?.totalAiCalls ?? 0,
      totalMessages: daily?.totalMessages ?? 0,
      totalTokens: daily?.totalTokens ?? 0,
      totalCostMicros: daily?.totalCostMicros ?? 0,
    };

    const monthUsage = {
      month,
      totalAiCalls: monthly?.totalAiCalls ?? 0,
      totalMessages: monthly?.totalMessages ?? 0,
      totalTokens: monthly?.totalTokens ?? 0,
      totalCostMicros: monthly?.totalCostMicros ?? 0,
    };

    const percent = (value: number, cap: number | null) => {
      if (cap == null || cap <= 0) return null;
      return Math.min(1, value / cap);
    };

    res.status(200).send({
      ownerUserId,
      tierName,
      limits,
      day: {
        ...dayUsage,
        percentOfCostCap: percent(dayUsage.totalCostMicros, limits.dailyCostCapMicros),
        percentOfTokenCap: percent(dayUsage.totalTokens, limits.dailyTokenLimit),
        percentOfMessageCap: percent(dayUsage.totalMessages, limits.dailyMessageLimit),
      },
      monthToDate: monthUsage,
      timestamp: now.toISOString(),
    });
  }
);

/**
 * GET /api/ai-gateway/usage/history?days=30
 * Returns last N days of daily aggregates.
 */
usageRouter.get(
  '/api/ai-gateway/usage/history',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const days = Math.max(1, Math.min(180, asNumber(req.query.days, 30)));

    const now = new Date();
    const endDay = utcDayStringForNow(now);
    const startDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const startDay = utcDayStringForNow(startDate);

    const rows = await UserDailyUsage.find({
      ownerUserId,
      day: { $gte: startDay, $lte: endDay },
    })
      .sort({ day: -1 })
      .limit(days);

    res.status(200).send({
      ownerUserId,
      days,
      fromDay: startDay,
      toDay: endDay,
      items: rows.map((r) => ({
        day: r.day,
        totalAiCalls: r.totalAiCalls,
        totalMessages: r.totalMessages,
        totalTokens: r.totalTokens,
        totalCostMicros: r.totalCostMicros,
      })),
    });
  }
);

usageRouter.get(
  '/api/usage/history',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const days = Math.max(1, Math.min(180, asNumber(req.query.days, 30)));

    const now = new Date();
    const endDay = utcDayStringForNow(now);
    const startDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const startDay = utcDayStringForNow(startDate);

    const rows = await UserDailyUsage.find({
      ownerUserId,
      day: { $gte: startDay, $lte: endDay },
    })
      .sort({ day: -1 })
      .limit(days);

    res.status(200).send({
      ownerUserId,
      days,
      fromDay: startDay,
      toDay: endDay,
      items: rows.map((r) => ({
        day: r.day,
        totalAiCalls: r.totalAiCalls,
        totalMessages: r.totalMessages,
        totalTokens: r.totalTokens,
        totalCostMicros: r.totalCostMicros,
      })),
    });
  }
);

/**
 * GET /api/ai-gateway/usage/breakdown?from=<iso>&to=<iso>&limit=50
 * Returns a cost breakdown grouped by agent/model/provider/feature for the given period.
 */
usageRouter.get(
  '/api/ai-gateway/usage/breakdown',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();

    const to = req.query.to ? new Date(String(req.query.to)) : now;
    const from =
      req.query.from != null ? new Date(String(req.query.from)) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const limit = Math.max(1, Math.min(200, asNumber(req.query.limit, 50)));

    const items = await LlmInteraction.aggregate([
      {
        $match: {
          ownerUserId,
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            agentId: '$agentId',
            provider: '$provider',
            modelName: '$modelName',
            feature: '$feature',
          },
          totalCostMicros: { $sum: '$estimatedCostMicros' },
          totalTokens: { $sum: '$totalTokens' },
          totalPromptTokens: { $sum: '$promptTokens' },
          totalCompletionTokens: { $sum: '$completionTokens' },
          calls: { $sum: 1 },
          errors: {
            $sum: {
              $cond: [{ $ne: ['$errorMessage', null] }, 1, 0],
            },
          },
        },
      },
      { $sort: { totalCostMicros: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          agentId: '$_id.agentId',
          provider: '$_id.provider',
          modelName: '$_id.modelName',
          feature: '$_id.feature',
          calls: 1,
          errors: 1,
          totalTokens: 1,
          totalPromptTokens: 1,
          totalCompletionTokens: 1,
          totalCostMicros: 1,
        },
      },
    ]);

    res.status(200).send({
      ownerUserId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
      items,
    });
  }
);

usageRouter.get(
  '/api/usage/breakdown',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();

    const to = req.query.to ? new Date(String(req.query.to)) : now;
    const from =
      req.query.from != null ? new Date(String(req.query.from)) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const limit = Math.max(1, Math.min(200, asNumber(req.query.limit, 50)));

    const items = await LlmInteraction.aggregate([
      {
        $match: {
          ownerUserId,
          startedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            agentId: '$agentId',
            provider: '$provider',
            modelName: '$modelName',
            feature: '$feature',
          },
          totalCostMicros: { $sum: '$estimatedCostMicros' },
          totalTokens: { $sum: '$totalTokens' },
          totalPromptTokens: { $sum: '$promptTokens' },
          totalCompletionTokens: { $sum: '$completionTokens' },
          calls: { $sum: 1 },
          errors: {
            $sum: {
              $cond: [{ $ne: ['$errorMessage', null] }, 1, 0],
            },
          },
        },
      },
      { $sort: { totalCostMicros: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          agentId: '$_id.agentId',
          provider: '$_id.provider',
          modelName: '$_id.modelName',
          feature: '$_id.feature',
          calls: 1,
          errors: 1,
          totalTokens: 1,
          totalPromptTokens: 1,
          totalCompletionTokens: 1,
          totalCostMicros: 1,
        },
      },
    ]);

    res.status(200).send({
      ownerUserId,
      from: from.toISOString(),
      to: to.toISOString(),
      limit,
      items,
    });
  }
);

/**
 * GET /api/ai-gateway/usage/forecast
 * Naive forecast using month-to-date spend × (days in month / days elapsed).
 */
usageRouter.get(
  '/api/ai-gateway/usage/forecast',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();
    const month = utcMonthStringForNow(now);

    const monthly = await UserMonthlyUsage.findByOwnerUserAndMonth(ownerUserId, month);
    const monthCostMicros = monthly?.totalCostMicros ?? 0;

    const monthStart = startOfUtcMonth(now);
    const nextMonthStart = addMonthsUtc(monthStart, 1);
    const daysInMonth = Math.round((nextMonthStart.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)));
    const projectedCostMicros = Math.round((monthCostMicros / daysElapsed) * daysInMonth);

    res.status(200).send({
      ownerUserId,
      month,
      monthToDateCostMicros: monthCostMicros,
      daysElapsed,
      daysInMonth,
      projectedCostMicros,
      timestamp: now.toISOString(),
    });
  }
);

usageRouter.get(
  '/api/usage/forecast',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const ownerUserId = (req as any).jwtPayload!.id as string;
    const now = new Date();
    const month = utcMonthStringForNow(now);

    const monthly = await UserMonthlyUsage.findByOwnerUserAndMonth(ownerUserId, month);
    const monthCostMicros = monthly?.totalCostMicros ?? 0;

    const monthStart = startOfUtcMonth(now);
    const nextMonthStart = addMonthsUtc(monthStart, 1);
    const daysInMonth = Math.round((nextMonthStart.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000));
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)));
    const projectedCostMicros = Math.round((monthCostMicros / daysElapsed) * daysInMonth);

    res.status(200).send({
      ownerUserId,
      month,
      monthToDateCostMicros: monthCostMicros,
      daysElapsed,
      daysInMonth,
      projectedCostMicros,
      timestamp: now.toISOString(),
    });
  }
);


