import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { analyticsBatchSchema } from "@fightfind/types";

const listQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.coerce.boolean().optional(),
});

export function registerNotificationsRoutes(app: FastifyInstance, ctx: AppContext) {
  const guard = { preHandler: ctx.guards.requireAuth };

  app.get("/api/v1/notifications", guard, async (request, reply) => {
    const query = parse(listQuery, request.query);
    const page = await ctx.notifications.list(userIdOf(request), query);
    return reply.send(page);
  });

  app.post("/api/v1/notifications/read", guard, async (request, reply) => {
    const input = parse(
      z.object({ ids: z.array(z.string().uuid()).optional(), all: z.boolean().optional() }),
      request.body ?? {},
    );
    const updated = await ctx.notifications.markRead(userIdOf(request), input);
    return reply.send({ success: true, updated });
  });

  app.post("/api/v1/notifications/devices", guard, async (request, reply) => {
    const input = parse(
      z.object({ token: z.string().min(8).max(500), platform: z.enum(["ios", "android", "web"]) }),
      request.body,
    );
    await ctx.notifications.registerDevice(userIdOf(request), input.token, input.platform);
    return reply.status(201).send({ success: true });
  });

  app.delete("/api/v1/notifications/devices", guard, async (request, reply) => {
    const input = parse(z.object({ token: z.string().min(8).max(500) }), request.body);
    await ctx.notifications.removeDevice(userIdOf(request), input.token);
    return reply.send({ success: true });
  });
}

export function registerConfigRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/v1/config", async (_request, reply) => {
    const { getPricing } = await import("../config/pricing.js");
    const pricing = getPricing();
    return reply.send({
      currency: "INR",
      paymentMode: ctx.provider.mode === "live" ? "live" : ctx.provider.mode === "mock" ? "mock" : "test",
      razorpayKeyId: ctx.provider.publicKeyId,
      pricing: {
        fighterPremiumMonthlyPaise: pricing.fighterPremiumMonthlyPaise,
        gymListingFeePaise: pricing.gymListingFeePaise,
        gymPlatformMonthlyPaise: pricing.gymPlatformMonthlyPaise,
      },
    });
  });
}

export function registerAnalyticsRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post(
    "/api/v1/analytics/events",
    { preHandler: ctx.guards.authenticate },
    async (request, reply) => {
      const input = parse(analyticsBatchSchema, request.body);
      await ctx.analytics.trackBatch(input.events, request.auth?.userId ?? null);
      return reply.send({ success: true });
    },
  );
}
