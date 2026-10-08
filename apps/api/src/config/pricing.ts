import { DEFAULT_PRICING_PAISE } from "@fightfind/types";
import { loadEnv } from "../env.js";

export interface PricingConfig {
  fighterPremiumMonthlyPaise: number;
  gymListingFeePaise: number;
  gymPlatformMonthlyPaise: number;
  platformCommissionPercent: number;
}

let cached: PricingConfig | null = null;

export function getPricing(): PricingConfig {
  if (cached) return cached;
  const env = loadEnv();
  cached = {
    fighterPremiumMonthlyPaise: env.FIGHTER_PREMIUM_MONTHLY_PAISE || DEFAULT_PRICING_PAISE.FIGHTER_PREMIUM_MONTHLY,
    gymListingFeePaise: env.GYM_LISTING_FEE_PAISE || DEFAULT_PRICING_PAISE.GYM_LISTING_FEE,
    gymPlatformMonthlyPaise: env.GYM_PLATFORM_MONTHLY_PAISE || DEFAULT_PRICING_PAISE.GYM_PLATFORM_MONTHLY,
    platformCommissionPercent: env.PLATFORM_COMMISSION_PERCENT,
  };
  return cached;
}

export function resetPricingCache() {
  cached = null;
}

/** Suspension grace period after a failed gym platform subscription (days). */
export const GYM_SUBSCRIPTION_GRACE_DAYS = 7;

/** Premium pending-request cap for free fighters. */
export { FREE_TIER_PENDING_REQUEST_LIMIT } from "@fightfind/types";
