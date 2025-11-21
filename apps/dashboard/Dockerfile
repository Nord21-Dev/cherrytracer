FROM oven/bun:1 AS builder
WORKDIR /app

# 1. Copy dashboard package.json
COPY apps/dashboard/package.json ./

# 2. Copy ROOT lockfile
COPY bun.lockb ./

RUN bun install --frozen-lockfile
COPY apps/dashboard/ .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/.output ./.output
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["bun", ".output/server/index.mjs"]