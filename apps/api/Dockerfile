FROM oven/bun:1
WORKDIR /app
COPY apps/api/package.json apps/api/bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY apps/api/ .
CMD ["bun", "run", "src/index.ts"]