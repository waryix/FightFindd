import type { PaymentProductType } from "@fightfind/types";

export interface CreateOrderParams {
  amountPaise: number;
  currency: "INR";
  receipt: string;
  notes?: Record<string, string>;
}

export interface ProviderOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string | null;
  raw: Record<string, unknown>;
}

export interface ProviderPayment {
  id: string;
  orderId: string | null;
  amountPaise: number;
  currency: string;
  status: string; // created | authorized | captured | failed | refunded
  method: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  raw: Record<string, unknown>;
}

export interface CreateSubscriptionParams {
  planId: string;
  totalCount: number;
  quantity?: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
  startAt?: number;
}

export interface ProviderSubscription {
  id: string;
  planId: string | null;
  status: string;
  currentStart: number | null;
  currentEnd: number | null;
  chargeAt: number | null;
  endedAt: number | null;
  raw: Record<string, unknown>;
}

export interface CreateTransferParams {
  paymentId: string;
  transfers: {
    account: string;
    amountPaise: number;
    currency: "INR";
    notes?: Record<string, string>;
    onHold?: boolean;
  }[];
}

export interface ProviderTransfer {
  id: string;
  paymentId: string;
  recipient: string;
  amountPaise: number;
  currency: string;
  status: string;
  raw: Record<string, unknown>;
}

export interface ProviderRefund {
  id: string;
  paymentId: string;
  amountPaise: number;
  status: string;
  raw: Record<string, unknown>;
}

export interface CreateLinkedAccountParams {
  legalBusinessName: string;
  contactName: string;
  email: string;
  phone: string;
}

export interface ProviderLinkedAccount {
  id: string;
  status: string; // created | under_review | activated | needs_clarification | suspended
  onboardingUrl?: string | null;
  raw: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  readonly mode: "test" | "live" | "mock";
  /** Public key usable by clients for Checkout. Never the secret. */
  readonly publicKeyId: string | null;

  createOrder(params: CreateOrderParams): Promise<ProviderOrder>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  /** Subscriptions checkout signs `payment_id|subscription_id`. */
  verifySubscriptionSignature(params: {
    paymentId: string;
    subscriptionId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;

  createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription>;
  fetchSubscription(subscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<ProviderSubscription>;

  createTransfer(params: CreateTransferParams): Promise<ProviderTransfer>;
  createRefund(paymentId: string, amountPaise: number, notes?: Record<string, string>): Promise<ProviderRefund>;

  createLinkedAccount(params: CreateLinkedAccountParams): Promise<ProviderLinkedAccount>;
  fetchLinkedAccount(accountId: string): Promise<ProviderLinkedAccount>;
}

export interface BusinessEffectResult {
  membershipId?: string;
  membershipStatus?: string;
  gymStatus?: string;
  premiumActive?: boolean;
  requestCreated?: boolean;
}

export interface ProductPricing {
  product: PaymentProductType;
  amountPaise: number;
  label: string;
}
