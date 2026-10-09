import { loadEnv } from "./env.js";
import { createDatabase } from "./db/client.js";
import { createContext } from "./context.js";
import { buildApp } from "./app.js";

async function main() {
  const env = loadEnv();
  const database = createDatabase(env.DATABASE_URL, { max: env.DATABASE_POOL_MAX });
  const ctx = await createContext({ db: database.db, env });
  const app = await buildApp({ ctx });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down…`);
    ctx.chatHub.closeAll();
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`FightFind API listening on ${env.API_PUBLIC_URL} (${env.NODE_ENV})`);
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
