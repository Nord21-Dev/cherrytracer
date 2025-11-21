# 1. Base setup
FROM oven/bun:1 AS base
WORKDIR /app

# 2. Prune Stage
FROM base AS prune
WORKDIR /app
COPY . .
RUN bun add -g turbo
RUN turbo prune dashboard --docker

# 3. Build Stage
FROM base AS builder
WORKDIR /app

# Copy json files
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/bun.lock ./bun.lock

# Install deps
RUN bun install

# Copy source and build
COPY --from=prune /app/out/full/ .
RUN bun run build

# 4. Runner Stage
FROM oven/bun:1
WORKDIR /app

# Copy the built output from Nuxt
COPY --from=builder /app/apps/dashboard/.output ./.output

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["bun", ".output/server/index.mjs"]