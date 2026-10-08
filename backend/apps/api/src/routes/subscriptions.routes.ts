import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { verifySubscriptionPaymentSchema } from "@fightfind/types";

export function registerSubscriptionsRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post(
    "/api/v1/subscriptions/fighter-upgrade",
    { preHandler: ctx.guards.requireRegistered },
    async (request, reply) => {
      const result = await ctx.subscriptions.createFighterUpgrade(userIdOf(request));
      await ctx.analytics.track("premium_upgrade_started", { userId: userIdOf(request) });
      return reply.status(201).send(result);
    },
  );

  app.post(
    "/api/v1/subscriptions/gym-platform",
    { preHandler: ctx.guards.requireGymOwner },
    async (request, reply) => {
      const input = parse(z.object({ gymId: z.string().uuid() }), request.body);
      const result = await ctx.gymOwner.createPlatformSubscription(userIdOf(request), input.gymId);
      return reply.status(201).send(result);
    },
  );

  app.get(
    "/api/v1/subscriptions/me/entitlements",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const entitlements = await ctx.entitlements.getForUser(userIdOf(request));
      return reply.send({ entitlements });
    },
  );

  app.get("/api/v1/subscriptions/me", { preHandler: ctx.guards.requireAuth }, async (request, reply) => {
    const { subscriptions } = await import("../db/schema.js");
    const { and, desc, eq } = await import("drizzle-orm");
    const [row] = await ctx.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userIdOf(request)), eq(subscriptions.type, "FIGHTER_UPGRADE")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return reply.send({ subscription: row ? ctx.subscriptions.mapSubscription(row) : null });
  });

  app.get(
    "/api/v1/subscriptions/:id",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const subscription = await ctx.subscriptions.getForUser(params.id, userIdOf(request));
      return reply.send({ subscription });
    },
  );

  app.post(
    "/api/v1/subscriptions/:id/cancel",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const input = parse(
        z.object({ cancelAtPeriodEnd: z.boolean().default(true) }),
        request.body ?? {},
      );
      const subscription = await ctx.subscriptions.cancel(params.id, userIdOf(request), input.cancelAtPeriodEnd);
      return reply.send({ subscription });
    },
  );

  /**
   * Client callback verification for subscription Checkout. The subscription
   * itself activates via webhooks — this only proves the callback is genuine.
   */
  app.post(
    "/api/v1/subscriptions/:id/verify",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const input = parse(verifySubscriptionPaymentSchema, request.body);
      const subscription = await ctx.subscriptions.getForUser(params.id, userIdOf(request));
      if (
        subscription.providerSubscriptionId !== input.razorpaySubscriptionId ||
        !ctx.provider.verifySubscriptionSignature({
          paymentId: input.razorpayPaymentId,
          subscriptionId: input.razorpaySubscriptionId,
          signature: input.razorpaySignature,
        })
      ) {
        return reply.status(400).send({
          error: {
            code: "PAYMENT_SIGNATURE_INVALID",
            message: "Subscription checkout could not be verified.",
          },
        });
      }
      return reply.send({ verified: true, subscription });
    },
  );

  app.get("/api/v1/subscriptions/:id/checkout", async (request, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const query = request.query as { return?: string };
    const { subscriptions } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const [row] = await ctx.db.select().from(subscriptions).where(eq(subscriptions.id, params.id)).limit(1);
    if (!row?.providerSubscriptionId) {
      return reply.status(404).send({ error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" } });
    }
    const pricing = (await import("../config/pricing.js")).getPricing();
    const { renderCheckoutPage } = await import("../modules/payments/checkout-page.js");
    const { resolveCallbackUrl } = await import("../lib/return-url.js");
    const callbackUrl = resolveCallbackUrl({
      requested: query.return,
      fallbackBase: "fightfind://payment-result",
      query: { subscriptionId: row.id, product: row.type },
      allowedOrigins: ctx.env.CORS_ORIGINS.split(","),
    });
    const amountPaise =
      row.type === "FIGHTER_UPGRADE" ? pricing.fighterPremiumMonthlyPaise : pricing.gymPlatformMonthlyPaise;
    const html = renderCheckoutPage({
      keyId: ctx.provider.publicKeyId ?? "",
      subscriptionId: row.providerSubscriptionId,
      amountPaise,
      currency: "INR",
      title: row.type === "FIGHTER_UPGRADE" ? "FightFind Pro" : "FightFind gym platform plan",
      description: row.type === "FIGHTER_UPGRADE" ? "Monthly subscription" : "Monthly platform subscription",
      callbackUrl,
      testMode: ctx.provider.mode !== "live",
    });
    return reply.type("text/html; charset=utf-8").send(html);
  });

  /** Pulls the latest provider state (lets subscriptions activate without webhooks). */
  app.post(
    "/api/v1/subscriptions/:id/sync",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const subscription = await ctx.subscriptions.syncNow(params.id, userIdOf(request));
      return reply.send({ subscription });
    },
  );

  /**
   * Development-only simulator: activates a mock subscription locally so the
   * full premium flow is testable without Razorpay. Never available in production.
   */
  app.post(
    "/api/v1/subscriptions/:id/dev-activate",
    { preHandler: ctx.guards.requireAuth },
    async (request, reply) => {
    if (!ctx.env.PAYMENT_SIMULATOR_ENABLED || ctx.env.NODE_ENV === "production") {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const { MockPaymentProvider } = await import("../modules/payments/mock.provider.js");
    if (!(ctx.provider instanceof MockPaymentProvider)) {
      return reply.status(409).send({ error: { code: "CONFLICT", message: "Simulator requires the mock provider" } });
    }
    const subscription = await ctx.subscriptions.getForUser(params.id, userIdOf(request));
    if (!subscription.providerSubscriptionId) {
      return reply.status(404).send({ error: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" } });
    }
    const updated = ctx.provider.setSubscriptionStatus(subscription.providerSubscriptionId, "active");
    await ctx.subscriptions.syncFromProvider(updated);
    return reply.send({ success: true });
    },
  );
}
