import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { parse } from "../lib/validate.js";
import { userIdOf } from "../lib/request.js";
import { adminListQuerySchema, adminVerifyGymSchema } from "@fightfind/types";

export function registerAdminRoutes(app: FastifyInstance, ctx: AppContext) {
  const guard = { preHandler: ctx.guards.requireRole("ADMIN") };

  app.get("/api/v1/admin/gyms", guard, async (request, reply) => {
    const query = parse(adminListQuerySchema, request.query);
    const page = await ctx.admin.listGyms(query);
    return reply.send(page);
  });

  app.post("/api/v1/admin/gyms/:id/verification", guard, async (request, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), request.params);
    const input = parse(adminVerifyGymSchema, request.body);
    const gym = await ctx.admin.verifyGym(userIdOf(request), params.id, input);
    return reply.send({ gym });
  });

  app.get("/api/v1/admin/users", guard, async (request, reply) => {
    const query = parse(adminListQuerySchema, request.query);
    const page = await ctx.admin.listUsers(query);
    return reply.send(page);
  });

  app.get("/api/v1/admin/payments", guard, async (request, reply) => {
    const query = parse(adminListQuerySchema, request.query);
    const page = await ctx.admin.listPayments(query);
    return reply.send(page);
  });

  app.get("/api/v1/admin/payments/failed", guard, async (request, reply) => {
    const query = parse(adminListQuerySchema, request.query);
    const page = await ctx.admin.listPayments({ ...query, failedOnly: true });
    return reply.send(page);
  });

  app.get("/api/v1/admin/memberships", guard, async (request, reply) => {
    const query = parse(
      adminListQuerySchema.extend({ gymId: z.string().uuid().optional() }),
      request.query,
    );
    const page = await ctx.admin.listMemberships(query);
    return reply.send(page);
  });

  app.get("/api/v1/admin/audit-logs", guard, async (request, reply) => {
    const query = parse(adminListQuerySchema, request.query);
    const page = await ctx.admin.listAuditLogs(query);
    return reply.send(page);
  });

  app.post("/api/v1/admin/maintenance/run", guard, async (_request, reply) => {
    const result = await ctx.admin.runMaintenance();
    return reply.send(result);
  });
}
