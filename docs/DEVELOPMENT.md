# 🛠 Cherrytracer Development Guide

## ⚡️ Quick Start (The Happy Path)

1. **Install Dependencies:**
   ```bash
   bun install
   ```

2. **Start Infrastructure (Postgres):**
   ```bash
   docker-compose up -d
   # when finished developing:
   # docker-compose down -v
   ```

3. **Push Database Schema:**
   ```bash
   # From root
   bun run db:push
   bun run seed
   ```

4. **Start the Stack:**
   ```bash
   bun dev
   ```
   *   **API:** http://localhost:3000
   *   **Dashboard:** http://localhost:3001 (or whatever Nuxt assigns)
   *   **DB Studio:** https://local.drizzle.studio (runs on command)

---

## 🐘 Database Management

We use **Docker** for the database and **Drizzle ORM** for schema management.

### 1. Starting the Database
The `docker-compose.yml` at the root sets up a Postgres 16 instance.
```bash
docker-compose up -d
```

### 2. Applying Schema Changes
We use `db:push` for rapid local development (it syncs the DB state to match your TS schema without creating migration files).

```bash
# Run from root (if scripts configured) or inside apps/api
cd apps/api
bun run db:push
```

### 3. Viewing Data (Drizzle Studio)
Open a GUI to browse/edit your local data:
```bash
cd apps/api
bun run db:studio
```