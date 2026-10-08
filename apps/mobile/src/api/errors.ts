import { ApiClientError } from "@fightfind/api-client";

const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: "You appear to be offline. Check your connection and try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  OTP_INVALID: "That code is not right. Check the OTP and try again.",
  OTP_EXPIRED: "That OTP has expired. Request a new one.",
  OTP_TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  SESSION_EXPIRED: "Your session expired. Please sign in again.",
  REQUEST_LIMIT_REACHED: "You've hit the free request limit. Upgrade to FightFind Pro for unlimited requests.",
  ADVANCED_FILTERS_REQUIRE_PREMIUM: "Advanced filters are part of FightFind Pro.",
  DUPLICATE_REQUEST: "You already have a pending request with this fighter.",
  CANNOT_REQUEST_SELF: "You cannot send a request to yourself.",
  MEMBERSHIP_ALREADY_ACTIVE: "You already have an active membership at this gym.",
  GYM_NOT_ACTIVE: "This gym is not accepting memberships right now.",
  FORBIDDEN: "Create a free account to use this feature.",
  GYM_OWNER_ACCESS_REQUIRED: "This account does not have gym-owner access.",
};

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiClientError) {
    if (error.code === "VALIDATION_ERROR" && error.message) return error.message;
    return FRIENDLY[error.code] ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "NETWORK_ERROR";
}
