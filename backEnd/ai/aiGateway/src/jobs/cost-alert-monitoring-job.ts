import { CostAlert, type CostAlertMetric, type CostAlertSeverity } from '../models/cost/cost-alert';
import { UserDailyUsage } from '../models/cost/user-daily-usage';
import { UsageLimitService, utcDayStringForNow } from '../services/usage/usage-limit-service';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const THRESHOLDS = [0.8, 0.9, 1.0] as const;

export class CostAlertMonitoringJob {
  private timer: NodeJS.Timeout | null = null;
  private usageLimitService = new UsageLimitService();

  isEnabled(): boolean {
    return process.env.COST_MONITORING_ALERTS_ENABLED === 'true';
  }

  start(): void {
    if (!this.isEnabled()) return;
    if (this.timer) return;

    const intervalMs = Number(process.env.COST_MONITORING_ALERTS_INTERVAL_MS || DEFAULT_INTERVAL_MS);
    const interval = Number.isFinite(intervalMs) && intervalMs > 1000 ? intervalMs : DEFAULT_INTERVAL_MS;

    // Kick once immediately, then on a schedule.
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), interval);
    console.log(`[CostAlertMonitoringJob] ✅ Started (intervalMs=${interval})`);
  }

  async runOnce(): Promise<void> {
    try {
      const day = utcDayStringForNow(new Date());

      // Only consider users that have any activity today.
      const usages = await UserDailyUsage.find({
        day,
        $or: [{ totalCostMicros: { $gt: 0 } }, { totalTokens: { $gt: 0 } }, { totalMessages: { $gt: 0 } }],
      }).lean();

      const tierLimitCache = new Map<
        string,
        { dailyMessageLimit: number | null; dailyTokenLimit: number | null; dailyCostCapMicros: number | null; capBehavior: string }
      >();

      for (const u of usages) {
        const ownerUserId = u.ownerUserId;
        const tierName = await this.usageLimitService.getUserTier(ownerUserId);

        let limits = tierLimitCache.get(tierName);
        if (!limits) {
          limits = await this.usageLimitService.getTierLimits(tierName);
          tierLimitCache.set(tierName, limits);
        }

        await this.checkMetricAndInsertAlerts({
          ownerUserId,
          day,
          metric: 'daily_cost',
          currentValue: u.totalCostMicros ?? 0,
          limitValue: limits.dailyCostCapMicros,
        });

        await this.checkMetricAndInsertAlerts({
          ownerUserId,
          day,
          metric: 'daily_tokens',
          currentValue: u.totalTokens ?? 0,
          limitValue: limits.dailyTokenLimit,
        });

        await this.checkMetricAndInsertAlerts({
          ownerUserId,
          day,
          metric: 'daily_messages',
          currentValue: u.totalMessages ?? 0,
          limitValue: limits.dailyMessageLimit,
        });
      }
    } catch (err: any) {
      console.error('[CostAlertMonitoringJob] ❌ Failed:', err?.message || err);
    }
  }

  private async checkMetricAndInsertAlerts(params: {
    ownerUserId: string;
    day: string;
    metric: CostAlertMetric;
    currentValue: number;
    limitValue: number | null;
  }): Promise<void> {
    const { ownerUserId, day, metric, currentValue, limitValue } = params;
    if (limitValue == null || limitValue <= 0) return;

    const ratio = currentValue / limitValue;
    for (const threshold of THRESHOLDS) {
      if (ratio < threshold) continue;

      const severity: CostAlertSeverity =
        threshold >= 1.0 ? 'critical' : threshold >= 0.9 ? 'warning' : 'info';

      const pct = Math.round(threshold * 100);
      const humanMetric =
        metric === 'daily_cost' ? 'daily cost cap' : metric === 'daily_tokens' ? 'daily token limit' : 'daily message limit';

      const message =
        threshold >= 1.0
          ? `You reached your ${humanMetric} for today. Upgrade your plan to continue.`
          : `You used ${pct}% of your ${humanMetric} for today.`;

      await CostAlert.updateOne(
        { ownerUserId, day, metric, threshold },
        {
          $setOnInsert: {
            ownerUserId,
            day,
            metric,
            threshold,
            severity,
            currentValue,
            limitValue,
            message,
            acknowledged: false,
          },
        },
        { upsert: true }
      );
    }
  }
}

export const costAlertMonitoringJob = new CostAlertMonitoringJob();


