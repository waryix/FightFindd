import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { gymProfiles, payments, refunds, subscriptions } from "../../db/schema.js";
import { AppError, notFound } from "../../lib/errors.js";
import { canTransitionGym } from "@fightfind/utils";
import type {
  PaymentRecord,
  PaymentStatus,
  VerifyPaymentInput,
  VerifyPaymentResponse,
} from "@fightfind/types";
import type { PaymentProvider } from "./payment.types.js";
import type { MembershipService } from "../gyms/membership.service.js";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { AuditService } from "../audit/audit.service.js";
import type { RouteService } from "./route.service.js";

export interface PaymentServiceDeps {
  db: Db;
  provider: PaymentProvider;
  memberships: MembershipService;
  notifications: NotificationService;
  audit: AuditService;
  route: RouteService;
}

export class PaymentService {
  constructor(private readonly deps: PaymentServiceDeps) {}

  private get db() {
    return this.deps.db;
  }

  mapPayment(row: typeof payments.$inferSelect): PaymentRecord {
    return {
      id: row.id,
      userId: row.userId,
      gymId: row.gymId,
      fighterId: row.fighterUserId,
      type: row.type as PaymentRecord["type"],
      amountPaise: row.amountPaise,
      currency: row.currency,
      provider: row.provider,
      providerOrderId: row.providerOrderId,
      providerPaymentId: row.providerPaymentId,
      providerSubscriptionId: row.providerSubscriptionId,
      status: row.status as PaymentStatus,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getById(paymentId: string): Promise<PaymentRecord | null> {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    return row ? this.mapPayment(row) : null;
  }

  async getForUser(paymentId: string, userId: string): Promise<PaymentRecord> {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!row) throw notFound("PAYMENT_NOT_FOUND", "Payment not found");
    if (row.userId !== userId) {
      // Gym owners may also view payments tied to their gym.
      const [gym] = row.gymId
        ? await this.db
            .select({ ownerUserId: gymProfiles.ownerUserId })
            .from(gymProfiles)
            .where(eq(gymProfiles.id, row.gymId))
            .limit(1)
        : [];
      if (!gym || gym.ownerUserId !== userId) {
        throw notFound("PAYMENT_NOT_FOUND", "Payment not found");
      }
    }
    return this.mapPayment(row);
  }

  /**
   * Client-side verification of a Checkout callback. The signature proves the
   * callback came from Razorpay for our order; the server then fetches the
   * payment and confirms amount/currency before anything is activated.
   */
  async verifyClientPayment(params: {
    userId: string;
    input: VerifyPaymentInput;
  }): Promise<VerifyPaymentResponse> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerOrderId, params.input.razorpayOrderId))
      .limit(1);
    if (!payment || payment.userId !== params.userId) {
      throw notFound("PAYMENT_NOT_FOUND", "Payment not found for this order.");
    }

    if (payment.status === "captured" || payment.status === "refunded" || payment.status === "partially_refunded") {
      return this.buildVerifyResponse(payment);
    }

    if (
      !this.deps.provider.verifyPaymentSignature({
        orderId: params.input.razorpayOrderId,
        paymentId: params.input.razorpayPaymentId,
        signature: params.input.razorpaySignature,
      })
    ) {
      await this.deps.audit.record({
        actorUserId: params.userId,
        action: "PAYMENT_SIGNATURE_INVALID",
        entityType: "payment",
        entityId: payment.id,
        metadata: { providerOrderId: params.input.razorpayOrderId },
      });
      throw new AppError("PAYMENT_SIGNATURE_INVALID", "Payment verification failed. No charge was activated.", 400);
    }

    const providerPayment = await this.deps.provider.fetchPayment(params.input.razorpayPaymentId);
    if (providerPayment.id !== params.input.razorpayPaymentId) {
      throw new AppError("PAYMENT_VERIFICATION_FAILED", "Payment could not be verified.", 400);
    }
    if (providerPayment.amountPaise !== payment.amountPaise || providerPayment.currency !== payment.currency) {
      await this.deps.audit.record({
        actorUserId: params.userId,
        action: "PAYMENT_AMOUNT_MISMATCH",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          expectedPaise: payment.amountPaise,
          receivedPaise: providerPayment.amountPaise,
          currency: providerPayment.currency,
        },
      });
      throw new AppError(
        "PAYMENT_AMOUNT_MISMATCH",
        "The paid amount does not match the order. Contact support before retrying.",
        409,
      );
    }

    if (providerPayment.status === "captured") {
      const captured = await this.markCaptured({
        providerOrderId: params.input.razorpayOrderId,
        providerPaymentId: providerPayment.id,
      });
      return this.buildVerifyResponse(captured ?? payment);
    }

    if (providerPayment.status === "authorized") {
      await this.db
        .update(payments)
        .set({ status: "processing", providerPaymentId: providerPayment.id, updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      const updated = await this.getById(payment.id);
      return {
        paymentId: payment.id,
        status: updated?.status ?? "processing",
        businessState: {},
      };
    }

    await this.markFailed({
      providerOrderId: params.input.razorpayOrderId,
      providerPaymentId: providerPayment.id,
      reason: providerPayment.errorDescription ?? "Payment failed at the provider.",
    });
    throw new AppError("PAYMENT_VERIFICATION_FAILED", providerPayment.errorDescription ?? "Payment failed.", 402);
  }

  /**
   * Marks a payment captured. Idempotent: repeated webhooks or callbacks
   * transition the payment exactly once and apply business effects once.
   */
  async markCaptured(params: {
    providerOrderId?: string;
    providerPaymentId: string;
  }): Promise<PaymentRecord | null> {
    const conditions = [eq(payments.providerPaymentId, params.providerPaymentId)];
    const [byPayment] = await this.db.select().from(payments).where(and(...conditions)).limit(1);
    const existing =
      byPayment ??
      (params.providerOrderId
        ? (await this.db.select().from(payments).where(eq(payments.providerOrderId, params.providerOrderId)).limit(1))[0]
        : undefined);

    if (!existing) return null;

    if (existing.status === "captured") return this.mapPayment(existing);

    const [updated] = await this.db
      .update(payments)
      .set({
        status: "captured",
        providerPaymentId: params.providerPaymentId,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, existing.id), ne(payments.status, "captured")))
      .returning();

    if (!updated) {
      const current = await this.getById(existing.id);
      return current;
    }

    await this.deps.audit.record({
      actorUserId: updated.userId,
      action: "PAYMENT_CAPTURED",
      entityType: "payment",
      entityId: updated.id,
      metadata: {
        type: updated.type,
        amountPaise: updated.amountPaise,
        providerPaymentId: params.providerPaymentId,
      },
    });

    await this.applyProductEffect(updated);
    return this.mapPayment(updated);
  }

  async markFailed(params: {
    providerOrderId?: string;
    providerPaymentId?: string;
    reason: string;
  }): Promise<PaymentRecord | null> {
    const match = params.providerPaymentId
      ? eq(payments.providerPaymentId, params.providerPaymentId)
      : params.providerOrderId
        ? eq(payments.providerOrderId, params.providerOrderId)
        : null;
    if (!match) return null;

    const [updated] = await this.db
      .update(payments)
      .set({
        status: sql`case when ${payments.status} in ('captured','refunded','partially_refunded') then ${payments.status} else 'failed' end`,
        updatedAt: new Date(),
      })
      .where(and(match, sql`${payments.status} not in ('captured','refunded','partially_refunded','failed')`))
      .returning();
    if (!updated) return null;

    const [payment] = await this.db.select().from(payments).where(eq(payments.id, updated.id)).limit(1);
    if (payment && payment.status === "failed") {
      if (payment.type === "GYM_MEMBERSHIP") {
        const membershipId = payment.metadata?.membershipId as string | undefined;
        if (membershipId) {
          await this.deps.memberships
            .markPaymentFailed(membershipId)
            .catch((error) => console.warn("[payments] membership fail update failed", error));
        }
      }
      await this.deps.notifications.notify({
        userId: payment.userId,
        type: "PAYMENT_FAILED",
        title: "Payment failed",
        body: `Your payment of ₹${(payment.amountPaise / 100).toFixed(2)} could not be completed.`,
        data: { paymentId: payment.id, reason: params.reason },
      });
      await this.deps.audit.record({
        actorUserId: payment.userId,
        action: "PAYMENT_FAILED",
        entityType: "payment",
        entityId: payment.id,
        metadata: { reason: params.reason, type: payment.type },
      });
    }
    return payment ? this.mapPayment(payment) : null;
  }

  /** Dispatches the business consequence of a captured payment, once. */
  private async applyProductEffect(payment: typeof payments.$inferSelect): Promise<void> {
    switch (payment.type) {
      case "GYM_MEMBERSHIP": {
        const membershipId = payment.metadata?.membershipId as string | undefined;
        if (!membershipId || !payment.providerPaymentId) return;
        await this.deps.memberships.markPaid({
          membershipId,
          paymentId: payment.id,
          providerPaymentId: payment.providerPaymentId,
        });
        await this.deps.route.createMembershipTransfer(payment.id);
        return;
      }
      case "GYM_LISTING": {
        const gymId = payment.metadata?.gymId as string | undefined;
        if (!gymId) return;
        const [gym] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId)).limit(1);
        if (!gym) return;
        if (["draft", "awaiting_listing_payment", "payment_failed"].includes(gym.status)) {
          await this.db
            .update(gymProfiles)
            .set({ status: "onboarding", listingFeePaymentId: payment.id, updatedAt: new Date() })
            .where(eq(gymProfiles.id, gym.id));
        }
        await this.deps.notifications.notify({
          userId: gym.ownerUserId,
          type: "PAYMENT_SUCCESSFUL",
          title: "Listing fee paid",
          body: `We received the listing fee for ${gym.name}. Continue onboarding to activate your listing.`,
          data: { gymId: gym.id, paymentId: payment.id },
        });
        await this.deps.audit.record({
          actorUserId: payment.userId,
          action: "GYM_LISTING_PAID",
          entityType: "gym_profile",
          entityId: gym.id,
          metadata: { paymentId: payment.id, amountPaise: payment.amountPaise },
        });
        return;
      }
      case "GYM_PLATFORM_SUBSCRIPTION": {
        // Monthly-order fallback for the gym platform plan (same effect as an
        // activated Razorpay subscription, but granted for 30 days).
        const gymId = payment.metadata?.gymId as string | undefined;
        if (!gymId) return;
        const [gym] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId)).limit(1);
        if (!gym) return;
        await this.activateMonthlySubscription({
          userId: gym.ownerUserId,
          gymId: gym.id,
          type: "GYM_PLATFORM_SUBSCRIPTION",
          paymentId: payment.id,
        });
        if (gym.status === "onboarding" && canTransitionGym("onboarding", "pending_verification")) {
          await this.db
            .update(gymProfiles)
            .set({ status: "pending_verification", subscriptionFailedAt: null, updatedAt: new Date() })
            .where(eq(gymProfiles.id, gym.id));
        }
        await this.deps.notifications.notify({
          userId: gym.ownerUserId,
          type: "SUBSCRIPTION_RENEWED",
          title: "FightFind platform plan active",
          body: `Your monthly FightFind plan for ${gym.name} is active.`,
          data: { gymId: gym.id, paymentId: payment.id },
        });
        await this.deps.audit.record({
          actorUserId: payment.userId,
          action: "GYM_SUBSCRIPTION_ACTIVE",
          entityType: "gym_profile",
          entityId: gym.id,
          metadata: { paymentId: payment.id, mode: "monthly_order" },
        });
        return;
      }
      case "FIGHTER_UPGRADE": {
        await this.activateMonthlySubscription({
          userId: payment.userId,
          gymId: null,
          type: "FIGHTER_UPGRADE",
          paymentId: payment.id,
        });
        await this.deps.notifications.notify({
          userId: payment.userId,
          type: "PREMIUM_RENEWED",
          title: "FightFind Pro active",
          body: "Your FightFind Pro is active. Advanced filters and unlimited requests are unlocked.",
          data: { paymentId: payment.id },
        });
        await this.deps.audit.record({
          actorUserId: payment.userId,
          action: "PREMIUM_PAYMENT_CAPTURED",
          entityType: "payment",
          entityId: payment.id,
          metadata: { amountPaise: payment.amountPaise, mode: "monthly_order" },
        });
        return;
      }
      default:
        return;
    }
  }

  /**
   * Grants a 30-day premium/platform window without Razorpay Subscriptions.
   * Extends the current period if one is already active, otherwise inserts a
   * new subscription row. Idempotent per captured payment (applyProductEffect
   * only runs on the capture transition).
   */
  private async activateMonthlySubscription(params: {
    userId: string;
    gymId: string | null;
    type: "FIGHTER_UPGRADE" | "GYM_PLATFORM_SUBSCRIPTION";
    paymentId: string;
  }): Promise<void> {
    const startedAt = new Date();
    const conditions = [
      eq(subscriptions.userId, params.userId),
      eq(subscriptions.type, params.type),
      eq(subscriptions.status, "active"),
    ];
    if (params.gymId) conditions.push(eq(subscriptions.gymId, params.gymId));
    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const base = existing.currentPeriodEnd && existing.currentPeriodEnd > startedAt ? existing.currentPeriodEnd : startedAt;
      await this.db
        .update(subscriptions)
        .set({ currentPeriodEnd: new Date(base.getTime() + 30 * 86_400_000), updatedAt: startedAt })
        .where(eq(subscriptions.id, existing.id));
      return;
    }

    await this.db.insert(subscriptions).values({
      userId: params.userId,
      gymId: params.gymId,
      type: params.type,
      providerPlanId: "monthly_order",
      providerSubscriptionId: null,
      status: "active",
      rawProviderStatus: "active",
      currentPeriodStart: startedAt,
      currentPeriodEnd: new Date(startedAt.getTime() + 30 * 86_400_000),
    });
  }

  async markRefundProcessed(params: {
    providerRefundId: string;
    paymentId: string;
    amountPaise: number;
    status: string;
    reason?: string;
  }): Promise<void> {
    await this.db
      .insert(refunds)
      .values({
        paymentId: params.paymentId,
        providerRefundId: params.providerRefundId,
        amountPaise: params.amountPaise,
        status: params.status,
        reason: params.reason ?? null,
      })
      .onConflictDoUpdate({
        target: refunds.providerRefundId,
        set: { status: params.status, updatedAt: new Date() },
      });

    const [payment] = await this.db.select().from(payments).where(eq(payments.id, params.paymentId)).limit(1);
    if (!payment) return;
    const status: PaymentStatus = params.amountPaise >= payment.amountPaise ? "refunded" : "partially_refunded";
    await this.db.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, payment.id));
    await this.deps.audit.record({
      actorUserId: null,
      action: "PAYMENT_REFUNDED",
      entityType: "payment",
      entityId: payment.id,
      metadata: { providerRefundId: params.providerRefundId, amountPaise: params.amountPaise },
    });
  }

  private async buildVerifyResponse(payment: {
    id: string;
    status: string;
    type: string;
    userId: string;
    gymId: string | null;
    metadata: Record<string, unknown>;
  }): Promise<VerifyPaymentResponse> {
    const businessState: VerifyPaymentResponse["businessState"] = {};
    if (payment.type === "GYM_MEMBERSHIP") {
      const membershipId = payment.metadata?.membershipId as string | undefined;
      if (membershipId) {
        const membership = await this.deps.memberships.getById(membershipId);
        if (membership) businessState.membershipStatus = membership.status;
      }
    }
    if (payment.type === "GYM_LISTING" && payment.gymId) {
      const [gym] = await this.db
        .select({ status: gymProfiles.status })
        .from(gymProfiles)
        .where(eq(gymProfiles.id, payment.gymId))
        .limit(1);
      if (gym) businessState.gymStatus = gym.status;
    }
    if (payment.type === "FIGHTER_UPGRADE") {
      const [active] = await this.db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, payment.userId),
            eq(subscriptions.type, "FIGHTER_UPGRADE"),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);
      businessState.premiumActive = Boolean(active);
    }
    return {
      paymentId: payment.id,
      status: payment.status as PaymentStatus,
      businessState,
    };
  }
}
