FROM oven/bun:1
WORKDIR /app

# 1. Copy the app's package.json
COPY apps/api/package.json ./

# 2. Copy the ROOT lockfile (since context is root)
COPY bun.lock ./

# 3. Install
RUN bun install --frozen-lockfile --production

COPY apps/api/ .
CMD ["bun", "run", "src/index.ts"]