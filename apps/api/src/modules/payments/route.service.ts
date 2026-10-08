import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { gymOwners, gymProfiles, paymentTransfers, payments } from "../../db/schema.js";
import { getPricing } from "../../config/pricing.js";
import { loadEnv } from "../../env.js";
import { splitPayment } from "@fightfind/utils";
import type { PaymentProvider } from "./payment.types.js";
import type { NotificationService } from "../notifications/notifications.service.js";
import type { AuditService } from "../audit/audit.service.js";

const PROVIDER_STATUS_TO_TRANSFER: Record<string, string> = {
  created: "created",
  pending: "processing",
  queued: "processing",
  processing: "processing",
  processed: "processed",
  failed: "failed",
  reversed: "reversed",
};

/**
 * Marketplace money movement. Gym membership payments are routed to the gym's
 * Razorpay linked account — FightFind never acts as a manual bank-transfer
 * beneficiary. The platform commission is configuration, not hardcoded.
 */
export class RouteService {
  constructor(
    private readonly db: Db,
    private readonly provider: PaymentProvider,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async createMembershipTransfer(paymentId: string): Promise<void> {
    const [payment] = await this.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
    if (!payment || payment.type !== "GYM_MEMBERSHIP" || !payment.gymId || !payment.providerPaymentId) return;

    const [existing] = await this.db
      .select({ id: paymentTransfers.id })
      .from(paymentTransfers)
      .where(eq(paymentTransfers.paymentId, payment.id))
      .limit(1);
    if (existing) return; // idempotent

    const [gym] = await this.db
      .select({
        id: gymProfiles.id,
        name: gymProfiles.name,
        ownerUserId: gymProfiles.ownerUserId,
      })
      .from(gymProfiles)
      .where(eq(gymProfiles.id, payment.gymId))
      .limit(1);
    if (!gym) return;

    const [owner] = await this.db
      .select({
        linkedAccountId: gymOwners.razorpayLinkedAccountId,
        onboardingStatus: gymOwners.razorpayOnboardingStatus,
      })
      .from(gymOwners)
      .where(eq(gymOwners.userId, gym.ownerUserId))
      .limit(1);

    const pricing = getPricing();
    const { merchantPaise } = splitPayment(payment.amountPaise, pricing.platformCommissionPercent);

    // Development: Route transfers are skipped and recorded as processing, since
    // seeded linked accounts are not real Razorpay accounts.
    if (loadEnv().SKIP_ROUTE_TRANSFERS) {
      await this.db.insert(paymentTransfers).values({
        paymentId: payment.id,
        linkedAccountId: owner?.linkedAccountId ?? "",
        amountPaise: merchantPaise,
        status: "processing",
        failureReason: "DEV_SKIPPED",
      });
      await this.audit.record({
        actorUserId: null,
        action: "GYM_TRANSFER_SKIPPED",
        entityType: "payment",
        entityId: payment.id,
        metadata: { gymId: gym.id, amountPaise: merchantPaise, reason: "DEV_MODE" },
      });
      return;
    }

    if (!owner?.linkedAccountId) {
      // Money is safely captured by the platform; routing waits for the gym's
      // linked account to be activated. Ops is alerted via the transfer record.
      await this.db.insert(paymentTransfers).values({
        paymentId: payment.id,
        linkedAccountId: "",
        amountPaise: merchantPaise,
        status: "failed",
        failureReason: "NO_LINKED_ACCOUNT",
      });
      await this.audit.record({
        actorUserId: null,
        action: "GYM_TRANSFER_BLOCKED",
        entityType: "payment",
        entityId: payment.id,
        metadata: { gymId: gym.id, reason: "NO_LINKED_ACCOUNT" },
      });
      return;
    }

    try {
      const transfer = await this.provider.createTransfer({
        paymentId: payment.providerPaymentId,
        transfers: [
          {
            account: owner.linkedAccountId,
            amountPaise: merchantPaise,
            currency: "INR",
            notes: { paymentId: payment.id, gymId: gym.id },
          },
        ],
      });
      await this.db.insert(paymentTransfers).values({
        paymentId: payment.id,
        providerTransferId: transfer.id,
        linkedAccountId: owner.linkedAccountId,
        amountPaise: merchantPaise,
        status: PROVIDER_STATUS_TO_TRANSFER[transfer.status] ?? "created",
      });
      await this.audit.record({
        actorUserId: null,
        action: "GYM_TRANSFER_CREATED",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          transferId: transfer.id,
          gymId: gym.id,
          amountPaise: merchantPaise,
          commissionPercent: pricing.platformCommissionPercent,
        },
      });
    } catch (error) {
      await this.db.insert(paymentTransfers).values({
        paymentId: payment.id,
        linkedAccountId: owner.linkedAccountId,
        amountPaise: merchantPaise,
        status: "failed",
        failureReason: error instanceof Error ? error.message.slice(0, 500) : "TRANSFER_ERROR",
      });
      await this.notifications.notify({
        userId: gym.ownerUserId,
        type: "PAYMENT_FAILED",
        title: "Membership transfer delayed",
        body: `We could not transfer a membership payment to ${gym.name} automatically. Our team is on it.`,
        data: { paymentId: payment.id, gymId: gym.id },
      });
      await this.audit.record({
        actorUserId: null,
        action: "GYM_TRANSFER_FAILED",
        entityType: "payment",
        entityId: payment.id,
        metadata: { gymId: gym.id, error: error instanceof Error ? error.message : "unknown" },
      });
    }
  }

  async handleTransferEvent(transferEntity: Record<string, unknown>): Promise<void> {
    const providerTransferId = transferEntity.id as string | undefined;
    if (!providerTransferId) return;
    const rawStatus = (transferEntity.status as string) ?? "processed";
    const status = PROVIDER_STATUS_TO_TRANSFER[rawStatus] ?? "processing";
    const failureReason =
      (transferEntity.error_description as string) ?? (transferEntity.failure_reason as string) ?? null;

    const [transfer] = await this.db
      .select()
      .from(paymentTransfers)
      .where(eq(paymentTransfers.providerTransferId, providerTransferId))
      .limit(1);
    if (!transfer) return;

    await this.db
      .update(paymentTransfers)
      .set({ status, failureReason, updatedAt: new Date() })
      .where(eq(paymentTransfers.id, transfer.id));

    if (status === "failed" || status === "reversed") {
      const [payment] = await this.db
        .select()
        .from(payments)
        .where(eq(payments.id, transfer.paymentId))
        .limit(1);
      const [gym] = payment?.gymId
        ? await this.db
            .select({ name: gymProfiles.name, ownerUserId: gymProfiles.ownerUserId })
            .from(gymProfiles)
            .where(eq(gymProfiles.id, payment.gymId))
            .limit(1)
        : [];
      if (gym) {
        await this.notifications.notify({
          userId: gym.ownerUserId,
          type: "PAYMENT_FAILED",
          title: "Transfer issue",
          body: `A membership transfer to ${gym.name} was marked ${status}. FightFind support will reconcile it.`,
          data: { paymentId: transfer.paymentId },
        });
      }
      await this.audit.record({
        actorUserId: null,
        action: status === "reversed" ? "GYM_TRANSFER_REVERSED" : "GYM_TRANSFER_FAILED",
        entityType: "payment_transfer",
        entityId: transfer.id,
        metadata: { providerTransferId, failureReason },
      });
    }
  }
}
