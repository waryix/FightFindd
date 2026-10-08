import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse, parseOptional } from "../lib/validate.js";
import { normalizeQuery } from "../lib/query.js";
import { userIdOf } from "../lib/request.js";
import { badRequest, forbidden } from "../lib/errors.js";
import {
  createFighterProfileSchema,
  discoveryQuerySchema,
  updateFighterProfileSchema,
} from "@fightfind/types";

const idParam = z.object({ id: z.string().uuid() });
const coordsQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
const blockSchema = z.object({ userId: z.string().uuid(), reason: z.string().max(300).optional() });
const reportSchema = z.object({
  userId: z.string().uuid(),
  reason: z.enum(["spam", "harassment", "fake_profile", "inappropriate_content", "other"]),
  details: z.string().max(1000).optional(),
});

export function registerFightersRoutes(app: FastifyInstance, ctx: AppContext) {
  const ADVANCED_FILTER_KEYS = [
    "minHeight",
    "maxHeight",
    "minWeight",
    "maxWeight",
    "minExperience",
    "maxExperience",
    "minFights",
    "maxFights",
  ] as const;

  app.get(
    "/api/v1/fighters",
    { preHandler: ctx.guards.authenticate },
    async (request, reply) => {
      const query = parse(discoveryQuerySchema, normalizeQuery(request.query));
      const viewerId = request.auth?.userId ?? null;
      const usesAdvancedFilters = ADVANCED_FILTER_KEYS.some((key) => query[key] !== undefined);
      if (usesAdvancedFilters) {
        if (!viewerId || request.auth?.isGuest) {
          throw forbidden(
            "ADVANCED_FILTERS_REQUIRE_PREMIUM",
            "Create an account and upgrade to FightFind Pro to use advanced filters.",
          );
        }
        const entitlements = await ctx.entitlements.getForUser(viewerId);
        if (!entitlements.canUseAdvancedFilters) {
          throw forbidden(
            "ADVANCED_FILTERS_REQUIRE_PREMIUM",
            "Advanced filters are part of FightFind Pro.",
          );
        }
      }
      const page = await ctx.fighters.discover(viewerId, query);
      await ctx.analytics.track("fighter_search", {
        userId: viewerId,
        properties: {
          hasLocation: query.lat !== undefined,
          radiusKm: query.radiusKm ?? null,
          discipline: query.discipline ?? null,
          sort: query.sort,
          results: page.items.length,
        },
      });
      return reply.send(page);
    },
  );

  app.get(
    "/api/v1/fighters/me",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const fighter = await ctx.fighters.getMyProfile(userIdOf(request));
      return reply.send({ fighter });
    },
  );

  app.post(
    "/api/v1/fighters/me",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const input = parse(createFighterProfileSchema, request.body);
      const fighter = await ctx.fighters.createProfile(userIdOf(request), input);
      await ctx.analytics.track("fighter_profile_completed", {
        userId: userIdOf(request),
        properties: { city: input.city, skillLevel: input.skillLevel },
      });
      return reply.status(201).send({ fighter });
    },
  );

  app.patch(
    "/api/v1/fighters/me",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const input = parse(updateFighterProfileSchema, request.body);
      const fighter = await ctx.fighters.updateProfile(userIdOf(request), input);
      return reply.send({ fighter });
    },
  );

  app.post(
    "/api/v1/fighters/me/avatar",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const file = await request.file();
      if (!file) throw badRequest("VALIDATION_ERROR", "No image uploaded.");
      if (!["image/jpeg", "image/png", "image/webp", "image/heic"].includes(file.mimetype)) {
        throw badRequest("VALIDATION_ERROR", "Upload a JPEG, PNG or WebP image.");
      }
      const buffer = await file.toBuffer();
      if (buffer.byteLength > 6 * 1024 * 1024) {
        throw badRequest("VALIDATION_ERROR", "Image must be smaller than 6 MB.");
      }
      const stored = await ctx.storage.save({
        buffer,
        filename: file.filename,
        contentType: file.mimetype,
        prefix: "avatars",
      });
      await ctx.fighters.setAvatar(userIdOf(request), stored.url);
      return reply.send({ avatarUrl: stored.url });
    },
  );

  app.get(
    "/api/v1/fighters/me/memberships",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const items = await ctx.fighters.listMyMemberships(userIdOf(request));
      return reply.send({ items, nextCursor: null });
    },
  );

  app.post(
    "/api/v1/fighters/me/blocks",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const input = parse(blockSchema, request.body);
      await ctx.fighters.blockUser(userIdOf(request), input.userId, input.reason);
      return reply.send({ success: true });
    },
  );

  app.delete(
    "/api/v1/fighters/me/blocks/:userId",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(z.object({ userId: z.string().uuid() }), request.params);
      await ctx.fighters.unblockUser(userIdOf(request), params.userId);
      return reply.send({ success: true });
    },
  );

  app.post(
    "/api/v1/fighters/me/reports",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const input = parse(reportSchema, request.body);
      await ctx.fighters.reportUser(userIdOf(request), input.userId, input.reason, input.details);
      return reply.send({ success: true });
    },
  );

  app.get(
    "/api/v1/fighters/:id",
    { preHandler: ctx.guards.authenticate },
    async (request, reply) => {
      const params = parse(idParam, request.params);
      const query = parseOptional(coordsQuery, request.query) ?? {};
      const fighter = await ctx.fighters.getPublicProfile(params.id, {
        lat: query.lat,
        lng: query.lng,
      });
      await ctx.analytics.track("fighter_profile_viewed", {
        userId: request.auth?.userId ?? null,
        properties: { fighterId: params.id },
      });
      return reply.send({ fighter });
    },
  );
}
