import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { indianPhoneSchema, requestOtpSchema, verifyOtpSchema, refreshSessionSchema } from "@fightfind/types";
import { userIdOf } from "../lib/request.js";

const REFRESH_COOKIE = "ff_refresh";
const COOKIE_PATH = "/api/v1/auth";

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: string, secure: boolean) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: COOKIE_PATH,
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext) {
  const secureCookies = ctx.env.NODE_ENV === "production";

  app.post(
    "/api/v1/auth/otp/request",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const input = parse(requestOtpSchema, request.body);
    const identifier =
      input.channel === "phone" ? parse(indianPhoneSchema, input.identifier) : parse(z.email().max(254), input.identifier);
    const result = await ctx.auth.requestOtp({
      channel: input.channel,
      identifier,
      purpose: input.purpose,
      ip: request.ip,
    });
    return reply.send(result);
  });

  app.post(
    "/api/v1/auth/otp/verify",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const input = parse(verifyOtpSchema, request.body);
    const session = await ctx.auth.verifyOtp({
      challengeId: input.challengeId,
      code: input.code,
      name: input.name,
      meta: { ip: request.ip, userAgent: request.headers["user-agent"] },
    });
    if (session.tokens.refreshToken && session.tokens.refreshTokenExpiresAt) {
      setRefreshCookie(reply, session.tokens.refreshToken, session.tokens.refreshTokenExpiresAt, secureCookies);
    }
    await ctx.analytics.track("fighter_signup", {
      userId: session.user.id,
      properties: { roles: session.user.roles },
    });
    return reply.send(session);
  });

  app.post("/api/v1/auth/guest", async (request, reply) => {
    const session = await ctx.auth.guest({
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return reply.send(session);
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const body = parse(refreshSessionSchema, request.body ?? {});
    const refreshToken = body.refreshToken ?? request.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return reply.status(401).send({ error: { code: "SESSION_EXPIRED", message: "No session to refresh." } });
    }
    const session = await ctx.auth.refresh(refreshToken, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    if (session.tokens.refreshToken && session.tokens.refreshTokenExpiresAt) {
      setRefreshCookie(reply, session.tokens.refreshToken, session.tokens.refreshTokenExpiresAt, secureCookies);
    }
    return reply.send(session);
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const body = parse(refreshSessionSchema, request.body ?? {});
    const refreshToken = body.refreshToken ?? request.cookies?.[REFRESH_COOKIE];
    if (refreshToken) await ctx.auth.sessions.revoke(refreshToken);
    if (request.auth) await ctx.auth.sessions.revokeSessionById(request.auth.sessionId);
    clearRefreshCookie(reply);
    return reply.send({ success: true });
  });

  app.get(
    "/api/v1/auth/session",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const user = await ctx.auth.buildAuthUser(userIdOf(request));
      const entitlements = await ctx.entitlements.getForUser(userIdOf(request));
      return reply.send({ user, entitlements });
    },
  );
}

export { REFRESH_COOKIE };
