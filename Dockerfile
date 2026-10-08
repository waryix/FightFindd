# FightFind API production image (monorepo-aware).
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fightfind/types build \
 && pnpm --filter @fightfind/config build \
 && pnpm --filter @fightfind/utils build \
 && pnpm --filter @fightfind/api build

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4001
# Migrations are idempotent and safe to run on every boot.
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/index.js"]
