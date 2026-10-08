import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./payment.types.js";
import type {
  CreateLinkedAccountParams,
  CreateOrderParams,
  CreateSubscriptionParams,
  CreateTransferParams,
  ProviderLinkedAccount,
  ProviderOrder,
  ProviderPayment,
  ProviderRefund,
  ProviderSubscription,
  ProviderTransfer,
} from "./payment.types.js";

export interface MockProviderOptions {
  /** When true, payment signature verification always fails. */
  failVerification?: boolean;
  /** When true, webhook signature verification always fails. */
  failWebhookVerification?: boolean;
  /** Payment status returned by fetchPayment. Defaults to captured. */
  paymentStatus?: string;
  /** Override fetched amount (used to test amount-mismatch handling). */
  amountOverride?: number;
}

/**
 * In-memory payment provider used by automated tests and the explicit
 * development simulator. Never selected in production — the factory guards it.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly mode = "mock";
  readonly publicKeyId = "rzp_test_mock_key";

  private readonly orders = new Map<string, ProviderOrder>();
  private readonly payments = new Map<string, ProviderPayment>();
  private readonly subscriptions = new Map<string, ProviderSubscription>();
  private readonly transfers = new Map<string, ProviderTransfer>();
  private readonly linkedAccounts = new Map<string, ProviderLinkedAccount>();

  constructor(private readonly options: MockProviderOptions = {}) {}

  async createOrder(params: CreateOrderParams): Promise<ProviderOrder> {
    const id = `order_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const order: ProviderOrder = {
      id,
      amount: params.amountPaise,
      currency: params.currency,
      status: "created",
      receipt: params.receipt,
      raw: { id, amount: params.amountPaise, currency: params.currency, status: "created" },
    };
    this.orders.set(id, order);
    return order;
  }

  /** Registers a payment for an order as if Checkout had succeeded. */
  simulatePayment(orderId: string, amountPaise?: number): ProviderPayment {
    const order = this.orders.get(orderId);
    const id = `pay_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const payment: ProviderPayment = {
      id,
      orderId,
      amountPaise: amountPaise ?? order?.amount ?? 0,
      currency: "INR",
      status: this.options.paymentStatus ?? "captured",
      method: "upi",
      raw: { id, order_id: orderId, status: this.options.paymentStatus ?? "captured" },
    };
    this.payments.set(id, payment);
    return payment;
  }

  paymentSignature(orderId: string, paymentId: string): string {
    return `mock_signature|${orderId}|${paymentId}`;
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error(`Mock payment not found: ${paymentId}`);
    return { ...payment, amountPaise: this.options.amountOverride ?? payment.amountPaise };
  }

  verifyPaymentSignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
    if (this.options.failVerification) return false;
    return params.signature === this.paymentSignature(params.orderId, params.paymentId);
  }

  subscriptionSignature(paymentId: string, subscriptionId: string): string {
    return `mock_sub_signature|${paymentId}|${subscriptionId}`;
  }

  verifySubscriptionSignature(params: {
    paymentId: string;
    subscriptionId: string;
    signature: string;
  }): boolean {
    if (this.options.failVerification) return false;
    return params.signature === this.subscriptionSignature(params.paymentId, params.subscriptionId);
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): boolean {
    return !this.options.failWebhookVerification;
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const id = `sub_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const now = Math.floor(Date.now() / 1000);
    const subscription: ProviderSubscription = {
      id,
      planId: params.planId,
      status: "created",
      currentStart: null,
      currentEnd: now + 30 * 86_400,
      chargeAt: now,
      endedAt: null,
      raw: { id, plan_id: params.planId, status: "created" },
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  /** Test helper: move a subscription to an arbitrary provider state. */
  setSubscriptionStatus(subscriptionId: string, status: string, currentEnd?: number): ProviderSubscription {
    const existing = this.subscriptions.get(subscriptionId);
    const updated: ProviderSubscription = {
      ...(existing ?? {
        id: subscriptionId,
        planId: null,
        currentStart: null,
        currentEnd: null,
        chargeAt: null,
        endedAt: null,
        raw: {},
      }),
      status,
      currentStart: status === "active" ? Math.floor(Date.now() / 1000) : existing?.currentStart ?? null,
      currentEnd: currentEnd ?? existing?.currentEnd ?? null,
      raw: { ...(existing?.raw ?? {}), id: subscriptionId, status },
    };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }

  async fetchSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) throw new Error(`Mock subscription not found: ${subscriptionId}`);
    return subscription;
  }

  async cancelSubscription(subscriptionId: string): Promise<ProviderSubscription> {
    return this.setSubscriptionStatus(subscriptionId, "cancelled");
  }

  async createTransfer(params: CreateTransferParams): Promise<ProviderTransfer> {
    const transferRequest = params.transfers[0];
    if (!transferRequest) throw new Error("No transfer requested");
    const transfer: ProviderTransfer = {
      id: `trf_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      paymentId: params.paymentId,
      recipient: transferRequest.account,
      amountPaise: transferRequest.amountPaise,
      currency: "INR",
      status: "processed",
      raw: { id: `trf_mock`, status: "processed", recipient: transferRequest.account },
    };
    this.transfers.set(transfer.id, transfer);
    return transfer;
  }

  async createRefund(paymentId: string, amountPaise: number): Promise<ProviderRefund> {
    return {
      id: `rfnd_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      paymentId,
      amountPaise,
      status: "processed",
      raw: {},
    };
  }

  async createLinkedAccount(_params: CreateLinkedAccountParams): Promise<ProviderLinkedAccount> {
    const id = `acc_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const account: ProviderLinkedAccount = {
      id,
      status: "activated",
      onboardingUrl: `https://mock.razorpay.local/onboard/${id}`,
      raw: { id, status: "activated" },
    };
    this.linkedAccounts.set(id, account);
    return account;
  }

  async fetchLinkedAccount(accountId: string): Promise<ProviderLinkedAccount> {
    const account = this.linkedAccounts.get(accountId);
    if (!account) throw new Error(`Mock linked account not found: ${accountId}`);
    return account;
  }
}
