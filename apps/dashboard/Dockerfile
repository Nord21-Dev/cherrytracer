# 1. Base setup - Bun (builder only)
FROM --platform=$BUILDPLATFORM oven/bun:1 AS base
WORKDIR /app

# 2. Prune Stage
FROM --platform=$BUILDPLATFORM base AS prune
WORKDIR /app
COPY . .
RUN bun add -g turbo
RUN turbo prune dashboard --docker

# 3. Build Stage
FROM --platform=$BUILDPLATFORM base AS builder
WORKDIR /app

# Ensure production build
ENV NODE_ENV=production

# Copy json and lockfile
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/bun.lock ./bun.lock

# Install deps
RUN bun install

# Copy source and build
COPY --from=prune /app/out/full/ .
RUN bun run build

# 4. Runner Stage – Node.js on the target platform
FROM node:23-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy the built Nuxt output
COPY --from=builder /app/apps/dashboard/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]