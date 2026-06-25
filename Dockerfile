FROM node:20-alpine

RUN npm install -g pnpm@9.0.0

WORKDIR /app

# Copy everything except what's in .dockerignore
COPY . .

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build the API
RUN pnpm --filter api build

EXPOSE 4000

CMD ["node", "apps/api/dist/index.js"]
