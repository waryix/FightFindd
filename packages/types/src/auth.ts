import { z } from "zod";
import { userRoleSchema, type UserRole } from "./constants.js";
import type { Entitlements } from "./subscription.js";

export const otpChannelSchema = z.enum(["phone", "email"]);
export type OtpChannel = z.infer<typeof otpChannelSchema>;

export const indianPhoneSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number")
  .transform((v) => (v.startsWith("+91") ? v : `+91${v}`));

export const requestOtpSchema = z.object({
  channel: otpChannelSchema,
  /** Phone (10-digit or +91) when channel=phone, email when channel=email. */
  identifier: z.string().min(3).max(254),
  purpose: z
    .enum(["login", "signup", "gym_owner_login", "gym_owner_signup"])
    .default("login"),
  name: z.string().min(1).max(120).optional(),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  name: z.string().min(1).max(120).optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export interface AuthUser {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  roles: z.infer<typeof userRoleSchema>[];
  isGuest: boolean;
  onboarding: {
    hasFighterProfile: boolean;
    fighterProfileComplete: boolean;
    isGymOwner: boolean;
    gymCount: number;
  };
}

export interface AuthSessionResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export const refreshSessionSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});
export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;

/** GET /api/v1/users/me */
export interface ApiUserMe {
  user: AuthUser;
  entitlements: Entitlements;
}

export interface AdminUserRecord {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  roles: UserRole[];
  status: string;
  createdAt: string;
}
