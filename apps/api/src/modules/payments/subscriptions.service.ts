import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { gymProfiles, subscriptions } from "../../db/schema.js";
import { loadEnv } from "../../env.js";
import { AppError, notFound } from "../../lib/errors.js";
import { getPricing } from "../../config/pricing.js";
import { canTransitionGym, mapProviderSubscriptionStatus } from "@fightfind/utils";
import type { GymStatus, PaymentProductType, SubscriptionRecord, SubscriptionStatus } from "@fightfind/types";
import type { PaymentProvider, ProviderSubscription } from "./payment.types.js";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { AuditService } from "../audit/audit.service.js";

const SUBSCRIPTION_TOTAL_COUNT = 120;

export class SubscriptionsService {
  constructor(
    private readonly db: Db,
    private readonly provider: PaymentProvider,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  mapSubscription(row: typeof subscriptions.$inferSelect): SubscriptionRecord {
    return {
      id: row.id,
      userId: row.userId,
      gymId: row.gymId,
      type: row.type as PaymentProductType,
      providerPlanId: row.providerPlanId,
      providerSubscriptionId: row.providerSubscriptionId,
      status: row.status as SubscriptionStatus,
      rawProviderStatus: row.rawProviderStatus,
      currentPeriodStart: row.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createFighterUpgrade(userId: string): Promise<{ subscription: SubscriptionRecord; razorpayKeyId: string; testMode: boolean }> {
    const env = loadEnv();
    if (!env.RAZORPAY_FIGHTER_PLAN_ID && this.provider.mode !== "mock") {
      throw new AppError(
        "PRODUCT_NOT_CONFIGURED",
        "Fighter premium is not configured yet (missing RAZORPAY_FIGHTER_PLAN_ID).",
        503,
      );
    }
    const existing = await this.findNonTerminal(userId, "FIGHTER_UPGRADE");
    if (existing) return this.withCheckout(existing);

    const providerSubscription = await this.createProviderSubscription({
      planId: env.RAZORPAY_FIGHTER_PLAN_ID || "plan_mock_fighter",
      totalCount: SUBSCRIPTION_TOTAL_COUNT,
      notes: { product: "FIGHTER_UPGRADE", userId },
    });

    const [row] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        type: "FIGHTER_UPGRADE",
        providerPlanId: providerSubscription.planId,
        providerSubscriptionId: providerSubscription.id,
        status: mapProviderSubscriptionStatus(providerSubscription.status),
        rawProviderStatus: providerSubscription.status,
        currentPeriodEnd: providerSubscription.currentEnd
          ? new Date(providerSubscription.currentEnd * 1000)
          : null,
      })
      .returning();
    if (!row) throw new Error("Failed to create subscription");

    await this.audit.record({
      actorUserId: userId,
      action: "SUBSCRIPTION_CREATED",
      entityType: "subscription",
      entityId: row.id,
      metadata: { type: "FIGHTER_UPGRADE", providerSubscriptionId: providerSubscription.id },
    });
    return this.withCheckout(row);
  }

  async createGymPlatform(
    userId: string,
    gymId: string,
  ): Promise<{ subscription: SubscriptionRecord; razorpayKeyId: string; testMode: boolean }> {
    const env = loadEnv();
    const [gym] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId)).limit(1);
    if (!gym) throw notFound("GYM_NOT_FOUND", "Gym not found");
    if (gym.ownerUserId !== userId) throw notFound("GYM_NOT_OWNER", "You do not manage this gym.");
    if (!gym.listingFeePaymentId) {
      throw new AppError("LISTING_PAYMENT_REQUIRED", "Pay the one-time listing fee before starting the monthly plan.", 409);
    }
    if (!env.RAZORPAY_GYM_PLAN_ID && this.provider.mode !== "mock") {
      throw new AppError("PRODUCT_NOT_CONFIGURED", "Gym platform plan is not configured yet.", 503);
    }

    const existing = await this.findNonTerminal(userId, "GYM_PLATFORM_SUBSCRIPTION", gymId);
    if (existing) return this.withCheckout(existing);

    const providerSubscription = await this.createProviderSubscription({
      planId: env.RAZORPAY_GYM_PLAN_ID || "plan_mock_gym",
      totalCount: SUBSCRIPTION_TOTAL_COUNT,
      notes: { product: "GYM_PLATFORM_SUBSCRIPTION", gymId, userId },
    });

    const [row] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        gymId,
        type: "GYM_PLATFORM_SUBSCRIPTION",
        providerPlanId: providerSubscription.planId,
        providerSubscriptionId: providerSubscription.id,
        status: mapProviderSubscriptionStatus(providerSubscription.status),
        rawProviderStatus: providerSubscription.status,
      })
      .returning();
    if (!row) throw new Error("Failed to create subscription");

    await this.audit.record({
      actorUserId: userId,
      action: "SUBSCRIPTION_CREATED",
      entityType: "subscription",
      entityId: row.id,
      metadata: { type: "GYM_PLATFORM_SUBSCRIPTION", gymId, providerSubscriptionId: providerSubscription.id },
    });
    return this.withCheckout(row);
  }

  private async createProviderSubscription(
    params: Parameters<PaymentProvider["createSubscription"]>[0],
  ) {
    try {
      return await this.provider.createSubscription(params);
    } catch (error) {
      // e.g. Razorpay Subscriptions not enabled on the account. The client then
      // falls back to a one-time monthly order when that is allowed.
      if (loadEnv().SUBSCRIPTIONS_FALLBACK_TO_ORDERS) {
        throw new AppError(
          "PRODUCT_NOT_CONFIGURED",
          "Subscriptions are not available on this payment account yet.",
          503,
        );
      }
      throw error;
    }
  }

  private withCheckout(row: typeof subscriptions.$inferSelect) {
    return {
      subscription: this.mapSubscription(row),
      razorpayKeyId: this.provider.publicKeyId ?? "",
      testMode: this.provider.mode !== "live",
    };
  }

  private async findNonTerminal(userId: string, type: PaymentProductType, gymId?: string) {
    const conditions = [
      eq(subscriptions.userId, userId),
      eq(subscriptions.type, type),
      inArray(subscriptions.status, ["pending", "active", "halted"]),
    ];
    if (gymId) conditions.push(eq(subscriptions.gymId, gymId));
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return row ?? null;
  }

  async getForUser(subscriptionId: string, userId: string): Promise<SubscriptionRecord> {
    const [row] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!row) throw notFound("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (row.userId !== userId) throw notFound("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    return this.mapSubscription(row);
  }

  /**
   * Pulls the authoritative state from the provider and syncs it. Lets
   * subscriptions activate without a webhook being configured.
   */
  async syncNow(subscriptionId: string, userId: string): Promise<SubscriptionRecord> {
    const [row] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!row || row.userId !== userId) throw notFound("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (!row.providerSubscriptionId) return this.mapSubscription(row);
    try {
      const providerSubscription = await this.provider.fetchSubscription(row.providerSubscriptionId);
      await this.syncFromProvider(providerSubscription);
    } catch (error) {
      console.warn("[subscriptions] sync failed (ignored):", error);
    }
    const [fresh] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, row.id)).limit(1);
    return this.mapSubscription(fresh ?? row);
  }

  async cancel(
    subscriptionId: string,
    userId: string,
    cancelAtPeriodEnd: boolean,
  ): Promise<SubscriptionRecord> {
    const [row] = await this.db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!row || row.userId !== userId) throw notFound("SUBSCRIPTION_NOT_FOUND", "Subscription not found");
    if (row.status === "cancelled") return this.mapSubscription(row);

    // Monthly-order fallback subscriptions have no provider reference; cancel
    // them locally (they do not auto-renew anyway).
    if (!row.providerSubscriptionId) {
      const [updated] = await this.db
        .update(subscriptions)
        .set({ status: "cancelled", cancelAtPeriodEnd, updatedAt: new Date() })
        .where(eq(subscriptions.id, row.id))
        .returning();
      await this.audit.record({
        actorUserId: userId,
        action: "SUBSCRIPTION_CANCELLED",
        entityType: "subscription",
        entityId: row.id,
        metadata: { cancelAtPeriodEnd, mode: "monthly_order" },
      });
      return this.mapSubscription(updated ?? row);
    }

    const providerSubscription = await this.provider.cancelSubscription(
      row.providerSubscriptionId,
      cancelAtPeriodEnd,
    );
    const [updated] = await this.db
      .update(subscriptions)
      .set({
        status: mapProviderSubscriptionStatus(providerSubscription.status),
        rawProviderStatus: providerSubscription.status,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, row.id))
      .returning();
    await this.audit.record({
      actorUserId: userId,
      action: "SUBSCRIPTION_CANCELLED",
      entityType: "subscription",
      entityId: row.id,
      metadata: { cancelAtPeriodEnd, providerStatus: providerSubscription.status },
    });
    return this.mapSubscription(updated ?? row);
  }

  /**
   * Applies a provider subscription snapshot from a webhook. Idempotent: the
   * row is updated by provider subscription id, and repeated events converge
   * to the same state.
   */
  async syncFromProvider(providerSubscription: ProviderSubscription): Promise<void> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, providerSubscription.id))
      .limit(1);
    if (!row) return; // Subscription created outside FightFind — ignore.

    const status = mapProviderSubscriptionStatus(providerSubscription.status);
    const [updated] = await this.db
      .update(subscriptions)
      .set({
        status,
        rawProviderStatus: providerSubscription.status,
        currentPeriodStart: providerSubscription.currentStart
          ? new Date(providerSubscription.currentStart * 1000)
          : row.currentPeriodStart,
        currentPeriodEnd: providerSubscription.currentEnd
          ? new Date(providerSubscription.currentEnd * 1000)
          : row.currentPeriodEnd,
        cancelAtPeriodEnd:
          providerSubscription.status === "cancelled" ? row.cancelAtPeriodEnd : row.cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, row.id))
      .returning();
    if (!updated) return;

    if (updated.type === "FIGHTER_UPGRADE") {
      await this.applyFighterEffects(updated, providerSubscription);
    } else if (updated.type === "GYM_PLATFORM_SUBSCRIPTION" && updated.gymId) {
      await this.applyGymEffects(updated, providerSubscription);
    }
  }

  private async applyFighterEffects(
    subscription: typeof subscriptions.$inferSelect,
    providerSubscription: ProviderSubscription,
  ) {
    if (subscription.status === "active" && providerSubscription.status === "charged") {
      await this.notifications.notify({
        userId: subscription.userId,
        type: "PREMIUM_RENEWED",
        title: "FightFind Pro renewed",
        body: "Your FightFind Pro subscription was renewed. Premium features remain active.",
        data: { subscriptionId: subscription.id },
      });
      await this.audit.record({
        actorUserId: subscription.userId,
        action: "SUBSCRIPTION_RENEWED",
        entityType: "subscription",
        entityId: subscription.id,
        metadata: { type: "FIGHTER_UPGRADE" },
      });
    }
    if (subscription.status === "halted" || subscription.status === "payment_failed") {
      await this.notifications.notify({
        userId: subscription.userId,
        type: "SUBSCRIPTION_FAILED",
        title: "FightFind Pro payment failed",
        body: "We could not renew your FightFind Pro subscription. Update your payment method to keep premium features.",
        data: { subscriptionId: subscription.id },
      });
      await this.audit.record({
        actorUserId: subscription.userId,
        action: "SUBSCRIPTION_PAYMENT_FAILED",
        entityType: "subscription",
        entityId: subscription.id,
        metadata: { type: "FIGHTER_UPGRADE", providerStatus: providerSubscription.status },
      });
    }
  }

  private async applyGymEffects(
    subscription: typeof subscriptions.$inferSelect,
    providerSubscription: ProviderSubscription,
  ) {
    if (!subscription.gymId) return;
    const [gym] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, subscription.gymId)).limit(1);
    if (!gym) return;

    if (subscription.status === "active") {
      if (gym.subscriptionFailedAt) {
        await this.db
          .update(gymProfiles)
          .set({ subscriptionFailedAt: null, updatedAt: new Date() })
          .where(eq(gymProfiles.id, gym.id));
      }
      if (gym.status === "onboarding" && canTransitionGym(gym.status as GymStatus, "pending_verification")) {
        await this.db
          .update(gymProfiles)
          .set({ status: "pending_verification", updatedAt: new Date() })
          .where(eq(gymProfiles.id, gym.id));
      }
      await this.notifications.notify({
        userId: subscription.userId,
        type: "SUBSCRIPTION_RENEWED",
        title: "FightFind platform plan active",
        body: `Your monthly FightFind plan for ${gym.name} is active.`,
        data: { gymId: gym.id, subscriptionId: subscription.id },
      });
      await this.audit.record({
        actorUserId: subscription.userId,
        action: "GYM_SUBSCRIPTION_ACTIVE",
        entityType: "gym_profile",
        entityId: gym.id,
        metadata: { subscriptionId: subscription.id, providerStatus: providerSubscription.status },
      });
      return;
    }

    if (["halted", "cancelled", "payment_failed", "expired"].includes(subscription.status)) {
      await this.db
        .update(gymProfiles)
        .set({ subscriptionFailedAt: gym.subscriptionFailedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(gymProfiles.id, gym.id));
      await this.notifications.notify({
        userId: subscription.userId,
        type: "SUBSCRIPTION_FAILED",
        title: "FightFind plan payment failed",
        body: `Your monthly FightFind plan for ${gym.name} needs attention. The listing will be suspended after the grace period.`,
        data: { gymId: gym.id, subscriptionId: subscription.id },
      });
      await this.audit.record({
        actorUserId: subscription.userId,
        action: "GYM_SUBSCRIPTION_PAYMENT_FAILED",
        entityType: "gym_profile",
        entityId: gym.id,
        metadata: { subscriptionId: subscription.id, providerStatus: providerSubscription.status },
      });
    }
  }

  /**
   * Maintenance: suspends listed gyms whose platform subscription has been
   * failing beyond the configured grace period. Called by admin maintenance.
   */
  async enforceGymSuspensions(now = new Date()): Promise<number> {
    const env = loadEnv();
    const cutoff = new Date(now.getTime() - env.GYM_SUBSCRIPTION_GRACE_DAYS * 86_400_000);
    const gyms = await this.db
      .select({ id: gymProfiles.id, name: gymProfiles.name, ownerUserId: gymProfiles.ownerUserId })
      .from(gymProfiles)
      .where(
        and(
          eq(gymProfiles.status, "active"),
          isNotNull(gymProfiles.subscriptionFailedAt),
          lt(gymProfiles.subscriptionFailedAt, cutoff),
        ),
      );
    for (const gym of gyms) {
      await this.db
        .update(gymProfiles)
        .set({ status: "suspended", updatedAt: now })
        .where(eq(gymProfiles.id, gym.id));
      await this.notifications.notify({
        userId: gym.ownerUserId,
        type: "SYSTEM",
        title: "Listing suspended",
        body: `${gym.name} has been suspended because the FightFind monthly plan was not renewed. Update billing to restore it.`,
        data: { gymId: gym.id },
      });
      await this.audit.record({
        actorUserId: null,
        action: "GYM_SUSPENDED",
        entityType: "gym_profile",
        entityId: gym.id,
        metadata: { reason: "SUBSCRIPTION_GRACE_EXPIRED" },
      });
    }
    return gyms.length;
  }

  /** Test helper + admin: number of active platform subscriptions. */
  async countActiveGymSubscriptions(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(and(eq(subscriptions.type, "GYM_PLATFORM_SUBSCRIPTION"), eq(subscriptions.status, "active")));
    return row?.count ?? 0;
  }

  getPricingSummary() {
    return getPricing();
  }
}
