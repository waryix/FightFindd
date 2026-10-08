import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "../db/schema.js";
import type { Db } from "../db/client.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import { verifyAccessToken } from "../modules/auth/tokens.js";
import type { SessionService } from "../modules/auth/session.service.js";

export interface AuthContext {
  userId: string;
  sessionId: string;
  roles: string[];
  isGuest: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

interface SessionCacheEntry {
  active: boolean;
  expiresAt: number;
}

const SESSION_CACHE_TTL_MS = 30_000;

export interface AuthGuards {
  authenticate: (request: FastifyRequest) => Promise<void>;
  requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireRegistered: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireRole: (...roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireGymOwner: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireFighter: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
}

export function createAuthGuards(deps: { db: Db; sessions: SessionService }): AuthGuards {
  const sessionCache = new Map<string, SessionCacheEntry>();

  async function authenticate(request: FastifyRequest): Promise<void> {
    request.auth = null;
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return;

    const payload = await verifyAccessToken(token);
    if (!payload) return;

    const now = Date.now();
    const cached = sessionCache.get(payload.sid);
    let active: boolean;
    if (cached && cached.expiresAt > now) {
      active = cached.active;
    } else {
      active = await deps.sessions.isSessionActive(payload.sid);
      sessionCache.set(payload.sid, { active, expiresAt: now + SESSION_CACHE_TTL_MS });
      if (sessionCache.size > 10_000) sessionCache.clear();
    }
    if (!active) return;

    const [user] = await deps.db
      .select({ isGuest: users.isGuest, status: users.status, rolesMissing: users.id })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || user.status !== "active") return;

    const roles = await deps.sessions.getRoles(payload.sub);
    request.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      roles,
      isGuest: user.isGuest,
    };
  }

  const requireAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.auth) await authenticate(request);
    if (!request.auth) throw unauthorized();
    await deps.sessions.touch(request.auth.sessionId).catch(() => undefined);
    await deps.db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, request.auth.userId)).catch(() => undefined);
  };

  const requireRegistered = async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (request.auth?.isGuest) {
      throw forbidden("FORBIDDEN", "Create a free Fighter account to use this feature.");
    }
  };

  const requireRole =
    (...roles: string[]) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireAuth(request, reply);
      const held = request.auth?.roles ?? [];
      if (!roles.some((role) => held.includes(role))) {
        throw forbidden("FORBIDDEN", "You do not have permission to perform this action.");
      }
    };

  const requireGymOwner = async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (!request.auth?.roles.includes("GYM_OWNER")) {
      throw forbidden("GYM_OWNER_ACCESS_REQUIRED", "This account does not have gym-owner access.");
    }
  };

  const requireFighter = async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRegistered(request, reply);
  };

  return { authenticate, requireAuth, requireRegistered, requireRole, requireGymOwner, requireFighter };
}
