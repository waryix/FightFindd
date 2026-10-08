import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { gymOwners, paymentEvents, payments } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import type { PaymentProvider, ProviderSubscription } from "./payment.types.js";
import type { PaymentService } from "./payment.service.js";
import type { RouteService } from "./route.service.js";
import type { SubscriptionsService } from "./subscriptions.service.js";
import type { AuditService } from "../audit/audit.service.js";

export type WebhookOutcome = "processed" | "duplicate" | "ignored" | "error";

export interface WebhookResult {
  status: WebhookOutcome;
  event?: string;
}

interface RazorpayWebhookBody {
  entity?: string;
  event?: string;
  contains?: string[];
  payload?: Record<string, { entity?: Record<string, unknown> }>;
  created_at?: number;
  account_id?: string;
}

/**
 * Razorpay webhook processing. Signature is verified against the raw body,
 * events are deduplicated by event id, and every handler is idempotent.
 */
export class WebhooksService {
  constructor(
    private readonly deps: {
      db: Db;
      provider: PaymentProvider;
      payments: PaymentService;
      subscriptions: SubscriptionsService;
      route: RouteService;
      audit: AuditService;
    },
  ) {}

  async processRazorpayWebhook(params: {
    rawBody: string;
    signature: string | undefined;
    eventId: string | undefined;
  }): Promise<WebhookResult> {
    if (!params.signature || !this.deps.provider.verifyWebhookSignature(params.rawBody, params.signature)) {
      throw new AppError("WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature.", 400);
    }

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(params.rawBody) as RazorpayWebhookBody;
    } catch {
      throw new AppError("VALIDATION_ERROR", "Webhook body is not valid JSON.", 400);
    }

    const eventName = body.event ?? "unknown";
    const eventId =
      params.eventId ??
      createHash("sha256").update(`${eventName}:${params.rawBody}`).digest("hex");

    const inserted = await this.deps.db
      .insert(paymentEvents)
      .values({
        providerEventId: eventId,
        eventType: eventName,
        payload: body as unknown as Record<string, unknown>,
        signatureVerified: true,
      })
      .onConflictDoNothing()
      .returning({ id: paymentEvents.id });

    if (inserted.length === 0) {
      return { status: "duplicate", event: eventName };
    }
    const eventRowId = inserted[0]!.id;

    try {
      await this.dispatch(eventName, body);
      await this.deps.db
        .update(paymentEvents)
        .set({ processedAt: new Date() })
        .where(eq(paymentEvents.id, eventRowId));
      return { status: "processed", event: eventName };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown webhook processing error";
      console.error(`[webhooks] ${eventName} processing failed:`, message);
      await this.deps.db
        .update(paymentEvents)
        .set({ processingError: message.slice(0, 1000) })
        .where(eq(paymentEvents.id, eventRowId));
      await this.deps.audit.record({
        actorUserId: null,
        action: "WEBHOOK_PROCESSING_FAILED",
        entityType: "payment_event",
        entityId: eventRowId,
        metadata: { event: eventName, error: message },
      });
      // Acknowledge: Razorpay retries aggressively; we persist the failure for ops.
      return { status: "error", event: eventName };
    }
  }

  private async dispatch(eventName: string, body: RazorpayWebhookBody): Promise<void> {
    const paymentEntity = body.payload?.payment?.entity as Record<string, unknown> | undefined;
    const orderEntity = body.payload?.order?.entity as Record<string, unknown> | undefined;
    const refundEntity = body.payload?.refund?.entity as Record<string, unknown> | undefined;
    const subscriptionEntity = body.payload?.subscription?.entity as Record<string, unknown> | undefined;
    const transferEntity = body.payload?.transfer?.entity as Record<string, unknown> | undefined;
    const invoiceEntity = body.payload?.invoice?.entity as Record<string, unknown> | undefined;

    switch (eventName) {
      case "payment.captured":
      case "order.paid": {
        const providerPaymentId = (paymentEntity?.id as string) ?? (orderEntity?.id as string);
        const providerOrderId = (paymentEntity?.order_id as string) ?? (orderEntity?.id as string);
        if (!providerPaymentId) return;
        await this.deps.payments.markCaptured({ providerOrderId, providerPaymentId });
        return;
      }
      case "payment.failed": {
        await this.deps.payments.markFailed({
          providerOrderId: (paymentEntity?.order_id as string) ?? undefined,
          providerPaymentId: (paymentEntity?.id as string) ?? undefined,
          reason:
            (paymentEntity?.error_description as string) ??
            (paymentEntity?.error_reason as string) ??
            "Payment failed",
        });
        return;
      }
      case "payment.authorized": {
        // Wait for capture; nothing to activate yet.
        return;
      }
      case "refund.created":
      case "refund.processed":
      case "refund.failed": {
        if (!refundEntity?.id) return;
        const providerPaymentId = refundEntity.payment_id as string | undefined;
        if (!providerPaymentId) return;
        const [payment] = await this.deps.db
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.providerPaymentId, providerPaymentId))
          .limit(1);
        if (!payment) return;
        const status =
          eventName === "refund.processed" ? "processed" : eventName === "refund.failed" ? "failed" : "created";
        await this.deps.payments.markRefundProcessed({
          providerRefundId: refundEntity.id as string,
          paymentId: payment.id,
          amountPaise: Number(refundEntity.amount ?? 0),
          status,
          reason: (refundEntity.notes as Record<string, string> | undefined)?.reason,
        });
        return;
      }
      case "subscription.authenticated":
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.pending":
      case "subscription.halted":
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.updated": {
        if (!subscriptionEntity) return;
        await this.deps.subscriptions.syncFromProvider(this.mapSubscriptionEntity(subscriptionEntity));
        return;
      }
      case "invoice.paid": {
        const subscriptionId =
          (invoiceEntity?.subscription_id as string) ??
          (subscriptionEntity?.id as string);
        if (!subscriptionId) return;
        // Fetch the authoritative subscription state and sync it.
        const providerSubscription = await this.deps.provider.fetchSubscription(subscriptionId);
        await this.deps.subscriptions.syncFromProvider(providerSubscription);
        return;
      }
      case "transfer.processed":
      case "transfer.failed":
      case "transfer.reversed": {
        if (!transferEntity) return;
        await this.deps.route.handleTransferEvent(transferEntity);
        return;
      }
      case "product.route.under_review":
      case "product.route.needs_clarification": {
        const linkedAccountId =
          (body.payload?.account?.entity?.id as string) ?? (body.account_id as string) ?? undefined;
        if (!linkedAccountId) return;
        const status = eventName === "product.route.under_review" ? "under_review" : "needs_clarification";
        await this.deps.db
          .update(gymOwners)
          .set({ razorpayOnboardingStatus: status, updatedAt: new Date() })
          .where(eq(gymOwners.razorpayLinkedAccountId, linkedAccountId));
        return;
      }
      default:
        return;
    }
  }

  private mapSubscriptionEntity(entity: Record<string, unknown>): ProviderSubscription {
    return {
      id: entity.id as string,
      planId: (entity.plan_id as string) ?? null,
      status: (entity.status as string) ?? "created",
      currentStart: (entity.current_start as number) ?? null,
      currentEnd: (entity.current_end as number) ?? null,
      chargeAt: (entity.charge_at as number) ?? null,
      endedAt: (entity.ended_at as number) ?? null,
      raw: entity,
    };
  }
}
