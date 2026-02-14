import type { SubscriptionTierName } from '../../models/cost/subscription-tier';
import { SubscriptionTier } from '../../models/cost/subscription-tier';
import { UserSubscription } from '../../models/cost/user-subscription';
import { UserDailyUsage } from '../../models/cost/user-daily-usage';
import { DEFAULT_TIERS } from './default-tiers';

export type UsageLimitDecision =
  | { allow: true }
  | {
      allow: false;
      reason: 'daily_message_limit' | 'daily_token_limit' | 'daily_cost_cap';
      message: string;
      tierName: SubscriptionTierName;
      day: string;
    };

function utcDayString(d: Date): string {
  // YYYY-MM-DD in UTC
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function utcMonthString(d: Date): string {
  // YYYY-MM in UTC
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export class UsageLimitService {
  isEnforcementEnabled(): boolean {
    // Default to off to avoid breaking existing flows unless explicitly enabled.
    return process.env.COST_MONITORING_ENFORCE_LIMITS === 'true';
  }

  async getUserTier(ownerUserId: string): Promise<SubscriptionTierName> {
    const sub = await UserSubscription.findByOwnerUserId(ownerUserId);
    const defaultTier = (process.env.DEFAULT_SUBSCRIPTION_TIER || 'free').toLowerCase() as SubscriptionTierName;
    return (sub?.tierName?.toLowerCase() as SubscriptionTierName) || defaultTier || 'free';
  }

  async getTierLimits(tierName: SubscriptionTierName): Promise<{
    dailyMessageLimit: number | null;
    dailyTokenLimit: number | null;
    dailyCostCapMicros: number | null;
    capBehavior: 'hard' | 'soft' | 'budget';
  }> {
    const dbTier = await SubscriptionTier.findByTierName(tierName);
    if (dbTier) {
      return {
        dailyMessageLimit: dbTier.dailyMessageLimit,
        dailyTokenLimit: dbTier.dailyTokenLimit,
        dailyCostCapMicros: dbTier.dailyCostCapMicros,
        capBehavior: dbTier.capBehavior,
      };
    }
    return DEFAULT_TIERS[tierName] || DEFAULT_TIERS.free;
  }

  async checkDailyHardCap(ownerUserId: string): Promise<UsageLimitDecision> {
    const tierName = await this.getUserTier(ownerUserId);
    const limits = await this.getTierLimits(tierName);

    // Phase 1: Only enforce hard caps (primarily free). Soft/budget tiers are allowed.
    if (limits.capBehavior !== 'hard') {
      return { allow: true };
    }

    const day = utcDayString(new Date());
    const usage = await UserDailyUsage.findByOwnerUserAndDay(ownerUserId, day);
    const totalMessages = usage?.totalMessages ?? 0;
    const totalTokens = usage?.totalTokens ?? 0;
    const totalCostMicros = usage?.totalCostMicros ?? 0;

    if (limits.dailyCostCapMicros != null && totalCostMicros >= limits.dailyCostCapMicros) {
      return {
        allow: false,
        reason: 'daily_cost_cap',
        message: 'Daily AI cost limit reached. Upgrade your plan to continue.',
        tierName,
        day,
      };
    }
    if (limits.dailyMessageLimit != null && totalMessages >= limits.dailyMessageLimit) {
      return {
        allow: false,
        reason: 'daily_message_limit',
        message: 'Daily AI message limit reached. Upgrade your plan to continue.',
        tierName,
        day,
      };
    }
    if (limits.dailyTokenLimit != null && totalTokens >= limits.dailyTokenLimit) {
      return {
        allow: false,
        reason: 'daily_token_limit',
        message: 'Daily AI token limit reached. Upgrade your plan to continue.',
        tierName,
        day,
      };
    }

    return { allow: true };
  }

  async seedDefaultTierIfMissing(): Promise<void> {
    if (process.env.COST_MONITORING_AUTO_SEED !== 'true') return;

    // Ensure at least "free" exists for enforcement.
    await SubscriptionTier.updateOne(
      { tierName: 'free' },
      {
        $setOnInsert: {
          tierName: 'free',
          dailyMessageLimit: DEFAULT_TIERS.free.dailyMessageLimit,
          dailyTokenLimit: DEFAULT_TIERS.free.dailyTokenLimit,
          dailyCostCapMicros: DEFAULT_TIERS.free.dailyCostCapMicros,
          capBehavior: DEFAULT_TIERS.free.capBehavior,
        },
      },
      { upsert: true }
    );
  }
}

export const utcDayStringForNow = utcDayString;
export const utcMonthStringForNow = utcMonthString;



