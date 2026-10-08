import type { Db } from "../../db/client.js";
import { gymProfiles, payments } from "../../db/schema.js";
import { AppError, notFound } from "../../lib/errors.js";
import { getPricing } from "../../config/pricing.js";
import type { CheckoutOrderResponse, PaymentProductType } from "@fightfind/types";
import type { PaymentProvider } from "./payment.types.js";
import type { MembershipService } from "../gyms/membership.service.js";
import { eq } from "drizzle-orm";

export class OrdersService {
  constructor(
    private readonly db: Db,
    private readonly provider: PaymentProvider,
    private readonly memberships: MembershipService,
  ) {}

  /**
   * Creates a Razorpay order. The server always resolves the payable amount
   * from configuration — client-supplied amounts are never trusted.
   */
  async createOrder(params: {
    userId: string;
    product: PaymentProductType;
    gymId?: string;
  }): Promise<CheckoutOrderResponse> {
    const pricing = getPricing();
    let amountPaise: number;
    let gymId: string | null = null;
    let membershipId: string | null = null;
    let metadata: Record<string, unknown> = {};

    switch (params.product) {
      case "GYM_MEMBERSHIP": {
        if (!params.gymId) throw new AppError("VALIDATION_ERROR", "gymId is required for gym memberships.", 400);
        const gym = await this.getGymOrThrow(params.gymId);
        if (gym.status !== "active") {
          throw new AppError("GYM_NOT_ACTIVE", "This gym is not accepting memberships right now.", 409);
        }
        if (!gym.monthlyFeePaise || gym.monthlyFeePaise <= 0) {
          throw new AppError("GYM_HAS_NO_FEE", "This gym has not published a monthly membership fee.", 409);
        }
        amountPaise = gym.monthlyFeePaise;
        gymId = gym.id;
        const membership = await this.memberships.createPending({
          gymId: gym.id,
          fighterUserId: params.userId,
          amountPaise,
        });
        membershipId = membership.id;
        metadata = { gymId: gym.id, membershipId: membership.id, gymName: gym.name };
        break;
      }
      case "GYM_LISTING": {
        if (!params.gymId) throw new AppError("VALIDATION_ERROR", "gymId is required for the listing fee.", 400);
        const gym = await this.getGymOrThrow(params.gymId);
        if (gym.ownerUserId !== params.userId) {
          throw new AppError("GYM_NOT_OWNER", "You do not manage this gym.", 403);
        }
        if (!["draft", "awaiting_listing_payment", "payment_failed"].includes(gym.status)) {
          throw new AppError("CONFLICT", "The listing fee for this gym has already been paid.", 409);
        }
        amountPaise = pricing.gymListingFeePaise;
        gymId = gym.id;
        metadata = { gymId: gym.id, gymName: gym.name };
        break;
      }
      case "FIGHTER_UPGRADE": {
        // Monthly FightFind Pro pass (used directly, or as a fallback when the
        // Razorpay account cannot create Subscriptions).
        amountPaise = pricing.fighterPremiumMonthlyPaise;
        metadata = { product: "FIGHTER_UPGRADE", months: 1 };
        break;
      }
      case "GYM_PLATFORM_SUBSCRIPTION": {
        if (!params.gymId) throw new AppError("VALIDATION_ERROR", "gymId is required for the gym platform plan.", 400);
        const gym = await this.getGymOrThrow(params.gymId);
        if (gym.ownerUserId !== params.userId) {
          throw new AppError("GYM_NOT_OWNER", "You do not manage this gym.", 403);
        }
        if (!gym.listingFeePaymentId) {
          throw new AppError(
            "LISTING_PAYMENT_REQUIRED",
            "Pay the one-time listing fee before starting the monthly plan.",
            409,
          );
        }
        amountPaise = pricing.gymPlatformMonthlyPaise;
        gymId = gym.id;
        metadata = { gymId: gym.id, gymName: gym.name, product: "GYM_PLATFORM_SUBSCRIPTION", months: 1 };
        break;
      }
      default:
        throw new AppError("PRODUCT_NOT_CONFIGURED", "Unknown product.", 400);
    }

    const [payment] = await this.db
      .insert(payments)
      .values({
        userId: params.userId,
        gymId,
        fighterUserId:
          params.product === "GYM_MEMBERSHIP" || params.product === "FIGHTER_UPGRADE" ? params.userId : null,
        type: params.product,
        amountPaise,
        currency: "INR",
        provider: this.provider.name,
        status: "created",
        metadata,
      })
      .returning();
    if (!payment) throw new Error("Failed to create payment record");

    const order = await this.provider.createOrder({
      amountPaise,
      currency: "INR",
      receipt: `ff_${payment.id}`,
      notes: { product: params.product, paymentId: payment.id },
    });

    await this.db
      .update(payments)
      .set({ providerOrderId: order.id, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    if (membershipId) {
      await this.memberships.attachOrder(membershipId, payment.id, order.id);
    }

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      razorpayKeyId: this.provider.publicKeyId ?? "",
      amountPaise,
      currency: "INR",
      product: params.product,
      testMode: this.provider.mode !== "live",
    };
  }

  private async getGymOrThrow(gymId: string) {
    const [gym] = await this.db.select().from(gymProfiles).where(eq(gymProfiles.id, gymId)).limit(1);
    if (!gym) throw notFound("GYM_NOT_FOUND", "Gym not found");
    return gym;
  }
}
