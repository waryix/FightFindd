import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { verifyPaymentSchema } from "@fightfind/types";

const simulateParam = z.object({ paymentId: z.string().uuid() });

export function registerPaymentsRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post(
    "/api/v1/payments/order",
    { preHandler: ctx.guards.requireRegistered },
    async (request, reply) => {
      const input = parse(
        z.object({
          product: z.enum(["GYM_MEMBERSHIP", "FIGHTER_UPGRADE", "GYM_PLATFORM_SUBSCRIPTION"]),
          gymId: z.string().uuid().optional(),
        }),
        request.body,
      );
      const order = await ctx.orders.createOrder({
        userId: userIdOf(request),
        product: input.product,
        gymId: input.gymId,
      });
      return reply.status(201).send(order);
    },
  );

  app.post(
    "/api/v1/payments/verify",
    { preHandler: ctx.guards.requireRegistered },
    async (request, reply) => {
      const input = parse(verifyPaymentSchema, request.body);
      const result = await ctx.payments.verifyClientPayment({ userId: userIdOf(request), input });
      await ctx.analytics.track("gym_payment_success", {
        userId: userIdOf(request),
        properties: { paymentId: result.paymentId, status: result.status },
      });
      return reply.send(result);
    },
  );

  app.get(
    "/api/v1/payments/:id",
    { preHandler: ctx.guards.requireRegistered },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const payment = await ctx.payments.getForUser(params.id, userIdOf(request));
      return reply.send({ payment });
    },
  );

  /**
   * Hosted checkout page for the mobile WebView. The page only carries public
   * identifiers (order/subscription id, publishable key) — the secret never
   * leaves the server.
   */
  app.get("/api/v1/payments/:id/checkout", async (request, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const query = request.query as { return?: string };
    const payment = await ctx.payments.getById(params.id);
    if (!payment || !payment.providerOrderId) {
      return reply.status(404).send({ error: { code: "PAYMENT_NOT_FOUND", message: "Payment not found" } });
    }
    if (payment.status === "captured" || payment.status === "refunded") {
      return reply.status(409).send({ error: { code: "PAYMENT_ALREADY_PROCESSED", message: "This payment is already complete." } });
    }
    const { renderCheckoutPage } = await import("../modules/payments/checkout-page.js");
    const { resolveCallbackUrl } = await import("../lib/return-url.js");
    const callbackUrl = resolveCallbackUrl({
      requested: query.return,
      fallbackBase: "fightfind://payment-result",
      query: { paymentId: payment.id, product: payment.type },
      allowedOrigins: ctx.env.CORS_ORIGINS.split(","),
    });
    const html = renderCheckoutPage({
      keyId: ctx.provider.publicKeyId ?? "",
      orderId: payment.providerOrderId,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      title: payment.type === "GYM_MEMBERSHIP" ? "Gym membership" : "FightFind payment",
      description:
        (payment.metadata?.gymName as string | undefined) ??
        (payment.type === "GYM_MEMBERSHIP" ? "Monthly gym membership" : payment.type),
      callbackUrl,
      testMode: ctx.provider.mode !== "live",
    });
    return reply.type("text/html; charset=utf-8").send(html);
  });

  /**
   * Development-only simulator. Requires PAYMENT_SIMULATOR_ENABLED=true and the
   * mock provider; it is impossible to enable in production.
   */
  app.post("/api/v1/payments/:paymentId/simulate", async (request, reply) => {
    if (!ctx.env.PAYMENT_SIMULATOR_ENABLED || ctx.env.NODE_ENV === "production") {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    const params = parse(simulateParam, request.params);
    const payment = await ctx.payments.getById(params.paymentId);
    if (!payment || !payment.providerOrderId) {
      return reply.status(404).send({ error: { code: "PAYMENT_NOT_FOUND", message: "Payment not found" } });
    }
    const { MockPaymentProvider } = await import("../modules/payments/mock.provider.js");
    if (!(ctx.provider instanceof MockPaymentProvider)) {
      return reply.status(409).send({ error: { code: "CONFLICT", message: "Simulator requires the mock provider" } });
    }
    const simulated = ctx.provider.simulatePayment(payment.providerOrderId);
    await ctx.payments.markCaptured({
      providerOrderId: payment.providerOrderId,
      providerPaymentId: simulated.id,
    });
    return reply.send({ success: true, providerPaymentId: simulated.id });
  });
}
