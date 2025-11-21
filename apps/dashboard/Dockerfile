# 1. Base setup - Pin to the BUILD platform (Native/Fast)
FROM --platform=$BUILDPLATFORM oven/bun:1 AS base
WORKDIR /app

# 2. Prune Stage - Run on Native/Fast CPU
FROM --platform=$BUILDPLATFORM base AS prune
WORKDIR /app
COPY . .
RUN bun add -g turbo
RUN turbo prune dashboard --docker

# 3. Build Stage - Run on Native/Fast CPU
FROM --platform=$BUILDPLATFORM base AS builder
WORKDIR /app

# Copy json files
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/bun.lock ./bun.lock

# Install deps (FAST now, because no QEMU emulation)
RUN bun install

# Copy source and build
COPY --from=prune /app/out/full/ .

# Build (FAST now, because no QEMU emulation)
RUN bun run build

# 4. Runner Stage - This is the ONLY stage that uses the Target Platform (e.g., ARM64)
FROM oven/bun:1 AS runner
WORKDIR /app

# Copy the built output from Nuxt
# Nuxt output is standard JS, so it runs fine on ARM even if built on AMD
COPY --from=builder /app/apps/dashboard/.output ./.output

ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["bun", ".output/server/index.mjs"]