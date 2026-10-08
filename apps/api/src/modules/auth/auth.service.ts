import { eq, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { fighterProfiles, gymOwners, gymProfiles, users } from "../../db/schema.js";
import { conflict, notFound } from "../../lib/errors.js";
import type { AuthSessionResponse, AuthTokens, AuthUser } from "@fightfind/types";
import { OtpService, type OtpChannel } from "./otp.service.js";
import { SessionService } from "./session.service.js";
import type { OtpSender } from "./otp.senders.js";

export class AuthService {
  readonly otp: OtpService;
  readonly sessions: SessionService;

  constructor(
    private readonly db: Db,
    sender: OtpSender,
  ) {
    this.otp = new OtpService(db, sender);
    this.sessions = new SessionService(db);
  }

  async requestOtp(params: {
    channel: OtpChannel;
    identifier: string;
    purpose: "login" | "signup" | "gym_owner_login" | "gym_owner_signup";
    ip?: string;
  }) {
    return this.otp.request(params);
  }

  async verifyOtp(params: {
    challengeId: string;
    code: string;
    name?: string;
    meta: { ip?: string; userAgent?: string };
  }): Promise<AuthSessionResponse> {
    const verified = await this.otp.verify({ challengeId: params.challengeId, code: params.code });
    const user = await this.findOrCreateUser({
      channel: verified.channel,
      identifier: verified.identifier,
      purpose: verified.purpose,
      name: params.name,
    });
    const tokens = await this.sessions.createSession(user.id, params.meta);
    return this.buildSessionResponse(user.id, tokens);
  }

  async guest(meta: { ip?: string; userAgent?: string }): Promise<AuthSessionResponse> {
    const [user] = await this.db
      .insert(users)
      .values({ name: "Guest Fighter", isGuest: true })
      .returning();
    if (!user) throw new Error("Failed to create guest session");
    await this.sessions.ensureRole(user.id, "FIGHTER");
    const tokens = await this.sessions.createSession(user.id, meta);
    return this.buildSessionResponse(user.id, tokens);
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<AuthSessionResponse> {
    const tokens = await this.sessions.rotate(refreshToken, meta);
    return this.buildSessionResponse(tokens.userId, tokens);
  }

  private async findOrCreateUser(params: {
    channel: OtpChannel;
    identifier: string;
    purpose: string;
    name?: string;
  }) {
    const column = params.channel === "phone" ? users.phone : users.email;
    const [existing] = await this.db.select().from(users).where(eq(column, params.identifier)).limit(1);
    if (existing) {
      if (existing.status === "suspended") {
        throw conflict("FORBIDDEN", "This account has been suspended.");
      }
      if (params.name && !existing.name) {
        await this.db.update(users).set({ name: params.name }).where(eq(users.id, existing.id));
      }
      if (params.purpose === "gym_owner_login" || params.purpose === "gym_owner_signup") {
        const roles = await this.sessions.getRoles(existing.id);
        if (!roles.includes("GYM_OWNER") && params.purpose === "gym_owner_login") {
          throw notFound(
            "GYM_OWNER_ACCESS_REQUIRED",
            "This account does not have gym-owner access.",
          );
        }
        await this.ensureGymOwner(existing.id);
        return existing;
      }
      // Ensure the default fighter role exists for accounts created elsewhere.
      await this.sessions.ensureRole(existing.id, "FIGHTER");
      return existing;
    }

    if (params.purpose === "gym_owner_login") {
      // Logging in must never silently create an owner relationship.
      throw notFound(
        "GYM_OWNER_ACCESS_REQUIRED",
        "No gym owner account found for this phone or email. Create a gym owner account first.",
      );
    }

    const [created] = await this.db
      .insert(users)
      .values({
        name: params.name ?? null,
        phone: params.channel === "phone" ? params.identifier : null,
        email: params.channel === "email" ? params.identifier : null,
      })
      .returning();
    if (!created) throw new Error("Failed to create user");
    if (params.purpose === "gym_owner_signup") {
      await this.ensureGymOwner(created.id);
      await this.sessions.ensureRole(created.id, "FIGHTER");
    } else {
      await this.sessions.ensureRole(created.id, "FIGHTER");
    }
    return created;
  }

  async ensureGymOwner(userId: string): Promise<void> {
    await this.sessions.ensureRole(userId, "GYM_OWNER");
    await this.db.insert(gymOwners).values({ userId }).onConflictDoNothing();
  }

  async bootstrapGymOwner(params: {
    channel: OtpChannel;
    identifier: string;
    name?: string;
    meta: { ip?: string; userAgent?: string };
  }): Promise<AuthSessionResponse> {
    const existing = params.channel === "phone"
      ? (await this.db.select().from(users).where(eq(users.phone, params.identifier)).limit(1))[0]
      : (await this.db.select().from(users).where(eq(users.email, params.identifier)).limit(1))[0];

    let userId: string;
    if (existing) {
      userId = existing.id;
      if (params.name && !existing.name) {
        await this.db.update(users).set({ name: params.name }).where(eq(users.id, userId));
      }
    } else {
      const [created] = await this.db
        .insert(users)
        .values({
          name: params.name ?? null,
          phone: params.channel === "phone" ? params.identifier : null,
          email: params.channel === "email" ? params.identifier : null,
        })
        .returning();
      if (!created) throw new Error("Failed to create user");
      userId = created.id;
    }
    await this.ensureGymOwner(userId);
    const tokens = await this.sessions.createSession(userId, params.meta);
    return this.buildSessionResponse(userId, tokens);
  }

  async buildSessionResponse(userId: string, tokens: SessionTokensLike): Promise<AuthSessionResponse> {
    const user = await this.buildAuthUser(userId);
    if (!user) throw notFound("FIGHTER_NOT_FOUND", "User not found");
    const authTokens: AuthTokens = {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    };
    return { user, tokens: authTokens };
  }

  async buildAuthUser(userId: string): Promise<AuthUser | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;

    const roles = await this.sessions.getRoles(userId);
    const [profile] = await this.db
      .select({ id: fighterProfiles.id })
      .from(fighterProfiles)
      .where(eq(fighterProfiles.userId, userId))
      .limit(1);
    const gymCountRows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(gymProfiles)
      .where(eq(gymProfiles.ownerUserId, userId));

    const gymCount = gymCountRows[0]?.count ?? 0;
    const [owner] = await this.db
      .select({ userId: gymOwners.userId })
      .from(gymOwners)
      .where(eq(gymOwners.userId, userId))
      .limit(1);

    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      roles: roles as AuthUser["roles"],
      isGuest: user.isGuest,
      onboarding: {
        hasFighterProfile: Boolean(profile),
        fighterProfileComplete: Boolean(profile),
        isGymOwner: Boolean(owner),
        gymCount,
      },
    };
  }
}

interface SessionTokensLike {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}
