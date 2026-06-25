FROM node:20-alpine

RUN npm install -g pnpm@9.0.0

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY apps/api/package.json ./apps/api/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/eslint-config/ ./packages/eslint-config/

RUN pnpm install --no-frozen-lockfile

COPY packages/types/ ./packages/types/
COPY packages/utils/ ./packages/utils/
COPY apps/api/ ./apps/api/

RUN pnpm --filter api build

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
