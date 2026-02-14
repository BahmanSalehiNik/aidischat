import type { SubscriptionTierName } from '../../models/cost/subscription-tier';

/**
 * Default tier config for Phase 1. Stored in USD micros.
 */
export const DEFAULT_TIERS: Record<
  SubscriptionTierName,
  {
    dailyMessageLimit: number | null;
    dailyTokenLimit: number | null;
    dailyCostCapMicros: number | null;
    capBehavior: 'hard' | 'soft' | 'budget';
  }
> = {
  free: {
    dailyMessageLimit: 50,
    dailyTokenLimit: 25_000,
    dailyCostCapMicros: 0.5 * 1_000_000, // $0.50/day
    capBehavior: 'hard',
  },
  basic: {
    dailyMessageLimit: null,
    dailyTokenLimit: null,
    dailyCostCapMicros: null,
    capBehavior: 'soft',
  },
  pro: {
    dailyMessageLimit: null,
    dailyTokenLimit: null,
    dailyCostCapMicros: null,
    capBehavior: 'soft',
  },
  enterprise: {
    dailyMessageLimit: null,
    dailyTokenLimit: null,
    dailyCostCapMicros: null,
    capBehavior: 'budget',
  },
};



