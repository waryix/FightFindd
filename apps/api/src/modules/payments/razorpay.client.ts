import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { loadEnv } from "../../env.js";
import { AppError } from "../../lib/errors.js";
import type {
  CreateLinkedAccountParams,
  CreateOrderParams,
  CreateSubscriptionParams,
  CreateTransferParams,
  PaymentProvider,
  ProviderLinkedAccount,
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
  ProviderSubscription,
  ProviderTransfer,
} from "./payment.types.js";

function safeCompare(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Thin, typed wrapper around the Razorpay SDK. All amount values are integer
 * paise. This is the only place in the codebase that talks to Razorpay.
 */
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";
  readonly mode: "test" | "live";
  readonly publicKeyId: string;
  private readonly client: Razorpay;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(config: { keyId: string; keySecret: string; webhookSecret: string; mode: "test" | "live" }) {
    this.publicKeyId = config.keyId;
    this.keySecret = config.keySecret;
    this.webhookSecret = config.webhookSecret;
    this.mode = config.mode;
    this.client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  }

  static fromEnv(): RazorpayPaymentProvider {
    const env = loadEnv();
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new AppError(
        "PAYMENT_PROVIDER_ERROR",
        "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        503,
      );
    }
    return new RazorpayPaymentProvider({
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
      mode: env.PAYMENT_MODE === "live" ? "live" : "test",
    });
  }

  async createOrder(params: CreateOrderParams): Promise<ProviderOrder> {
    const order = await this.client.orders.create({
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
      status: order.status,
      receipt: order.receipt ?? null,
      raw: order as unknown as Record<string, unknown>,
    };
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    const payment = await this.client.payments.fetch(paymentId);
    return {
      id: payment.id,
      orderId: (payment.order_id as string) ?? null,
      amountPaise: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      method: (payment.method as string) ?? null,
      errorCode: (payment.error_code as string) ?? null,
      errorDescription: (payment.error_description as string) ?? null,
      raw: payment as unknown as Record<string, unknown>,
    };
  }

  /** Checkout handler signature: HMAC_SHA256(key_secret, `${order_id}|${payment_id}`). */
  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = createHmac("sha256", this.keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest("hex");
    return safeCompare(expected, params.signature);
  }

  /** Subscription checkout signature: HMAC_SHA256(key_secret, `${payment_id}|${subscription_id}`). */
  verifySubscriptionSignature(params: {
    paymentId: string;
    subscriptionId: string;
    signature: string;
  }): boolean {
    const expected = createHmac("sha256", this.keySecret)
      .update(`${params.paymentId}|${params.subscriptionId}`)
      .digest("hex");
    return safeCompare(expected, params.signature);
  }

  /** Webhook signature: HMAC_SHA256(webhook_secret, raw_request_body). */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    return safeCompare(expected, signature);
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const subscription = await this.client.subscriptions.create({
      plan_id: params.planId,
      total_count: params.totalCount,
      quantity: params.quantity ?? 1,
      customer_notify: params.customerNotify ?? 1,
      notes: params.notes,
      start_at: params.startAt,
    });
    return this.mapSubscription(subscription as unknown as Record<string, unknown>);
  }

  async fetchSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    const subscription = await this.client.subscriptions.fetch(subscriptionId);
    return this.mapSubscription(subscription as unknown as Record<string, unknown>);
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<ProviderSubscription> {
    const subscription = await this.client.subscriptions.cancel(subscriptionId, cancelAtPeriodEnd);
    return this.mapSubscription(subscription as unknown as Record<string, unknown>);
  }

  private mapSubscription(subscription: Record<string, unknown>): ProviderSubscription {
    return {
      id: subscription.id as string,
      planId: (subscription.plan_id as string) ?? null,
      status: subscription.status as string,
      currentStart: (subscription.current_start as number) ?? null,
      currentEnd: (subscription.current_end as number) ?? null,
      chargeAt: (subscription.charge_at as number) ?? null,
      endedAt: (subscription.ended_at as number) ?? null,
      raw: subscription,
    };
  }

  async createTransfer(params: CreateTransferParams): Promise<ProviderTransfer> {
    const transferRequest = params.transfers[0];
    if (!transferRequest) throw new Error("No transfer requested");
    const result = (await this.client.payments.transfer(params.paymentId, {
      transfers: params.transfers.map((t) => ({
        account: t.account,
        amount: t.amountPaise,
        currency: t.currency,
        notes: t.notes,
        on_hold: t.onHold ? 1 : 0,
      })),
    })) as unknown as {
      items?: Record<string, unknown>[];
      id?: string;
      status?: string;
      recipient?: string;
      amount?: number;
    };
    const item = result.items?.[0];
    return {
      id: (item?.id as string) ?? result.id ?? "",
      paymentId: params.paymentId,
      recipient: (item?.recipient as string) ?? transferRequest.account,
      amountPaise: Number(item?.amount ?? transferRequest.amountPaise),
      currency: "INR",
      status: (item?.status as string) ?? "created",
      raw: (item ?? result) as Record<string, unknown>,
    };
  }

  async createRefund(paymentId: string, amountPaise: number, notes?: Record<string, string>): Promise<ProviderRefund> {
    const refund = await this.client.payments.refund(paymentId, { amount: amountPaise, notes });
    return {
      id: refund.id,
      paymentId,
      amountPaise: Number(refund.amount),
      status: refund.status,
      raw: refund as unknown as Record<string, unknown>,
    };
  }

  /**
   * Razorpay Route linked account. The gym's settlement bank account is
   * configured inside Razorpay's onboarding flow — FightFind only stores the
   * account id and onboarding status, never bank credentials.
   */
  async createLinkedAccount(params: CreateLinkedAccountParams): Promise<ProviderLinkedAccount> {
    const response = await this.rawRequest("POST", "/v2/accounts", {
      email: params.email,
      phone: params.phone,
      legal_business_name: params.legalBusinessName,
      business_type: "individual",
      contact_name: params.contactName,
      profile: {
        category: "healthcare",
        subcategory: "gym",
        addresses: {
          registered: {
            street1: "FightFind",
            city: "Bengaluru",
            state: "Karnataka",
            postal_code: "560001",
            country: "IN",
          },
        },
      },
      legal_info: {},
    });
    return this.mapLinkedAccount(response);
  }

  async fetchLinkedAccount(accountId: string): Promise<ProviderLinkedAccount> {
    const response = await this.rawRequest("GET", `/v2/accounts/${accountId}`);
    return this.mapLinkedAccount(response);
  }

  private mapLinkedAccount(raw: Record<string, unknown>): ProviderLinkedAccount {
    return {
      id: raw.id as string,
      status: (raw.status as string) ?? "created",
      onboardingUrl: (raw.activation_url as string) ?? null,
      raw,
    };
  }

  private async rawRequest(
    method: "POST" | "GET",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`https://api.razorpay.com${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.publicKeyId}:${this.keySecret}`).toString("base64")}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    if (!response.ok) {
      throw new Error(
        `Razorpay ${path} failed (${response.status}): ${(parsed.error as { description?: string } | undefined)?.description ?? text}`,
      );
    }
    return parsed;
  }
}
