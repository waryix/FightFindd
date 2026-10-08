import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";

export function registerWebhookRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post("/api/v1/webhooks/razorpay", async (request, reply) => {
    const rawBody = request.rawBody ?? "";
    const signature = request.headers["x-razorpay-signature"];
    const eventId = request.headers["x-razorpay-event-id"];
    const result = await ctx.webhooks.processRazorpayWebhook({
      rawBody,
      signature: Array.isArray(signature) ? signature[0] : signature,
      eventId: Array.isArray(eventId) ? eventId[0] : eventId,
    });
    return reply.send(result);
  });
}
