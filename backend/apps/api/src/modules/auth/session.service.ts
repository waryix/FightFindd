import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { sessions, userRoles, users } from "../../db/schema.js";
import { loadEnv } from "../../env.js";
import { unauthorized } from "../../lib/errors.js";
import { generateRefreshToken, hashToken, signAccessToken } from "./tokens.js";

export interface SessionTokens {
  userId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

export class SessionService {
  constructor(private readonly db: Db) {}

  async createSession(
    userId: string,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<SessionTokens> {
    const env = loadEnv();
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const roles = await this.getRoles(userId);

    const [session] = await this.db
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      })
      .returning({ id: sessions.id });

    if (!session) throw new Error("Failed to create session");

    const { token, expiresAt } = await signAccessToken({ userId, roles, sessionId: session.id });

    return {
      userId,
      accessToken: token,
      accessTokenExpiresAt: expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
      sessionId: session.id,
    };
  }

  async rotate(refreshToken: string, meta: { ip?: string; userAgent?: string } = {}): Promise<SessionTokens> {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.refreshTokenHash, hashToken(refreshToken)), isNull(sessions.revokedAt)))
      .limit(1);

    if (!session) throw unauthorized("SESSION_EXPIRED", "Session expired. Please sign in again.");
    if (session.expiresAt.getTime() < Date.now()) {
      throw unauthorized("SESSION_EXPIRED", "Session expired. Please sign in again.");
    }

    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, session.id));
    return this.createSession(session.userId, meta);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, hashToken(refreshToken)));
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    const [session] = await this.db
      .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!session || session.revokedAt) return false;
    return session.expiresAt.getTime() > Date.now();
  }

  async touch(sessionId: string): Promise<void> {
    await this.db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, sessionId));
  }

  async getRoles(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.role);
  }

  async ensureRole(userId: string, role: string): Promise<void> {
    await this.db.insert(userRoles).values({ userId, role }).onConflictDoNothing();
  }

  async getUser(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
  }
}
