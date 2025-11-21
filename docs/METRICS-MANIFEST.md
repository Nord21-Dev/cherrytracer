# 💎 METRICS-MANIFEST.md: The Indie Observability Standard

> **Philosophy:** "If it doesn't help me fix a bug or save a sale in under 60 seconds, it's noise."

This document defines the high-density visualization and alerting strategy for Cherrytracer. We reject complex query languages (PromQL) in favor of actionable, SQL-derived insights visualized beautifully with [Unovis](https://unovis.dev).

---

## 1. The "Money" Dashboard (Landing View)

The default view must answer one question: **"Is my SaaS making money or burning down?"**

### 📊 The Visualization Stack (Unovis)
We use **Unovis** for its modularity and clean, Vercel-like aesthetic. It integrates natively with Vue 3/Nuxt.

#### A. The "Pulse" (Global Request Volume & Health)
*   **Chart Type:** `<VisArea>` (Stacked)
*   **X-Axis:** Time (Last 1h/24h)
*   **Y-Axis:** Request Count
*   **Data Series (Stacked Colors):**
    1.  🟢 **Success (2xx):** `var(--color-primary-500)`
    2.  🟡 **Client Errors (4xx):** `var(--color-warning-500)`
    3.  🔴 **System Crashing (5xx):** `var(--color-error-500)`
*   **Indie Insight:** If the Red/Yellow area spikes, you open the laptop. If it's Green, you keep drinking coffee.

#### B. Latency Heatmap (The "Slow" Killer)
*   **Chart Type:** `<VisScatter>` or `<VisLine>` with thresholds.
*   **Metric:** P95 and P99 Duration.
*   **Visualization:** A line chart where the line turns **Orange** if > 500ms and **Red** if > 2s.
*   **Why:** Indies often run on $5 VPSs. One slow SQL query kills the CPU. This chart spots the "CPU murderers."

#### C. The "Top Offenders" List (Plain HTML Table)
Don't visualize this. Just list them. sorted by `count * avg_duration`.
*   **Endpoint:** `POST /api/checkout` (3s avg) 🚨
*   **Endpoint:** `GET /dashboard` (1.2s avg) ⚠️

---

## 2. The "Revenue Protection" Layer (Business Logic)

Generic APMs miss context. Cherrytracer captures **Business Events** via the `data` JSONB column.

### Key Metrics to Extract (SQL Aggregations)

1.  **The Stripe Heartbeat**
    *   **Filter:** `message LIKE '%stripe%'` OR `data->>'source' = 'stripe_webhook'`
    *   **Metric:** Ratio of `200 OK` vs `500 Error` on webhook endpoints.
    *   **Unovis Component:** `<VisDonut>` (Small, corner widget).
    *   **Why:** If Stripe webhooks fail, you aren't provisioning accounts. You are losing customers.

2.  **Auth Conversion Rate**
    *   **Compare:** Count of `Log: Sign up started` vs `Log: User Created`.
    *   **Why:** If this drops below 80%, your sign-up form is broken.

---

## 3. 🔔 The "Panic Button" Protocols (Telegram Alerts)

Email alerts are for newsletters. Critical infrastructure alerts go to **Telegram**.
We use a simple bot wrapper. No complex PagerDuty integrations.

### The Alert Logic (Run via `cron` in `src/index.ts`)

#### Protocol Alpha: "The Outage" (Immediate)
*   **Trigger:** > 5% Error Rate (5xx) in a 2-minute rolling window.
*   **Telegram Message:**
    ```
    🔥 CRITICAL: High Error Rate Detected (12%)
    ------------------------------------------
    Most Affecting: POST /auth/login
    Last Error: "Connection to DB timed out"
    Trace: [Link to Trace]
    ```

#### Protocol Beta: "The Slow Death" (Performance degradation)
*   **Trigger:** P95 Latency > 2000ms for 5 consecutive minutes.
*   **Telegram Message:**
    ```
    🐢 WARNING: System Sluggish
    ------------------------------------------
    Avg Latency: 2400ms
    Likely Cause: "GET /api/heavy-report"
    Resource: DB CPU High?
    ```

#### Protocol Gamma: "The Disk Reaper" (Self-Preservation)
*   **Trigger:** Postgres Storage > 90% of `MAX_STORAGE`.
*   **Telegram Message:**
    ```
    💾 STORAGE ALERT: Disk 90% Full
    ------------------------------------------
    Action: Auto-pruning triggered.
    Deleted: 15,000 oldest logs.
    ```

---

## 4. Technical Implementation Strategy

### A. The SQL Aggregation (Backend)
Don't fetch 10,000 rows to frontend to calculate charts. Do it in Postgres.

**`apps/api/src/routes/stats.ts` (New File)**
```typescript
// Example Drizzle/SQL for Unovis Area Chart
const histogram = await db.execute(sql`
  SELECT 
    date_trunc('minute', timestamp) as time_bucket,
    COUNT(*) FILTER (WHERE level = 'info') as success,
    COUNT(*) FILTER (WHERE level = 'error') as errors
  FROM logs
  WHERE timestamp > NOW() - INTERVAL '1 hour'
  GROUP BY time_bucket
  ORDER BY time_bucket ASC
`);
```

### B. The Frontend Visualization (Nuxt + Unovis)

**`apps/dashboard/components/charts/PulseChart.vue`**
```vue
<script setup>
import { VisXYContainer, VisArea, VisAxis, VisCrosshair } from '@unovis/vue'

const props = defineProps(['data']) 
// data format: [{ x: time, success: 100, errors: 2 }]

const x = (d) => new Date(d.time_bucket).getTime()
const y = [
  (d) => d.success, 
  (d) => d.errors
]
</script>

<template>
  <VisXYContainer :height="300">
    <VisArea :x="x" :y="y" :color="(i) => i === 0 ? '#10b981' : '#ef4444'" />
    <VisAxis type="x" />
    <VisAxis type="y" />
    <VisCrosshair />
  </VisXYContainer>
</template>
```

---

## 5. The Setup (Zero Config)

1.  **User enters Telegram Chat ID** in Settings.
2.  **User enters Bot Token** (or uses the hosted Cherrytracer bot).
3.  **Done.** The protocols (Alpha/Beta/Gamma) are enabled by default.