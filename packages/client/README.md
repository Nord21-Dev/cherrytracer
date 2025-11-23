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
