import { z } from "zod";

/** Canonical API error codes. Clients map these to friendly copy. */
export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  // Auth
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_TOO_MANY_ATTEMPTS",
  "OTP_RATE_LIMITED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "PHONE_TAKEN",
  "EMAIL_TAKEN",
  // Fighters
  "FIGHTER_NOT_FOUND",
  "PROFILE_INCOMPLETE",
  "CANNOT_REQUEST_SELF",
  "DUPLICATE_REQUEST",
  "REQUEST_LIMIT_REACHED",
  "ADVANCED_FILTERS_REQUIRE_PREMIUM",
  // Sparring
  "MATCH_NOT_FOUND",
  "MATCH_INVALID_TRANSITION",
  "NOT_MATCH_PARTICIPANT",
  // Messages
  "MESSAGE_EMPTY",
  "MESSAGE_TOO_LONG",
  "MATCH_NOT_ACCEPTED",
  // Gyms
  "GYM_NOT_FOUND",
  "GYM_NOT_ACTIVE",
  "GYM_NOT_OWNER",
  "GYM_OWNER_ACCESS_REQUIRED",
  "LISTING_PAYMENT_REQUIRED",
  "GYM_SUBSCRIPTION_REQUIRED",
  // Memberships
  "MEMBERSHIP_NOT_FOUND",
  "MEMBERSHIP_ALREADY_ACTIVE",
  "MEMBERSHIP_INVALID_TRANSITION",
  "GYM_HAS_NO_FEE",
  // Payments
  "PAYMENT_NOT_FOUND",
  "PAYMENT_ALREADY_PROCESSED",
  "PAYMENT_VERIFICATION_FAILED",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_PROVIDER_ERROR",
  "PAYMENT_SIGNATURE_INVALID",
  "PRODUCT_NOT_CONFIGURED",
  "SUBSCRIPTION_NOT_FOUND",
  "WEBHOOK_SIGNATURE_INVALID",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const err = v.error;
  return !!err && typeof err === "object" && "code" in err && "message" in err;
}

export function paiseToInr(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatInr(paise: number): string {
  const inr = paiseToInr(paise);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: inr % 1 === 0 ? 0 : 2,
  }).format(inr);
}
