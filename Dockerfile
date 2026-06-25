FROM node:22-alpine

ARG CACHEBUST=2

RUN npm install -g pnpm@9.0.0

WORKDIR /app

COPY . .

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter api build

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
