import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { notFound } from "../lib/errors.js";

const updateMeSchema = z.object({ name: z.string().min(1).max(120).optional() });

export function registerUsersRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/v1/users/me", { preHandler: ctx.guards.requireAuth }, async (request, reply) => {
    const userId = userIdOf(request);
    const user = await ctx.auth.buildAuthUser(userId);
    if (!user) throw notFound("FIGHTER_NOT_FOUND", "User not found");
    const entitlements = await ctx.entitlements.getForUser(userId);
    return reply.send({ user, entitlements });
  });

  app.patch("/api/v1/users/me", { preHandler: ctx.guards.requireAuth }, async (request, reply) => {
    const userId = userIdOf(request);
    const input = parse(updateMeSchema, request.body);
    if (input.name) {
      const { users } = await import("../db/schema.js");
      const { eq } = await import("drizzle-orm");
      await ctx.db.update(users).set({ name: input.name, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    const user = await ctx.auth.buildAuthUser(userId);
    const entitlements = await ctx.entitlements.getForUser(userId);
    return reply.send({ user, entitlements });
  });
}
