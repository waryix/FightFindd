import { z } from "zod";

/** Combat disciplines supported by FightFind. */
export const DISCIPLINES = [
  "boxing",
  "mma",
  "kickboxing",
  "muay_thai",
  "bjj",
  "wrestling",
  "mixed",
] as const;
export type Discipline = (typeof DISCIPLINES)[number];
export const disciplineSchema = z.enum(DISCIPLINES);

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  boxing: "Boxing",
  mma: "MMA",
  kickboxing: "Kickboxing",
  muay_thai: "Muay Thai",
  bjj: "BJJ",
  wrestling: "Wrestling",
  mixed: "Mixed",
};

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "professional"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export const skillLevelSchema = z.enum(SKILL_LEVELS);

export const WEIGHT_CLASSES = [
  "flyweight",
  "bantamweight",
  "featherweight",
  "lightweight",
  "welterweight",
  "middleweight",
  "heavyweight",
] as const;
export type WeightClass = (typeof WEIGHT_CLASSES)[number];
export const weightClassSchema = z.enum(WEIGHT_CLASSES);

/** Inclusive upper bound of each weight class in kg (India-first amateur classes). */
export const WEIGHT_CLASS_MAX_KG: Record<WeightClass, number> = {
  flyweight: 52,
  bantamweight: 56,
  featherweight: 60,
  lightweight: 65,
  welterweight: 70,
  middleweight: 75,
  heavyweight: Number.POSITIVE_INFINITY,
};

export const WEIGHT_CLASS_RANGE_LABELS: Record<WeightClass, string> = {
  flyweight: "up to 52 kg",
  bantamweight: "52–56 kg",
  featherweight: "56–60 kg",
  lightweight: "60–65 kg",
  welterweight: "65–70 kg",
  middleweight: "70–75 kg",
  heavyweight: "75 kg+",
};

export function suggestWeightClass(weightKg: number): WeightClass {
  for (const wc of WEIGHT_CLASSES) {
    if (weightKg <= WEIGHT_CLASS_MAX_KG[wc]) return wc;
  }
  return "heavyweight";
}

export const USER_ROLES = ["FIGHTER", "GYM_OWNER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const SPARRING_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export type SparringRequestStatus = (typeof SPARRING_REQUEST_STATUSES)[number];
export const sparringRequestStatusSchema = z.enum(SPARRING_REQUEST_STATUSES);

export const MEMBERSHIP_STATUSES = [
  "pending_payment",
  "paid_pending_approval",
  "active",
  "rejected",
  "expired",
  "cancelled",
  "refunded",
  "payment_failed",
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export const membershipStatusSchema = z.enum(MEMBERSHIP_STATUSES);

export const MEMBERSHIP_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type MembershipRequestStatus = (typeof MEMBERSHIP_REQUEST_STATUSES)[number];

export const GYM_STATUSES = [
  "draft",
  "awaiting_listing_payment",
  "onboarding",
  "pending_verification",
  "active",
  "payment_failed",
  "verification_rejected",
  "suspended",
] as const;
export type GymStatus = (typeof GYM_STATUSES)[number];
export const gymStatusSchema = z.enum(GYM_STATUSES);

export const GYM_VERIFICATION_STATUSES = ["pending", "verified", "rejected", "suspended"] as const;
export type GymVerificationStatus = (typeof GYM_VERIFICATION_STATUSES)[number];
export const gymVerificationStatusSchema = z.enum(GYM_VERIFICATION_STATUSES);

export const PAYMENT_PRODUCT_TYPES = [
  "FIGHTER_UPGRADE",
  "GYM_LISTING",
  "GYM_PLATFORM_SUBSCRIPTION",
  "GYM_MEMBERSHIP",
] as const;
export type PaymentProductType = (typeof PAYMENT_PRODUCT_TYPES)[number];
export const paymentProductTypeSchema = z.enum(PAYMENT_PRODUCT_TYPES);

export const PAYMENT_STATUSES = [
  "created",
  "processing",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "active",
  "halted",
  "cancelled",
  "expired",
  "payment_failed",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

export const TRANSFER_STATUSES = [
  "created",
  "processing",
  "processed",
  "failed",
  "reversed",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export const REFUND_STATUSES = ["created", "processed", "failed"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const DISCOVERY_SORT_OPTIONS = [
  "best_match",
  "nearest",
  "most_experienced",
  "recently_active",
] as const;
export type DiscoverySort = (typeof DISCOVERY_SORT_OPTIONS)[number];

export const GYM_SORT_OPTIONS = ["nearest", "most_relevant", "lowest_fee", "highest_rated"] as const;
export type GymSort = (typeof GYM_SORT_OPTIONS)[number];

export const RADIUS_OPTIONS_KM = [5, 10, 25, 50] as const;

/** Default pricing in paise (smallest INR unit). Environment-configurable server-side. */
export const DEFAULT_PRICING_PAISE = {
  FIGHTER_PREMIUM_MONTHLY: 19900,
  GYM_LISTING_FEE: 99900,
  GYM_PLATFORM_MONTHLY: 39900,
} as const;

export const CURRENCY = "INR";

export const SUPPORTED_CITIES = [
  { city: "Bengaluru", state: "Karnataka" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "New Delhi", state: "Delhi" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Chennai", state: "Tamil Nadu" },
  { city: "Pune", state: "Maharashtra" },
  { city: "Kolkata", state: "West Bengal" },
  { city: "Ahmedabad", state: "Gujarat" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "Kochi", state: "Kerala" },
] as const;

/** Free-tier limit on pending outgoing sparring requests (premium removes the cap). */
export const FREE_TIER_PENDING_REQUEST_LIMIT = 3;

export const MATCH_SCORE_WEIGHTS = {
  weight: 0.3,
  skill: 0.25,
  discipline: 0.2,
  distance: 0.2,
  activity: 0.05,
} as const;
