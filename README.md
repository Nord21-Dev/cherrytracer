# 🍒 Cherrytracer

**The open-source observability platform for indie hackers who hate configuring Grafana.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

Cherrytracer is a lightweight, self-hosted alternative to Datadog and Loki. It is designed for **speed**, **simplicity**, and **sanity**.

If you have less than 5 million users and just want to know *"Why is my API 500-ing?"* without learning PromQL, this is for you.

![Dashboard Preview](https://raw.githubusercontent.com/placeholder/dashboard-screenshot.png)

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
  # 1. The Ingestion API (Port 3000)
  api:
    image: nord21dev/cherrytracer-api:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://cherry:cherry@db:5432/cherry
      - JWT_SECRET=replace_with_super_secret_key
      - ADMIN_EMAIL=admin@example.com
      - ADMIN_PASSWORD=secure_password
    depends_on:
      - db

  # 2. The Dashboard (Port 3001)
  dashboard:
    image: nord21dev/cherrytracer-dashboard:latest
    restart: always
    ports:
      - "3001:3000"
    environment:
      - NUXT_API_URL=http://api:3000
      # Optional: uncomment only when the browser must call a different origin
      # - NUXT_PUBLIC_API_BASE_URL=https://your-api-host
    depends_on:
      - api

  # 3. The Database
  db:
    image: postgres:16-alpine
    volumes:
      - cherry_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=cherry
      - POSTGRES_PASSWORD=cherry
      - POSTGRES_DB=cherry

volumes:
  cherry_data:
```

Run it:
```bash
docker-compose up -d
```

*   **Dashboard:** Visit **`http://localhost:3001`**. Log in with the credentials set in ENV.
*   **API Endpoint:** `http://localhost:3000` (Use this in your SDK).

### 2. Deploy via Coolify / Railway
Cherrytracer is built to be "One-Click" compatible.
*   **Coolify:** Select "Docker Compose" and paste the config above.
*   **Railway:** Deploy from Repo. It automatically detects the Dockerfile.

---

## 📦 The Client SDK

Our universal SDK works in **Node.js**, **Bun**, and the **Browser**. It is <2KB and uses "Smart Batching" to ensure it never slows down your app.

```bash
npm install cherrytracer
```

### Usage

```typescript
import { CherryTracer } from "cherrytracer";

const logger = new CherryTracer({
  apiKey: "ct_12345...", // Get this from your Dashboard (Settings)
  baseUrl: "http://localhost:3000" // Your API URL
});

// 1. Standard Logging
logger.info("User signed up", { plan: "pro", userId: 123 });
logger.error("Payment failed", { error: err.message });

// 2. Tracing (Performance Monitoring)
const span = logger.startSpan("checkout_process");

try {
  await processPayment();
  span.end({ success: true }); // Automatically records duration
} catch (e) {
  span.error("Card declined");
  span.end({ success: false });
}
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