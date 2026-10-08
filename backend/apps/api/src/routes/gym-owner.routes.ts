import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { createGymSchema, updateGymSchema, membershipStatusSchema } from "@fightfind/types";
import { badRequest } from "../lib/errors.js";

const gymIdParam = z.object({ gymId: z.string().uuid() });
const membershipIdParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  status: z.string().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function registerGymOwnerRoutes(app: FastifyInstance, ctx: AppContext) {
  const guard = { preHandler: ctx.guards.requireGymOwner };

  app.get("/api/v1/gym-owner/onboarding", guard, async (request, reply) => {
    const onboarding = await ctx.gymOwner.onboardingState(userIdOf(request));
    return reply.send({ onboarding });
  });

  app.post("/api/v1/gym-owner/gyms", guard, async (request, reply) => {
    const input = parse(createGymSchema, request.body);
    const gym = await ctx.gymOwner.createGym(userIdOf(request), input);
    await ctx.analytics.track("gym_owner_signup", {
      userId: userIdOf(request),
      properties: { gymId: gym.id, city: gym.city },
    });
    return reply.status(201).send({ gym });
  });

  app.get("/api/v1/gym-owner/gyms", guard, async (request, reply) => {
    const gyms = await ctx.gymOwner.listGyms(userIdOf(request));
    return reply.send({ gyms });
  });

  app.get("/api/v1/gym-owner/gyms/:gymId", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const gym = await ctx.gymOwner.getGymDetail(userIdOf(request), params.gymId);
    return reply.send({ gym });
  });

  app.patch("/api/v1/gym-owner/gyms/:gymId", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const input = parse(updateGymSchema, request.body);
    const gym = await ctx.gymOwner.updateGym(userIdOf(request), params.gymId, input);
    return reply.send({ gym });
  });

  app.post("/api/v1/gym-owner/gyms/:gymId/photos", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const file = await request.file();
    if (!file) throw badRequest("VALIDATION_ERROR", "No image uploaded.");
    if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.mimetype)) {
      throw badRequest("VALIDATION_ERROR", "Upload a JPEG, PNG or WebP image.");
    }
    const buffer = await file.toBuffer();
    if (buffer.byteLength > 6 * 1024 * 1024) {
      throw badRequest("VALIDATION_ERROR", "Image must be smaller than 6 MB.");
    }
    await ctx.gymOwner.getGymDetail(userIdOf(request), params.gymId);
    const stored = await ctx.storage.save({
      buffer,
      filename: file.filename,
      contentType: file.mimetype,
      prefix: `gyms/${params.gymId}`,
    });
    const photoUrls = await ctx.gymOwner.addPhoto(userIdOf(request), params.gymId, stored.url);
    return reply.status(201).send({ photoUrl: stored.url, photoUrls });
  });

  app.post("/api/v1/gym-owner/gyms/:gymId/razorpay-account", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const result = await ctx.gymOwner.startRazorpayOnboarding(userIdOf(request), params.gymId);
    return reply.send(result);
  });

  app.get("/api/v1/gym-owner/gyms/:gymId/razorpay-account", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const result = await ctx.gymOwner.refreshRazorpayStatus(userIdOf(request), params.gymId);
    return reply.send(result);
  });

  app.post("/api/v1/gym-owner/gyms/:gymId/listing-fee/order", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const order = await ctx.gymOwner.createListingFeeOrder(userIdOf(request), params.gymId);
    await ctx.analytics.track("gym_listing_paid", {
      userId: userIdOf(request),
      properties: { gymId: params.gymId, orderId: order.razorpayOrderId },
    });
    return reply.status(201).send(order);
  });

  app.get("/api/v1/gym-owner/gyms/:gymId/dashboard", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const dashboard = await ctx.gymOwner.dashboard(userIdOf(request), params.gymId);
    return reply.send({ dashboard });
  });

  app.get("/api/v1/gym-owner/gyms/:gymId/requests", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const query = parse(listQuery, request.query);
    const page = await ctx.gymOwner.listRequests(userIdOf(request), params.gymId, query);
    return reply.send(page);
  });

  app.get("/api/v1/gym-owner/gyms/:gymId/members", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const query = parse(
      listQuery.extend({ status: membershipStatusSchema.optional() }),
      request.query,
    );
    const page = await ctx.gymOwner.listMembers(userIdOf(request), params.gymId, query);
    return reply.send(page);
  });

  app.get("/api/v1/gym-owner/gyms/:gymId/payments", guard, async (request, reply) => {
    const params = parse(gymIdParam, request.params);
    const query = parse(listQuery, request.query);
    const page = await ctx.gymOwner.listPayments(userIdOf(request), params.gymId, query);
    return reply.send(page);
  });

  app.post("/api/v1/gym-owner/memberships/:id/accept", guard, async (request, reply) => {
    const params = parse(membershipIdParam, request.params);
    const membership = await ctx.memberships.accept(params.id, userIdOf(request));
    await ctx.analytics.track("gym_membership_request_accepted", {
      userId: userIdOf(request),
      properties: { membershipId: params.id },
    });
    return reply.send({ membership });
  });

  app.post("/api/v1/gym-owner/memberships/:id/decline", guard, async (request, reply) => {
    const params = parse(membershipIdParam, request.params);
    const membership = await ctx.memberships.decline(params.id, userIdOf(request));
    return reply.send({ membership });
  });

  app.get("/api/v1/gym-owner/notifications", guard, async (request, reply) => {
    const query = parse(listQuery, request.query);
    const page = await ctx.gymOwner.notificationList(userIdOf(request), query);
    return reply.send(page);
  });
}
