# 🍒 Cherrytracer

**The open-source observability platform for indie hackers who hate configuring Grafana.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

Cherrytracer is a lightweight, self-hosted alternative to Datadog and Loki. It is designed for **speed**, **simplicity**, and **sanity**.

If you have less than 5 million users and just want to know *"Why is my API 500-ing?"* without learning PromQL, this is for you.

![Dashboard Preview](screenshots/dashboard.png)

---

## ⚡️ Why Cherrytracer?

Current observability tools are either **too expensive** (Datadog, New Relic) or **too complex** (Prometheus, Grafana, Loki).

Cherrytracer is different:
*   **Zero-Config:** No complex query languages. SQL-driven metrics out of the box.
*   **Tiny Footprint:** The backend runs on Bun + Elysia. The frontend is Nuxt 4. It runs comfortably on a $5 VPS.
*   **Disk Safety:** Built-in "Safety Valve" auto-prunes logs if your disk fills up. It will never crash your server.
*   **Beautiful UI:** A Vercel-like dashboard that feels like a modern SaaS, not a spaceship control panel.

---

## 🚀 Quick Start (Self-Hosted)

You can spin this up in 60 seconds using Docker Compose.

### 1. Docker Compose
Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  proxy:
    image: 'nginx:alpine'
    restart: always
    ports:
      - "80:80"
    depends_on:
      - api
      - dashboard
    command: "/bin/sh -c \"echo ' events { worker_connections 1024; }  http { \n  server { \n    listen 80; \n    client_max_body_size 10M;\n\n    # --- API Routes ---\n    location /api/ { \n      proxy_pass http://api:3000; \n      proxy_set_header Host \\$$host;\n      proxy_set_header X-Real-IP \\$$remote_addr;\n      proxy_set_header X-Forwarded-For \\$$proxy_add_x_forwarded_for;\n    } \n\n    location /ingest { \n      proxy_pass http://api:3000; \n      proxy_set_header Host \\$$host;\n      proxy_set_header X-Real-IP \\$$remote_addr;\n    } \n\n    # --- OpenAPI Fix ---\n    # 1. Handle the double-path bug seen in your logs\n    location = /openapi/openapi/json {\n      rewrite ^/openapi/openapi/json$ /openapi/json break;\n      proxy_pass http://api:3000;\n      proxy_set_header Host \\$$host;\n    }\n\n    # 2. Handle standard OpenAPI requests\n    location /openapi { \n      proxy_pass http://api:3000; \n      proxy_set_header Host \\$$host;\n    } \n\n    # --- Websockets ---\n    location /ws { \n      proxy_pass http://api:3000; \n      proxy_http_version 1.1; \n      proxy_set_header Upgrade \\$$http_upgrade; \n      proxy_set_header Connection \\\"Upgrade\\\"; \n      proxy_set_header Host \\$$host; \n    } \n\n    # --- Dashboard (Frontend) ---\n    location / { \n      proxy_pass http://dashboard:3000; \n      proxy_set_header Host \\$$host;\n      proxy_set_header X-Real-IP \\$$remote_addr;\n      proxy_set_header X-Forwarded-For \\$$proxy_add_x_forwarded_for;\n    } \n  } \n}' > /etc/nginx/nginx.conf && nginx -g 'daemon off;'\""

  api:
    image: 'nord21dev/cherrytracer-api:latest'
    restart: always
    command: '/bin/sh -c "cd apps/api && bun run db:push && bun run src/index.ts"'
    environment:
      DATABASE_URL: 'postgres://cherry:cherry@db:5432/cherry'
      JWT_SECRET: auto_generated_internal_secret_key_change_if_you_want
    depends_on:
      db:
        condition: service_healthy

  dashboard:
    image: 'nord21dev/cherrytracer-dashboard:latest'
    restart: always
    environment:
      NODE_ENV: production
      NUXT_API_BASE: 'http://api:3000'
    depends_on:
      - api

  db:
    image: 'postgres:16-alpine'
    restart: always
    volumes:
      - 'cherry_data:/var/lib/postgresql/data'
    environment:
      POSTGRES_USER: cherry
      POSTGRES_PASSWORD: cherry
      POSTGRES_DB: cherry
    healthcheck:
      test:
        - CMD-SHELL
        - 'pg_isready -U cherry -d cherry'
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  cherry_data:
```

Run it:
```bash
docker-compose up -d
```

*   **Dashboard:** Visit **`http://localhost`**.
*   **API Endpoint:** `http://localhost` (Use this in your SDK).

### 2. Deploy via Coolify / Railway
Cherrytracer is built to be "One-Click" compatible.
*   **Coolify:** Select "Docker Compose" and paste the config above.
*   **Railway:** Deploy from Repo. It automatically detects the Dockerfile.

---

## 📦 The Client SDK

Our universal SDK works in **Node.js**, **Bun**, and the **Browser**. It is <2KB, type-safe, and uses "Smart Batching" to ensure it never slows down your app.

### Installation

```bash
npm install cherrytracer
```

### 1. Initialize
Initialize the tracer once at the start of your application.

```typescript
import { CherryTracer } from "cherrytracer";

const cherry = new CherryTracer({
  apiKey: "ct_...",           // Required: Your API Key
  projectId: "my-saas-v1",    // Required: Group logs by project
  baseUrl: "https://...",     // Optional: Your self-hosted instance URL
  
  // ⚡️ Performance Tuning (Optional)
  enabled: true,              // Toggle globally (great for dev/prod environments)
  batchSize: 50,              // Flush after 50 logs...
  flushInterval: 2000,        // ...or every 2 seconds
});
```

### 2. Logging
Structured logging that just works. Pass any object as the second argument.

```typescript
cherry.info("User signed up", { 
  userId: "u_123", 
  plan: "pro", 
  source: "landing_page" 
});

cherry.error("Payment failed", { 
  reason: "card_declined", 
  amount: 9900 
});
```

### 3. Tracing (Performance Monitoring)
Measure how long things take with **Spans**. Spans automatically track duration and group related logs together.

```typescript
const span = cherry.startSpan("process_order");

try {
  // You can log *inside* the span to keep context
  span.info("Validating cart items");
  await validateCart();
  
  span.info("Charging card");
  await chargeCard();

  // End the span to record the duration
  span.end({ success: true, orderId: "o_789" });
} catch (e) {
  // Mark the span as errored
  span.error("Order processing failed", { error: e.message });
  span.end({ success: false });
}
```

- Every span emits a `start` event immediately and an `end` event with `duration_ms`, `span_event`, `span_name`, `trace_id`, `span_id`, optional `parent_span_id`, and `status` (`success`/`error`). The SDK uses a monotonic clock for duration so wall-clock jumps don't skew results.
- For nested spans, pass the parent identifiers to keep the tree intact:

```typescript
const parent = cherry.startSpan("checkout_flow");
const child = cherry.startSpan("payment_gateway", { traceId: parent.traceId, parentSpanId: parent.id });
// ...
child.end();
parent.end();
```

### 4. Advanced Control
The SDK handles batching automatically, but you can force a flush (e.g., before serverless function timeout).

```typescript
// Force immediate upload of all queued logs
await cherry.flush();
```

---

## 🛠 Architecture

We hate bloat. Here is the entire stack:

*   **Backend:** [ElysiaJS](https://elysiajs.com) (running on Bun) for high-throughput ingestion.
*   **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team). No specialized time-series DB required.
*   **Frontend:** [Nuxt 4](https://nuxt.com) + Nuxt UI.
*   **Realtime:** WebSockets for live log streaming.

### The "Safety Valve" 🛡️
The #1 fear of self-hosting logs is running out of disk space.
Cherrytracer includes a background worker that checks your Postgres size every hour. If it exceeds your configured limit (e.g., 5GB), it automatically deletes the oldest 10% of logs. **Your server stays alive, always.**

---

## 🤝 Contributing

We welcome PRs from the community!

1.  Clone the repo: `git clone https://github.com/yourusername/cherrytracer.git`
2.  Install dependencies: `bun install`
3.  Start local dev: `bun dev` (Starts DB, API, and UI)

---

## 📜 License

MIT © Sebastian Klein

<div align="center">
  <p>
    <sub>Built with ❤️ for the Indie Web.</sub>
  </p>
</div>
