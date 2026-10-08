import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { messageHistoryQuerySchema, sendMessageSchema } from "@fightfind/types";

const matchParam = z.object({ matchId: z.string().uuid() });

export function registerMessagesRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get(
    "/api/v1/messages/:matchId",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(matchParam, request.params);
      const query = parse(messageHistoryQuerySchema, request.query);
      const page = await ctx.messages.history(params.matchId, userIdOf(request), query);
      return reply.send(page);
    },
  );

  app.post(
    "/api/v1/messages/:matchId",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(matchParam, request.params);
      const input = parse(sendMessageSchema, request.body);
      const message = await ctx.messages.send(params.matchId, userIdOf(request), input.content);
      ctx.chatHub.broadcast(params.matchId, { type: "message", message });
      return reply.status(201).send({ message });
    },
  );

  app.post(
    "/api/v1/messages/:matchId/read",
    { preHandler: ctx.guards.requireFighter },
    async (request, reply) => {
      const params = parse(matchParam, request.params);
      const updated = await ctx.messages.markRead(params.matchId, userIdOf(request));
      ctx.chatHub.broadcast(params.matchId, {
        type: "read",
        matchId: params.matchId,
        readerId: userIdOf(request),
        at: new Date().toISOString(),
      });
      return reply.send({ success: true, updated });
    },
  );
}
