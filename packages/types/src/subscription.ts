import { z } from "zod";
import {
  subscriptionStatusSchema,
  type PaymentProductType,
  type SubscriptionStatus,
} from "./constants.js";

export interface SubscriptionRecord {
  id: string;
  userId: string;
  gymId: string | null;
  type: PaymentProductType;
  providerPlanId: string | null;
  providerSubscriptionId: string | null;
  status: SubscriptionStatus;
  rawProviderStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createSubscriptionSchema = z.object({
  product: z.enum(["FIGHTER_UPGRADE", "GYM_PLATFORM_SUBSCRIPTION"]),
  gymId: z.string().uuid().optional(),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const cancelSubscriptionSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true),
});
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

export const verifySubscriptionPaymentSchema = z.object({
  razorpayPaymentId: z.string().min(3),
  razorpaySubscriptionId: z.string().min(3),
  razorpaySignature: z.string().min(10),
});
export type VerifySubscriptionPaymentInput = z.infer<typeof verifySubscriptionPaymentSchema>;

export interface Entitlements {
  isPremium: boolean;
  premiumUntil: string | null;
  canUseAdvancedFilters: boolean;
  canSendUnlimitedRequests: boolean;
  hasProfileBoost: boolean;
  pendingRequestLimit: number | null;
}

export const entitlementSourceSchema = z.object({
  userId: z.string().uuid(),
  subscriptionStatus: subscriptionStatusSchema.nullable(),
});
