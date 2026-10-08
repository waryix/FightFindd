import { and, desc, eq, gte, or, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { subscriptions } from "../../db/schema.js";
import { FREE_TIER_PENDING_REQUEST_LIMIT, type Entitlements } from "@fightfind/types";

/**
 * Single source of truth for premium capabilities. Premium state is always
 * derived from subscription records — never trusted from clients.
 */
export class EntitlementsService {
  constructor(private readonly db: Db) {}

  async getForUser(userId: string): Promise<Entitlements> {
    const now = new Date();
    const [active] = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.type, "FIGHTER_UPGRADE"),
          eq(subscriptions.status, "active"),
          or(isNull(subscriptions.currentPeriodEnd), gte(subscriptions.currentPeriodEnd, now)),
        ),
      )
      .orderBy(desc(subscriptions.currentPeriodEnd))
      .limit(1);

    const isPremium = Boolean(active);
    return {
      isPremium,
      premiumUntil: active?.currentPeriodEnd?.toISOString() ?? null,
      canUseAdvancedFilters: isPremium,
      canSendUnlimitedRequests: isPremium,
      hasProfileBoost: isPremium,
      pendingRequestLimit: isPremium ? null : FREE_TIER_PENDING_REQUEST_LIMIT,
    };
  }

  async isPremium(userId: string): Promise<boolean> {
    return (await this.getForUser(userId)).isPremium;
  }
}
