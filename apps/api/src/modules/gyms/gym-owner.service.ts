import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  gymMemberships,
  gymOwners,
  gymProfiles,
  paymentTransfers,
  payments,
  subscriptions,
} from "../../db/schema.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { getPricing } from "../../config/pricing.js";
import type {
  CreateGymInput,
  GymDashboard,
  GymDetail,
  GymOwnerOnboardingState,
  UpdateGymInput,
} from "@fightfind/types";
import type { GymService } from "../gyms/gyms.service.js";
import type { MembershipService } from "../gyms/membership.service.js";
import type { OrdersService } from "../payments/orders.service.js";
import type { SubscriptionsService } from "../payments/subscriptions.service.js";
import type { PaymentProvider } from "../payments/payment.types.js";
import type { AuditService } from "../audit/audit.service.js";
import type { NotificationService } from "../notifications/notifications.service.js";

export class GymOwnerService {
  constructor(
    private readonly db: Db,
    private readonly gyms: GymService,
    private readonly memberships: MembershipService,
    private readonly orders: OrdersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly provider: PaymentProvider,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  async onboardingState(userId: string): Promise<GymOwnerOnboardingState> {
    const [owner] = await this.db.select().from(gymOwners).where(eq(gymOwners.userId, userId)).limit(1);
    const [gym] = await this.db
      .select()
      .from(gymProfiles)
      .where(eq(gymProfiles.ownerUserId, userId))
      .orderBy(desc(gymProfiles.createdAt))
      .limit(1);

    let subscriptionStatus: GymOwnerOnboardingState["subscriptionStatus"] = "none";
    let listingPaymentStatus: GymOwnerOnboardingState["listingPaymentStatus"] = "unpaid";

    if (gym) {
      const [subscription] = await this.db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(and(eq(subscriptions.gymId, gym.id), eq(subscriptions.type, "GYM_PLATFORM_SUBSCRIPTION")))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);
      subscriptionStatus = (subscription?.status as GymOwnerOnboardingState["subscriptionStatus"]) ?? "none";

      if (gym.listingFeePaymentId) {
        const [payment] = await this.db
          .select({ status: payments.status })
          .from(payments)
          .where(eq(payments.id, gym.listingFeePaymentId))
          .limit(1);
        listingPaymentStatus =
          payment?.status === "captured" ? "paid" : payment?.status === "failed" ? "failed" : "unpaid";
      }
    }

    const step: GymOwnerOnboardingState["step"] = !gym
      ? "gym_details"
      : gym.status === "draft"
        ? "business_details"
        : !owner?.razorpayLinkedAccountId
          ? "razorpay_linked_account"
          : listingPaymentStatus !== "paid"
            ? "listing_payment"
            : subscriptionStatus !== "active"
              ? "platform_subscription"
              : gym.verificationStatus !== "verified"
                ? "verification"
                : "active";

    return {
      step,
      gymId: gym?.id ?? null,
      gymStatus: (gym?.status as GymOwnerOnboardingState["gymStatus"]) ?? null,
      razorpayLinkedAccountId: owner?.razorpayLinkedAccountId ?? null,
      razorpayOnboardingStatus: (owner?.razorpayOnboardingStatus as GymOwnerOnboardingState["razorpayOnboardingStatus"]) ?? "not_started",
      listingPaymentStatus,
      subscriptionStatus,
      verificationStatus: (gym?.verificationStatus as GymOwnerOnboardingState["verificationStatus"]) ?? "pending",
    };
  }

  async createGym(userId: string, input: CreateGymInput): Promise<GymDetail> {
    const [created] = await this.db
      .insert(gymProfiles)
      .values({
        ownerUserId: userId,
        name: input.name,
        ownerName: input.ownerName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        description: input.description ?? null,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        timings: input.timings ?? null,
        monthlyFeePaise: input.monthlyFeePaise ?? null,
        hasTrialClass: input.hasTrialClass ?? false,
        photoUrls: input.photoUrls ?? [],
        coverPhotoUrl: input.photoUrls?.[0] ?? null,
        status: "awaiting_listing_payment",
        verificationStatus: "pending",
      })
      .returning();
    if (!created) throw new Error("Failed to create gym");
    await this.gyms.replaceDisciplines(created.id, input.disciplines);
    await this.audit.record({
      actorUserId: userId,
      action: "GYM_CREATED",
      entityType: "gym_profile",
      entityId: created.id,
      metadata: { name: created.name, city: created.city },
    });
    return this.gyms.mapGym(created, input.disciplines, null) as GymDetail;
  }

  async listGyms(userId: string): Promise<GymDetail[]> {
    const rows = await this.db
      .select()
      .from(gymProfiles)
      .where(eq(gymProfiles.ownerUserId, userId))
      .orderBy(desc(gymProfiles.createdAt));
    return Promise.all(
      rows.map(async (row) => this.gyms.mapGym(row, await this.gyms.getDisciplinesFor(row.id), null) as GymDetail),
    );
  }

  async getOwnedGym(userId: string, gymId: string) {
    const gym = await this.gyms.getById(gymId);
    if (!gym) throw notFound("GYM_NOT_FOUND", "Gym not found");
    if (gym.ownerUserId !== userId) throw notFound("GYM_NOT_OWNER", "You do not manage this gym.");
    return gym;
  }

  async getGymDetail(userId: string, gymId: string): Promise<GymDetail> {
    const gym = await this.getOwnedGym(userId, gymId);
    return this.gyms.mapGym(gym, await this.gyms.getDisciplinesFor(gym.id), null) as GymDetail;
  }

  async updateGym(userId: string, gymId: string, input: UpdateGymInput): Promise<GymDetail> {
    const gym = await this.getOwnedGym(userId, gymId);
    const { disciplines, photoUrls, ...fields } = input;
    await this.db
      .update(gymProfiles)
      .set({
        ...fields,
        ...(photoUrls
          ? { photoUrls, coverPhotoUrl: photoUrls[0] ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(gymProfiles.id, gym.id));
    if (disciplines) await this.gyms.replaceDisciplines(gym.id, disciplines);
    await this.audit.record({
      actorUserId: userId,
      action: "GYM_UPDATED",
      entityType: "gym_profile",
      entityId: gym.id,
      metadata: { fields: Object.keys(input) },
    });
    return this.getGymDetail(userId, gymId);
  }

  async addPhoto(userId: string, gymId: string, photoUrl: string): Promise<string[]> {
    const gym = await this.getOwnedGym(userId, gymId);
    if (gym.photoUrls.length >= 12) {
      throw badRequest("VALIDATION_ERROR", "Photo limit reached (12). Remove a photo before adding another.");
    }
    const photoUrls = [...gym.photoUrls, photoUrl];
    await this.db
      .update(gymProfiles)
      .set({ photoUrls, coverPhotoUrl: photoUrls[0] ?? null, updatedAt: new Date() })
      .where(eq(gymProfiles.id, gym.id));
    return photoUrls;
  }

  async startRazorpayOnboarding(userId: string, gymId: string) {
    const gym = await this.getOwnedGym(userId, gymId);
    const [owner] = await this.db.select().from(gymOwners).where(eq(gymOwners.userId, userId)).limit(1);
    if (owner?.razorpayLinkedAccountId) {
      const account = await this.provider
        .fetchLinkedAccount(owner.razorpayLinkedAccountId)
        .catch(() => null);
      if (account) {
        await this.db
          .update(gymOwners)
          .set({ razorpayOnboardingStatus: account.status, updatedAt: new Date() })
          .where(eq(gymOwners.userId, userId));
        return { linkedAccountId: account.id, onboardingStatus: account.status, onboardingUrl: account.onboardingUrl ?? undefined };
      }
      return { linkedAccountId: owner.razorpayLinkedAccountId, onboardingStatus: owner.razorpayOnboardingStatus };
    }

    const account = await this.provider.createLinkedAccount({
      legalBusinessName: gym.name,
      contactName: gym.ownerName ?? gym.name,
      email: gym.email ?? `gym-${gym.id.slice(0, 8)}@fightfind.in`,
      phone: gym.phone ?? "+910000000000",
    });

    await this.db
      .update(gymOwners)
      .set({
        razorpayLinkedAccountId: account.id,
        razorpayOnboardingStatus: account.status,
        businessName: gym.name,
        businessEmail: gym.email,
        businessPhone: gym.phone,
        updatedAt: new Date(),
      })
      .where(eq(gymOwners.userId, userId));

    await this.audit.record({
      actorUserId: userId,
      action: "GYM_RAZORPAY_ACCOUNT_CREATED",
      entityType: "gym_profile",
      entityId: gym.id,
      metadata: { linkedAccountId: account.id, status: account.status },
    });

    return { linkedAccountId: account.id, onboardingStatus: account.status, onboardingUrl: account.onboardingUrl ?? undefined };
  }

  async refreshRazorpayStatus(userId: string, gymId: string) {
    await this.getOwnedGym(userId, gymId);
    const [owner] = await this.db.select().from(gymOwners).where(eq(gymOwners.userId, userId)).limit(1);
    if (!owner?.razorpayLinkedAccountId) {
      return { linkedAccountId: null, onboardingStatus: "not_started" };
    }
    const account = await this.provider.fetchLinkedAccount(owner.razorpayLinkedAccountId).catch(() => null);
    if (account) {
      await this.db
        .update(gymOwners)
        .set({ razorpayOnboardingStatus: account.status, updatedAt: new Date() })
        .where(eq(gymOwners.userId, userId));
    }
    return {
      linkedAccountId: owner.razorpayLinkedAccountId,
      onboardingStatus: account?.status ?? owner.razorpayOnboardingStatus,
    };
  }

  async createListingFeeOrder(userId: string, gymId: string) {
    const gym = await this.getOwnedGym(userId, gymId);
    const [owner] = await this.db.select().from(gymOwners).where(eq(gymOwners.userId, userId)).limit(1);
    if (!owner?.razorpayLinkedAccountId) {
      throw badRequest(
        "LISTING_PAYMENT_REQUIRED",
        "Complete Razorpay account onboarding before paying the listing fee.",
      );
    }
    if (gym.listingFeePaymentId) {
      const [payment] = await this.db
        .select({ status: payments.status })
        .from(payments)
        .where(eq(payments.id, gym.listingFeePaymentId))
        .limit(1);
      if (payment?.status === "captured") {
        throw badRequest("CONFLICT", "The listing fee has already been paid.");
      }
    } else {
      // Move to awaiting_listing_payment so the order endpoint accepts it.
      if (gym.status === "draft") {
        await this.db
          .update(gymProfiles)
          .set({ status: "awaiting_listing_payment", updatedAt: new Date() })
          .where(eq(gymProfiles.id, gym.id));
      }
    }
    return this.orders.createOrder({ userId, product: "GYM_LISTING", gymId: gym.id });
  }

  async createPlatformSubscription(userId: string, gymId: string) {
    await this.getOwnedGym(userId, gymId);
    return this.subscriptions.createGymPlatform(userId, gymId);
  }

  async dashboard(userId: string, gymId: string): Promise<GymDashboard> {
    const gym = await this.getOwnedGym(userId, gymId);
    const pricing = getPricing();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

    const [members] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMemberships)
      .where(and(eq(gymMemberships.gymId, gym.id), eq(gymMemberships.status, "active")));

    const [pending] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMemberships)
      .where(and(eq(gymMemberships.gymId, gym.id), eq(gymMemberships.status, "paid_pending_approval")));

    const [revenue] = await this.db
      .select({ total: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int` })
      .from(payments)
      .where(
        and(
          eq(payments.gymId, gym.id),
          eq(payments.type, "GYM_MEMBERSHIP"),
          eq(payments.status, "captured"),
          gte(payments.createdAt, monthStart),
        ),
      );

    const [renewals] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMemberships)
      .where(
        and(
          eq(gymMemberships.gymId, gym.id),
          eq(gymMemberships.status, "active"),
          gte(gymMemberships.expiresAt, now),
          sql`${gymMemberships.expiresAt} <= ${weekAhead}`,
        ),
      );

    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.gymId, gym.id), eq(subscriptions.type, "GYM_PLATFORM_SUBSCRIPTION")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return {
      gym: {
        id: gym.id,
        name: gym.name,
        status: gym.status as GymDashboard["gym"] extends null ? never : NonNullable<GymDashboard["gym"]>["status"],
        verificationStatus: gym.verificationStatus as NonNullable<GymDashboard["gym"]>["verificationStatus"],
      },
      currentMembers: members?.count ?? 0,
      pendingRequests: pending?.count ?? 0,
      monthlyRevenuePaise: revenue?.total ?? 0,
      upcomingRenewals: renewals?.count ?? 0,
      subscription: {
        status: subscription?.status ?? "none",
        pricePaise: pricing.gymPlatformMonthlyPaise,
        nextBillingAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
      },
      listingFeePaid: Boolean(gym.listingFeePaymentId),
    };
  }

  async listRequests(
    userId: string,
    gymId: string,
    params: { status?: string; cursor?: string; limit: number },
  ) {
    await this.getOwnedGym(userId, gymId);
    return this.memberships.listForGym(gymId, { ...params, pendingOnly: !params.status });
  }

  async listMembers(
    userId: string,
    gymId: string,
    params: { status?: string; cursor?: string; limit: number },
  ) {
    await this.getOwnedGym(userId, gymId);
    return this.memberships.listForGym(gymId, { ...params, status: params.status ?? "active" });
  }

  async listPayments(
    userId: string,
    gymId: string,
    params: { cursor?: string; limit: number },
  ) {
    await this.getOwnedGym(userId, gymId);
    const rows = await this.db
      .select({
        payment: payments,
        transferStatus: paymentTransfers.status,
        transferId: paymentTransfers.providerTransferId,
        transferAmountPaise: paymentTransfers.amountPaise,
      })
      .from(payments)
      .leftJoin(paymentTransfers, eq(paymentTransfers.paymentId, payments.id))
      .where(eq(payments.gymId, gymId))
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(params.limit + 1);

    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit).map((row) => ({
      id: row.payment.id,
      userId: row.payment.userId,
      gymId: row.payment.gymId,
      fighterId: row.payment.fighterUserId,
      type: row.payment.type as never,
      amountPaise: row.payment.amountPaise,
      currency: row.payment.currency,
      provider: row.payment.provider,
      providerOrderId: row.payment.providerOrderId,
      providerPaymentId: row.payment.providerPaymentId,
      providerSubscriptionId: row.payment.providerSubscriptionId,
      status: row.payment.status as never,
      metadata: row.payment.metadata,
      createdAt: row.payment.createdAt.toISOString(),
      updatedAt: row.payment.updatedAt.toISOString(),
      transfer:
        row.transferStatus || row.transferId
          ? {
              status: row.transferStatus ?? "created",
              transferId: row.transferId,
              amountPaise: row.transferAmountPaise ?? 0,
            }
          : null,
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ t: last.createdAt, i: last.id })).toString("base64url") : null,
    };
  }

  async notificationList(userId: string, params: { cursor?: string; limit: number }) {
    const { notifications } = await import("../../db/schema.js");
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(params.limit + 1);
    const hasMore = rows.length > params.limit;
    const items = rows.slice(0, params.limit).map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type as never,
      title: row.title,
      body: row.body,
      data: row.data,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ t: last.createdAt, i: last.id })).toString("base64url") : null,
    };
  }

  async listGymIdsForOwner(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: gymProfiles.id })
      .from(gymProfiles)
      .where(eq(gymProfiles.ownerUserId, userId));
    return rows.map((r) => r.id);
  }

  async countPendingForOwner(userId: string): Promise<number> {
    const gymIds = await this.listGymIdsForOwner(userId);
    if (gymIds.length === 0) return 0;
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymMemberships)
      .where(and(inArray(gymMemberships.gymId, gymIds), eq(gymMemberships.status, "paid_pending_approval")));
    return row?.count ?? 0;
  }
}
