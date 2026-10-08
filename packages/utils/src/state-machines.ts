import type {
  GymStatus,
  MembershipStatus,
  SparringRequestStatus,
  SubscriptionStatus,
} from "@fightfind/types";

/** Allowed sparring request transitions, keyed by current status. */
const SPARRING_TRANSITIONS: Record<SparringRequestStatus, SparringRequestStatus[]> = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["completed", "cancelled"],
  declined: [],
  completed: [],
  cancelled: [],
};

export function canTransitionSparring(
  from: SparringRequestStatus,
  to: SparringRequestStatus,
): boolean {
  return SPARRING_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Who may perform a transition: receiver decides accept/decline, participants cancel/complete. */
export function sparringTransitionActor(
  to: SparringRequestStatus,
): "receiver" | "sender" | "either" {
  if (to === "accepted" || to === "declined") return "receiver";
  if (to === "cancelled") return "either";
  return "either";
}

const MEMBERSHIP_TRANSITIONS: Record<MembershipStatus, MembershipStatus[]> = {
  pending_payment: ["payment_failed", "paid_pending_approval", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  paid_pending_approval: ["active", "rejected", "refunded"],
  active: ["expired", "cancelled", "refunded"],
  rejected: ["refunded"],
  expired: [],
  cancelled: [],
  refunded: [],
};

export function canTransitionMembership(from: MembershipStatus, to: MembershipStatus): boolean {
  return MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}

const GYM_TRANSITIONS: Record<GymStatus, GymStatus[]> = {
  draft: ["awaiting_listing_payment", "suspended"],
  awaiting_listing_payment: ["onboarding", "payment_failed", "suspended"],
  payment_failed: ["awaiting_listing_payment", "onboarding", "suspended"],
  onboarding: ["pending_verification", "suspended"],
  pending_verification: ["active", "verification_rejected", "suspended"],
  verification_rejected: ["pending_verification", "suspended"],
  active: ["suspended", "pending_verification"],
  suspended: ["active", "pending_verification"],
};

export function canTransitionGym(from: GymStatus, to: GymStatus): boolean {
  return GYM_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Maps Razorpay subscription states onto FightFind's normalized statuses.
 * Provider states: created, authenticated, active, pending, halted, cancelled,
 * completed, expired, paused, resumed.
 */
export function mapProviderSubscriptionStatus(raw: string | null | undefined): SubscriptionStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "active":
    case "authenticated":
    case "resumed":
      return "active";
    case "created":
    case "pending":
    case "paused":
      return "pending";
    case "halted":
      return "halted";
    case "cancelled":
      return "cancelled";
    case "expired":
    case "completed":
      return "expired";
    default:
      return "payment_failed";
  }
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active";
}
