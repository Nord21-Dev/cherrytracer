## Cherrytracer Client

Lightweight browser/node client for sending logs to Cherrytracer.

### Server usage
```ts
import { CherryTracer } from "cherrytracer";

const tracer = new CherryTracer({
  apiKey: "ct_...",          // server key from Project Settings
  projectId: "your-project-id",
  baseUrl: "https://collector.yourdomain.com"
});

tracer.info("Server started");
```

### Browser usage
Use a browser key (`ct_pub_...`) and configure allowed referrers in the dashboard.
```ts
import { CherryTracer } from "cherrytracer";

const tracer = new CherryTracer({
  apiKey: "ct_pub_...",      // browser key
  projectId: "your-project-id",
  baseUrl: "https://collector.yourdomain.com",
  keyType: "browser"
});
```

- Browser requests are accepted only when the page's Referer matches the allowed referrer list.
- Server keys should stay on the backend; the client will warn if a server key is used in a browser environment.
- `baseUrl` defaults to the current origin in the browser, or `http://localhost:3000` otherwise.

### Spans (Tracing)
```ts
const span = tracer.startSpan("process_order");

try {
  span.info("Doing work");
  await doWork();
  span.end({ status: "success" });
} catch (e) {
  span.error("Span failed", { error: (e as Error).message });
  span.end({ status: "error" });
}
```

- The SDK emits a `start` log right away and an `end` log with `duration_ms`, `span_event`, `span_name`, `status`, `trace_id`, `span_id`, and optional `parent_span_id`. Duration uses a monotonic clock to avoid wall-clock drift.
- For nested spans, pass the parent identifiers:
```ts
const parent = tracer.startSpan("checkout_flow");
const child = tracer.startSpan("payment_gateway", { traceId: parent.traceId, parentSpanId: parent.id });
// ...
child.end();
parent.end();
```
