import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { users } from "./db/schema.js";
import type { AppContext } from "./context.js";
import { isAppError } from "./lib/errors.js";
import { verifyAccessToken } from "./modules/auth/tokens.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerUsersRoutes } from "./routes/users.routes.js";
import { registerFightersRoutes } from "./routes/fighters.routes.js";
import { registerGymsRoutes } from "./routes/gyms.routes.js";
import { registerSparringRoutes, registerMatchesRoutes } from "./routes/sparring.routes.js";
import { registerMessagesRoutes } from "./routes/messages.routes.js";
import { registerPaymentsRoutes } from "./routes/payments.routes.js";
import { registerSubscriptionsRoutes } from "./routes/subscriptions.routes.js";
import { registerGymOwnerRoutes } from "./routes/gym-owner.routes.js";
import { registerAdminRoutes } from "./routes/admin.routes.js";
import {
  registerAnalyticsRoutes,
  registerConfigRoutes,
  registerNotificationsRoutes,
} from "./routes/notifications.routes.js";
import { registerWebhookRoutes } from "./routes/webhooks.routes.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface BuildAppOptions {
  ctx: AppContext;
  logger?: boolean | Record<string, unknown>;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { ctx } = options;
  const isTest = ctx.env.NODE_ENV === "test";

  const app = Fastify({
    logger:
      options.logger ??
      (isTest
        ? false
        : {
            level: ctx.env.LOG_LEVEL,
            transport:
              ctx.env.NODE_ENV === "development"
                ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
                : undefined,
          }),
    trustProxy: true,
    bodyLimit: 1024 * 1024,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(cors, {
    origin: ctx.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (request) => request.auth?.userId ?? request.ip,
  });
  await app.register(multipart, {
    limits: { fileSize: 6 * 1024 * 1024, files: 1, fields: 10 },
  });
  await app.register(websocket);

  // Keep the raw body around for webhook signature verification.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      request.rawBody = body as string;
      try {
        done(null, JSON.parse(body as string));
      } catch (error) {
        done(error as Error, undefined);
      }
    },
  );

  app.decorateRequest("auth", null);

  if (ctx.env.STORAGE_DRIVER === "local") {
    const uploadsDir = path.resolve(ctx.env.STORAGE_LOCAL_DIR);
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
    await app.register(fastifyStatic, {
      root: uploadsDir,
      prefix: "/uploads/",
      decorateReply: false,
    });
  }

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        userId: request.auth?.userId,
        method: request.method,
        route: request.url,
        status: reply.statusCode,
        latencyMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      request.log.warn(
        { requestId: request.id, code: error.code, status: error.statusCode },
        error.message,
      );
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: request.id,
        },
      });
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({
        error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly.", requestId: request.id },
      });
    }

    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({
        error: { code: "VALIDATION_ERROR", message: "File is too large (max 6 MB).", requestId: request.id },
      });
    }

    request.log.error({ requestId: request.id, err: error }, "unhandled error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong on our side.",
        requestId: request.id,
      },
    });
  });

  app.get("/", async () => ({
    name: "FightFind API",
    version: "2.0.0",
    status: "running",
  }));

  // OpenAPI documentation (hand-maintained, served with Swagger UI).
  app.get("/docs/openapi.yaml", async (_request, reply) => {
    const { readFile } = await import("node:fs/promises");
    const candidates = [
      path.resolve(process.cwd(), "docs/openapi.yaml"),
      path.resolve(process.cwd(), "../../../docs/openapi.yaml"),
    ];
    for (const candidate of candidates) {
      try {
        const content = await readFile(candidate, "utf8");
        return reply.type("application/yaml; charset=utf-8").send(content);
      } catch {
        // try next candidate
      }
    }
    return reply.status(404).send({ error: { code: "NOT_FOUND", message: "OpenAPI spec not found" } });
  });

  app.get("/docs", async (_request, reply) => {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FightFind API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body { margin: 0; background: #0a0a0a; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/docs/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
    });
  </script>
</body>
</html>`;
    return reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/health", async () => {
    return { status: "ok", service: "fightfind-api" };
  });

  app.get("/health/ready", async (_request, reply) => {
    try {
      await ctx.db.execute(sql`select 1`);
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "unavailable" });
    }
  });

  registerAuthRoutes(app, ctx);
  registerUsersRoutes(app, ctx);
  registerFightersRoutes(app, ctx);
  registerGymsRoutes(app, ctx);
  registerSparringRoutes(app, ctx);
  registerMatchesRoutes(app, ctx);
  registerMessagesRoutes(app, ctx);
  registerPaymentsRoutes(app, ctx);
  registerSubscriptionsRoutes(app, ctx);
  registerGymOwnerRoutes(app, ctx);
  registerAdminRoutes(app, ctx);
  registerNotificationsRoutes(app, ctx);
  registerConfigRoutes(app, ctx);
  registerAnalyticsRoutes(app, ctx);
  registerWebhookRoutes(app, ctx);

  // Realtime chat (authenticated WebSocket). REST endpoints remain the fallback.
  app.get("/api/v1/ws", { websocket: true }, (socket, request) => {
    void (async () => {
      const url = new URL(request.url, "http://localhost");
      const queryToken = url.searchParams.get("token") ?? undefined;
      const headerToken = request.headers.authorization?.startsWith("Bearer ")
        ? request.headers.authorization.slice("Bearer ".length)
        : undefined;
      const token = queryToken ?? headerToken;
      const payload = token ? await verifyAccessToken(token) : null;
      if (!payload || !(await ctx.auth.sessions.isSessionActive(payload.sid))) {
        socket.close(4401, "unauthorized");
        return;
      }
      const [user] = await ctx.db
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!user || user.status !== "active") {
        socket.close(4401, "unauthorized");
        return;
      }
      ctx.chatHub.connect(socket, payload.sub);
    })();
  });

  return app;
}
