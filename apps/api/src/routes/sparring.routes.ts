import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import {
  createSparringRequestSchema,
  updateSparringRequestStatusSchema,
} from "@fightfind/types";

const matchListQuery = z.object({
  tab: z.enum(["received", "sent"]).default("received"),
  status: z.enum(["pending", "accepted", "declined", "completed", "cancelled"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function registerSparringRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post(
    "/api/v1/sparring",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const input = parse(createSparringRequestSchema, request.body);
      const match = await ctx.sparring.createRequest(userIdOf(request), input);
      await ctx.analytics.track("sparring_request_created", {
        userId: userIdOf(request),
        properties: { matchId: match.id, discipline: match.discipline },
      });
      return reply.status(201).send({ match });
    },
  );
}

export function registerMatchesRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get("/api/v1/matches", { preHandler: ctx.guards.requireFighter }, async (request, reply) => {
    const query = parse(matchListQuery, request.query);
    const page = await ctx.sparring.list(userIdOf(request), query);
    return reply.send(page);
  });

  app.get("/api/v1/matches/:id", { preHandler: ctx.guards.requireFighter }, async (request, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const match = await ctx.sparring.getForParticipant(params.id, userIdOf(request));
    return reply.send({ match });
  });

  app.patch(
    "/api/v1/matches/:id/status",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(z.object({ id: z.string().uuid() }), request.params);
      const input = parse(updateSparringRequestStatusSchema, request.body);
      const match = await ctx.sparring.updateStatus(params.id, userIdOf(request), input.status);
      if (input.status === "accepted") {
        await ctx.analytics.track("sparring_request_accepted", {
          userId: userIdOf(request),
          properties: { matchId: params.id },
        });
      }
      return reply.send({ match });
    },
  );
}
