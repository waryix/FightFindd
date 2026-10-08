import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { normalizeQuery } from "../lib/query.js";
import { userIdOf } from "../lib/request.js";
import { gymDiscoveryQuerySchema } from "@fightfind/types";

const idParam = z.object({ gymId: z.string().uuid() });
const coordsQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export function registerGymsRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/v1/gyms", { preHandler: ctx.guards.authenticate }, async (request, reply) => {
    const query = parse(gymDiscoveryQuerySchema, normalizeQuery(request.query));
    const page = await ctx.gyms.discover(query);
    if (request.auth?.userId) {
      await ctx.analytics.track("gym_search", {
        userId: request.auth.userId,
        properties: {
          hasLocation: query.lat !== undefined,
          radiusKm: query.radiusKm ?? null,
          discipline: query.discipline ?? null,
          sort: query.sort,
          results: page.items.length,
        },
      });
    }
    return reply.send(page);
  });

  app.get("/api/v1/gyms/:id", { preHandler: ctx.guards.authenticate }, async (request, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const query = parse(coordsQuery, request.query);
    const gym = await ctx.gyms.getPublicGym(params.id, { lat: query.lat, lng: query.lng });
    await ctx.analytics.track("gym_viewed", {
      userId: request.auth?.userId ?? null,
      properties: { gymId: params.id },
    });
    return reply.send({ gym });
  });

  app.get(
    "/api/v1/gyms/:gymId/membership",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(idParam, request.params);
      const membership = await ctx.memberships.getForFighterAndGym(params.gymId, userIdOf(request));
      return reply.send({
        membership: membership
          ? {
              id: membership.id,
              gymId: membership.gymId,
              gymName: "",
              gymCity: "",
              fighterUserId: membership.fighterUserId,
              amountPaise: membership.amountPaise,
              currency: membership.currency,
              status: membership.status,
              startedAt: membership.startedAt?.toISOString() ?? null,
              expiresAt: membership.expiresAt?.toISOString() ?? null,
              createdAt: membership.createdAt.toISOString(),
            }
          : null,
      });
    },
  );

  app.post(
    "/api/v1/gyms/:gymId/membership/order",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(idParam, request.params);
      const order = await ctx.orders.createOrder({
        userId: userIdOf(request),
        product: "GYM_MEMBERSHIP",
        gymId: params.gymId,
      });
      await ctx.analytics.track("gym_join_started", {
        userId: userIdOf(request),
        properties: { gymId: params.gymId, amountPaise: order.amountPaise },
      });
      return reply.status(201).send(order);
    },
  );
}
