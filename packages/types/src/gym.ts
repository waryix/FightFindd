import { z } from "zod";
import {
  disciplineSchema,
  gymVerificationStatusSchema,
  GYM_SORT_OPTIONS,
  type Discipline,
  type GymStatus,
  type GymVerificationStatus,
} from "./constants.js";

export interface GymCard {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  disciplines: Discipline[];
  monthlyFeePaise: number | null;
  hasTrialClass: boolean;
  timings: string | null;
  coverPhotoUrl: string | null;
  photoUrls: string[];
  verificationStatus: GymVerificationStatus;
  isVerified: boolean;
  status: GymStatus;
  distanceKm: number | null;
}

export interface GymDetail extends GymCard {
  ownerName: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export const gymDiscoveryQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(500).optional(),
  city: z.string().max(120).optional(),
  discipline: disciplineSchema.optional(),
  maxFeePaise: z.coerce.number().int().min(0).optional(),
  minFeePaise: z.coerce.number().int().min(0).optional(),
  hasTrial: z.coerce.boolean().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  search: z.string().max(120).optional(),
  sort: z.enum(GYM_SORT_OPTIONS).default("most_relevant"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type GymDiscoveryQuery = z.infer<typeof gymDiscoveryQuerySchema>;

export const gymProfileFieldsSchema = z.object({
  name: z.string().min(2).max(160),
  ownerName: z.string().min(1).max(120).optional(),
  phone: z
    .string()
    .regex(/^(\+91)?[6-9]\d{9}$/)
    .optional(),
  email: z.string().email().max(254).optional(),
  description: z.string().max(2000).nullable().optional(),
  disciplines: z.array(disciplineSchema).min(1).max(7),
  address: z.string().min(3).max(300),
  city: z.string().min(1).max(120),
  state: z.string().min(1).max(120),
  pincode: z
    .string()
    .regex(/^\d{6}$/)
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  timings: z.string().max(300).nullable().optional(),
  monthlyFeePaise: z.number().int().min(0).max(10_000_00).nullable().optional(),
  hasTrialClass: z.boolean().optional(),
  photoUrls: z.array(z.string().max(1000)).max(12).optional(),
});

export const createGymSchema = gymProfileFieldsSchema;
export type CreateGymInput = z.infer<typeof createGymSchema>;
export const updateGymSchema = gymProfileFieldsSchema.partial();
export type UpdateGymInput = z.infer<typeof updateGymSchema>;

export interface GymOwnerOnboardingState {
  step:
    | "account"
    | "gym_details"
    | "business_details"
    | "razorpay_linked_account"
    | "listing_payment"
    | "platform_subscription"
    | "verification"
    | "active";
  gymId: string | null;
  gymStatus: GymStatus | null;
  razorpayLinkedAccountId: string | null;
  razorpayOnboardingStatus: "not_started" | "under_review" | "activated" | "needs_clarification";
  listingPaymentStatus: "unpaid" | "paid" | "failed";
  subscriptionStatus: "none" | "pending" | "active" | "halted" | "cancelled" | "expired" | "payment_failed";
  verificationStatus: GymVerificationStatus;
}

export interface GymDashboard {
  gym: {
    id: string;
    name: string;
    status: GymStatus;
    verificationStatus: GymVerificationStatus;
  } | null;
  currentMembers: number;
  pendingRequests: number;
  monthlyRevenuePaise: number;
  upcomingRenewals: number;
  subscription: {
    status: string;
    pricePaise: number;
    nextBillingAt: string | null;
  };
  listingFeePaid: boolean;
}

export const verifyGymSchema = z.object({
  status: gymVerificationStatusSchema,
  reason: z.string().max(500).optional(),
});
export type VerifyGymInput = z.infer<typeof verifyGymSchema>;
