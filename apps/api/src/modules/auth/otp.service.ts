import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { otpChallenges } from "../../db/schema.js";
import { loadEnv } from "../../env.js";
import { badRequest, rateLimited } from "../../lib/errors.js";
import { generateOtpCode, hashOtpCode, safeEqual } from "./tokens.js";
import type { OtpSender } from "./otp.senders.js";

export type OtpChannel = "phone" | "email";

export function normalizeIdentifier(channel: OtpChannel, raw: string): string {
  if (channel === "email") return raw.trim().toLowerCase();
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${local}`;
}

export interface RequestOtpResult {
  challengeId: string;
  channel: OtpChannel;
  identifier: string;
  expiresAt: Date;
  /** Only populated in development, never in production. */
  devOtp?: string;
}

export class OtpService {
  constructor(
    private readonly db: Db,
    private readonly sender: OtpSender,
  ) {}

  async request(params: {
    channel: OtpChannel;
    identifier: string;
    purpose: string;
    ip?: string;
  }): Promise<RequestOtpResult> {
    const env = loadEnv();
    const identifier = normalizeIdentifier(params.channel, params.identifier);

    const oneHourAgo = new Date(Date.now() - 60 * 60_000);
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(otpChallenges)
      .where(and(eq(otpChallenges.identifier, identifier), gt(otpChallenges.createdAt, oneHourAgo)));
    const count = rows[0]?.count ?? 0;

    if (count >= env.OTP_RATE_LIMIT_PER_HOUR) {
      throw rateLimited("Too many OTP requests for this number or email. Try again later.");
    }

    const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);
    const isDev = env.NODE_ENV !== "production";
    // Development/test use the configurable DEV_OTP; production always uses a random code.
    const finalCode = isDev ? env.DEV_OTP : generateOtpCode();

    const [challenge] = await this.db
      .insert(otpChallenges)
      .values({
        channel: params.channel,
        identifier,
        purpose: params.purpose,
        codeHash: hashOtpCode(finalCode),
        maxAttempts: env.OTP_MAX_ATTEMPTS,
        expiresAt,
        requestIp: params.ip ?? null,
      })
      .returning({ id: otpChallenges.id });

    if (!challenge) throw new Error("Failed to create OTP challenge");

    await this.deliver(params.channel, identifier, finalCode);

    return {
      challengeId: challenge.id,
      channel: params.channel,
      identifier,
      expiresAt,
      // Never expose the code in production.
      devOtp: isDev ? finalCode : undefined,
    };
  }

  private async deliver(channel: OtpChannel, identifier: string, code: string) {
    if (channel === "phone") await this.sender.sendPhone(identifier, code);
    else await this.sender.sendEmail(identifier, code);
  }

  async verify(params: {
    challengeId: string;
    code: string;
  }): Promise<{ identifier: string; channel: OtpChannel; purpose: string }> {
    const env = loadEnv();
    const [challenge] = await this.db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, params.challengeId))
      .limit(1);

    if (!challenge || challenge.consumedAt) {
      throw badRequest("OTP_INVALID", "Invalid OTP. Request a new code.");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      throw badRequest("OTP_EXPIRED", "This OTP has expired. Request a new code.");
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw badRequest("OTP_TOO_MANY_ATTEMPTS", "Too many incorrect attempts. Request a new code.");
    }

    const isDev = env.NODE_ENV !== "production";
    const devMatch = isDev && params.code === env.DEV_OTP;
    const hashMatch = safeEqual(hashOtpCode(params.code), challenge.codeHash);

    if (!devMatch && !hashMatch) {
      await this.db
        .update(otpChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(otpChallenges.id, challenge.id));
      throw badRequest("OTP_INVALID", "Incorrect OTP. Check the code and try again.");
    }

    await this.db
      .update(otpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(otpChallenges.id, challenge.id));

    return {
      identifier: challenge.identifier,
      channel: challenge.channel as OtpChannel,
      purpose: challenge.purpose,
    };
  }
}
