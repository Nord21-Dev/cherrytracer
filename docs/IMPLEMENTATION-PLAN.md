# 🚀 Cheerytracer Implementation Plan
**Goal:** Build a high-performance, low-overhead observability platform for indie developers.
**Core Philosophy:** "Fire and Forget" ingestion, zero-dependency client, and a beautiful Vercel-like dashboard.

---

## 🛠 Phase 0: The Monorepo Foundation
**Objective:** Set up the Turborepo structure with shared configs and a local development environment.

1.  **Scaffold Structure:**
    *   Initialize Turborepo with `bun`.
    *   Create `docker-compose.yml` strictly for local infrastructure (Postgres).
2.  **Shared Configs:**
    *   `tsconfig.json`: Strict mode enabled.
    *   `eslint`: Standard linting across API and UI.
    *   **Shared Types Package (`packages/types`):** Create a shared interface for `LogEntry`, `TraceSpan`, and `IngestPayload` so the API, SDK, and Dashboard speak the exact same language.

**Deliverable:** A running repo where `bun turbo dev` starts a "Hello World" Elysia server and a blank Nuxt app.

---

## ⚙️ Phase 1: The Core API & Ingestion Engine (The Backend)
**Objective:** Build the ElysiaJS backend capable of handling high-throughput writes without blocking.

### 1.1 Database Schema (Drizzle + Postgres)
We need a schema optimized for heavy reads and specific filtering.
*   **Table:** `logs`
    *   `id`: UUID (or ULID for sortable IDs).
    *   `project_id`: String (Foreign Key to Projects).
    *   `trace_id`: String (Indexed).
    *   `level`: Enum ('info', 'warn', 'error', 'debug').
    *   `message`: Text.
    *   `data`: JSONB (Stores headers, user context, request body). **GIN Index this.**
    *   `timestamp`: BigInt or Timestamp (Indexed).
*   **Table:** `projects` (Simple API Key management).

### 1.2 The Ingestion Buffer (Crucial)
Implementation of the "Smart Batching" to save the DB.
*   **Endpoint:** `POST /ingest`
    *   **Action:** Validate API Key → Push payload to global Array → Return `200 OK` immediately.
*   **The Worker (Cron/Interval):**
    *   Runs every 2 seconds OR when array length > 1000.
    *   Takes a snapshot of the array.
    *   Performs a single `db.insert(logs).values(batch)` transaction.
    *   *Bonus:* If DB fails, retry once, then drop (fail-safe).

### 1.3 Query Endpoints
*   `GET /api/logs`: Accepts `limit`, `offset`, `project_id`, and filters.
    *   Implementation: Use Drizzle query builder. If filtering by JSON data (e.g., `user_id`), use SQL operators `data->>'user_id'`.
*   `GET /api/stats`: Returns histogram data for the "Activity Graph" (log counts per hour).

**Deliverable:** Use `k6` to load test the `/ingest` endpoint. It should handle 1,000 req/sec without crashing the DB.

---

## 📦 Phase 2: The Universal SDK (`cheerytracer-client`)
**Objective:** A tiny (<2KB) library that works in Node, Bun, and the Browser.

### 2.1 Interface Design
The SDK should feel like `console.log` but better.

```typescript
const logger = new CheeryTracer({ apiKey: "...", projectId: "..." });

// Standard Log
logger.info("User signed up", { userId: 123, plan: "pro" });

// Trace/Span
const span = logger.startSpan("process-payment");
try {
   await paymentProvider.charge();
   span.end({ success: true }); // Calculates duration automatically
} catch (e) {
   span.end({ error: e.message });
}
```

### 2.2 Internal Logic
1.  **Auto-Context:**
    *   **Node/Bun:** Capture `process.env.NODE_ENV`, `os.hostname()`.
    *   **Browser:** Capture `navigator.userAgent`, `window.location`.
2.  **Buffering:**
    *   Do not fire an HTTP request on every log.
    *   Push to internal array.
    *   Flush every 500ms or when the page unloads (`beacon` API).
3.  **Safety:** Wrap all `fetch` calls in `try/catch`. Never let the logger crash the user's app.

**Deliverable:** An npm package published internally that can be imported into the implementation test app.

---

## 🖥 Phase 3: The Dashboard (Nuxt 4 + NuxtUI v4.2)
**Objective:** A "Vercel-like" aesthetic. Dark mode default. Dense information density.

### 3.1 Layout & Navigation
*   **Sidebar:** Projects selector, Logs, Traces, Settings.
*   **Top Bar:** Status indicator (connected to WS), Search bar.

### 3.2 The Log Explorer (The "Money" Page)
*   **Component:** `LogTable.vue`
*   **Features:**
    *   **Infinite Scroll:** Load more rows as user scrolls down.
    *   **JSON Viewer:** Clicking a row expands a drawer showing the `data` JSON prettified with syntax highlighting (use `vue-json-pretty` or similar).
    *   **Quick Filters:** Clicking a badge (e.g., `ERROR`) adds it to the active filter list.

### 3.3 The Trace View
*   **View:** A table of Traces (grouped by `trace_id`).
*   **Visualization:** A "Gantt Chart" or "Waterfall" bar using CSS Grid or a tiny charting lib (like `unovis` or just simple HTML `div` widths).
    *   Show `start_time` vs `duration`.

**Deliverable:** A functional UI where you can see logs flowing in.

---

## 🔔 Phase 4: Realtime & Alerting (The "Delighters")
**Objective:** Make it feel alive and useful when idle.

1.  **WebSocket (Elysia + VueUse):**
    *   **Backend:** When the `Ingest Worker` flushes to DB, also broadcast the *newest 10 lines* to connected WS clients for that `project_id`.
    *   **Frontend:** Use `useWebSocket`. When a message arrives, unshift it to the top of the Log Table array (with a cool "fade in" animation).
2.  **Discord Webhooks:**
    *   **DB:** Add `webhook_url` to `projects` table.
    *   **Logic:** inside the `Ingest Worker`, count how many `level === 'error'` logs are in the batch.
    *   **Trigger:** If `errorCount > threshold`, send a POST to the user's Discord webhook.

---

## 🚀 Phase 5: Deployment & Polish
**Objective:** Production readiness.

1.  **Dockerization:**
    *   Multi-stage Dockerfile for the API (Bun is native, so image is tiny).
    *   Build output for Nuxt (Output: server).
2.  **Security Hardening:**
    *   Rate limiting on the `/ingest` endpoint (using Elysia rate-limit plugin) to prevent abuse.
    *   CORS configuration.
3.  **Documentation:**
    *   A simple README is not enough. Create a `/docs` folder (Nuxt Content) explaining "How to integrate with Next.js", "How to integrate with Python", etc.

---

## Definition of Success (KPIs)

1.  **Latency:** The `/ingest` endpoint responds in < 50ms (P99).
2.  **Size:** The Client SDK is < 3kb gzipped.
3.  **Scale:** Can ingest 1 million logs/day on a $5 VPS (Standard Indie load).
4.  **UX:** A user can go from "Sign Up" to "Seeing their first log" in under 2 minutes.

## Team Tasks Assignment

*   **Backend Engineer:** Phase 1 (DB Schema, Ingest Queue) + Phase 4 (WebSockets).
*   **Frontend Engineer:** Phase 3 (Nuxt Dashboard, NuxtUI components) + Phase 4 (WS Integration).
*   **Full Stack / Lead:** Phase 0 (Repo setup), Phase 2 (SDK logic), and DevOps.

This plan moves you from "Idea" to "SaaS Product" while maintaining the *Cheerytracer* philosophy: Fast, Simple, Indie.