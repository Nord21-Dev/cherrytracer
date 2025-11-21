FROM oven/bun:1 AS builder
WORKDIR /app
COPY apps/dashboard/package.json apps/dashboard/bun.lockb ./
RUN bun install --frozen-lockfile
COPY apps/dashboard/ .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=builder /app/.output ./.output
ENV PORT=3000
ENV HOST=0.0.0.0
# Nuxt 4 output run command
CMD ["bun", ".output/server/index.mjs"]