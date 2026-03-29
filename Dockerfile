FROM oven/bun:1.3.11 AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY . .
RUN bun run build

FROM oven/bun:1.3.11 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["bun", "api/server.ts"]

FROM node:24-bookworm-slim AS permissions-runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

CMD ["node", "./node_modules/.bin/zero-deploy-permissions", "--help"]
