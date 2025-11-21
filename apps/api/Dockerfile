# 1. Base setup
FROM oven/bun:1 AS base
WORKDIR /app

# 2. Prune Stage: Isolate the API and its dependencies
FROM base AS prune
WORKDIR /app
COPY . .
# Install turbo globaly to run the prune command
RUN bun add -g turbo
RUN turbo prune api --docker

# 3. Install Stage: Install dependencies on the pruned lockfile
FROM base AS builder
WORKDIR /app

# Copy the pruned "json" files (package.json, lockfile)
COPY --from=prune /app/out/json/ .
COPY --from=prune /app/out/bun.lock ./bun.lock

# Install dependencies (This now works because the lockfile matches perfectly)
RUN bun install

# Copy the source code
COPY --from=prune /app/out/full/ .

# 4. Runner Stage: The final image
FROM base AS runner
WORKDIR /app

# Copy everything from builder (node_modules + source)
COPY --from=builder /app .

# We run from the root context because the folder structure is preserved
CMD ["bun", "run", "--cwd", "apps/api", "start"]