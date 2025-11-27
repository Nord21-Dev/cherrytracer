## Cherrytracer Client

Lightweight browser/node client that batches logs, auto-derives context, and ships them to your Cherrytracer project with minimal configuration.

### Install

```bash
npm install cherrytracer
# or
yarn add cherrytracer
```

### Quick start — server

```ts
import { Cherrytracer } from "cherrytracer";

const tracer = new Cherrytracer({
  apiKey: "ct_...",          // server key from Project Settings
  projectId: "your-project-id"
});

tracer.info("Server started");
```

- `baseUrl` defaults to `http://localhost:3000` on the server and the current origin in the browser.
- Logs inherit a base context (environment, hostname, URL, user agent, NODE_ENV) so every entry shares meaningful telemetry.

### Quick start — browser

```ts
import { Cherrytracer } from "cherrytracer";

const tracer = new Cherrytracer({
  apiKey: "ct_pub_...",      // browser key
  projectId: "your-project-id",
  keyType: "browser"
});

tracer.info("Browser page loaded");
```

- Browser requests are accepted only when the page Referer matches the allowed referrers configured in the dashboard.
- The client warns in the console if a server key is used in a browser context and still sends data to help you catch mistakes.

### Configuration reference

| Option | Description | Default |
| --- | --- | --- |
| `apiKey` | Required. Use `ct_…` for servers, `ct_pub_…` for browsers. | — |
| `projectId` | Required. Associates logs with the right project. | — |
| `baseUrl` | Ingest endpoint. Defaults to the current origin (browser) or `http://localhost:3000`. | Origin / `http://localhost:3000` |
| `flushInterval` | Milliseconds between automatic flushes. Smaller numbers push logs sooner. | `2000` |
| `batchSize` | How many logs to queue before flushing immediately. | `50` |
| `enabled` | Toggle logging without tearing down instrumentation. | `true` |
| `keyType` | Hint for runtime warnings (`browser` or `server`). | Inferred from the environment |

### Logging API

Call `info`, `warn`, `error`, or `debug` to record a message. Each call retains the base context defined during initialization, merges in whatever `data` you pass, and queues it for batch delivery.

- Every log emits ISO timestamps, `traceId`, `spanId`, and `fingerprint` data to power search and grouping on the dashboard.
- Logs flush automatically when the queue reaches `batchSize`, when the timer fires, or right before a browser tab becomes hidden (`visibilitychange`).
- `flush(useBeacon?: boolean)` forces an immediate upload. Passing `true` sets `keepalive` (ideal for `beforeunload`), while the default lets the SDK reuse the ongoing timer.

### Tracing & spans

Create spans to connect related logs and measure durations. `startSpan` immediately emits a `span_event: "start"` log and returns a span helper:

```ts
const parent = tracer.startSpan("checkout_flow");
const child = tracer.startSpan("payment_gateway", {
  traceId: parent.traceId,
  parentSpanId: parent.id,
  attributes: { paymentProvider: "stripe" }
});

child.info("Authorizing card");
// ...
child.end({ status: "success" });
parent.end();
```

The span helper exposes `.id`, so reuse that value when passing `parentSpanId` to child spans; `spanId` only appears on the emitted log entries.

- `traceId` keeps every span in the same trace. Omitting it generates a new trace ID, so the span becomes another root bucket.
- `parentSpanId` records the parent/child relationship. If you only pass `traceId`, the backend can’t reconstruct a tree and the UI shows the span as another root. Passing both guarantees a proper nested child with accurate timing.
- `attributes` lets you attach static metadata (merged into every start/end log) such as operation names, environment tags, or correlation IDs.
- `end()` emits a final log with `duration_ms`, `status`, and `span_event: "end"` using a monotonic clock, ensuring wall-clock jumps can’t skew timing.
- Within a span you can still call `info`, `warn`, `error`, or `debug`; each log is tagged with the span’s `traceId` and `spanId`.

### Batching, queueing, and flush guarantees

- Logs enter an in-memory queue with monotonic timestamps to avoid drift when calculating durations.
- `startSpan` also pushes `span_event: "start"` logs so you can see in-flight spans.
- The SDK tracks `retryDelayMs` with exponential backoff (max 10s) and requeues failed batches to avoid data loss.
- You can disable the client (`enabled: false`) during tests or when capturing sensitive operations, and flip it back on without reinitializing.

### Environment & context

`Cherrytracer` auto-detects runtimes:

- Browser ➜ captures `environment`, `url`, `userAgent`.
- Node/Bun ➜ captures `environment`, `nodeVersion`, `hostname`, `NODE_ENV` (if accessible).

Any additional data you pass merges with this base context so fields like `traceId`, `spanId`, or `duration_ms` remain searchable in the dashboard.

### Browser guardrails

- Browser keys are restricted to configured referrers. The server validates the `Referer` header and rejects mismatches.
- Server keys produce a warning when used in a browser to prevent accidental leakage of privileged credentials.
- The SDK flushes right before the page becomes hidden, and `flush(true)` is ready for manual unload hooks to honor the keepalive policy.

### Advanced tips

1. Use `traceId` when manually correlating logs that surround a span (errors, external system calls, etc.).
2. Call `flush(true)` before serverless timeouts or SPA route changes to avoid losing the last few logs.
3. Track `/api/logs` failures via `flush` rejection handlers if you need custom retry monitoring.
4. Toggle `enabled` at runtime for conditional sampling or feature-gated tracing.

### Architecture

We hate bloat. Here is the entire stack:

*   **Backend:** [ElysiaJS](https://elysiajs.com) (running on Bun) for high-throughput ingestion.
*   **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team). No specialized time-series DB required.
*   **Frontend:** [Nuxt 4](https://nuxt.com) + Nuxt UI.
*   **Realtime:** WebSockets for live log streaming.

### The "Safety Valve" 🛡️

The #1 fear of self-hosting logs is running out of disk space. Cherrytracer includes a background worker that checks your Postgres size every hour. If it exceeds your configured limit (e.g., 5GB), it automatically deletes the oldest 10% of logs. **Your server stays alive, always.**

### 🤝 Contributing

See the root repository for contribution guidelines, issue templates, and release procedures.
