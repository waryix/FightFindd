import { z } from "zod";
import {
  paymentProductTypeSchema,
  type PaymentProductType,
  type PaymentStatus,
} from "./constants.js";

export interface PaymentRecord {
  id: string;
  userId: string;
  gymId: string | null;
  fighterId: string | null;
  type: PaymentProductType;
  amountPaise: number;
  currency: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  providerSubscriptionId: string | null;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const createOrderSchema = z.object({
  /** Server maps product to price. Clients never supply an amount. */
  product: paymentProductTypeSchema,
  gymId: z.string().uuid().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(3),
  razorpayPaymentId: z.string().min(3),
  razorpaySignature: z.string().min(10),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export interface CheckoutOrderResponse {
  paymentId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: string;
  product: PaymentProductType;
  testMode: boolean;
}

export interface VerifyPaymentResponse {
  paymentId: string;
  status: PaymentStatus;
  businessState: {
    membershipStatus?: string;
    gymStatus?: string;
    premiumActive?: boolean;
  };
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  providerRefundId: string;
  amountPaise: number;
  status: string;
  reason: string | null;
  createdAt: string;
}

export const createRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountPaise: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
