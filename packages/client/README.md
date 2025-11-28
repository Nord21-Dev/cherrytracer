# 🍒 Cherrytracer Client SDK

**The simplest way to add observability to your app.** Zero config. Zero boilerplate. Just magic. ✨

## 🎯 What is Cherrytracer?

Cherrytracer helps you understand what's happening in your app by automatically tracking:
- API requests and their timings
- Database queries
- External API calls (Stripe, OpenAI, etc.)
- Errors and where they happen
- User actions and flows

**The best part?** It does this automatically. No manual instrumentation. No passing traceIds everywhere. Just works.

## 🚀 Quick Start

### Installation

```bash
npm install cherrytracer
# or
bun add cherrytracer
# or
yarn add cherrytracer
```

### Basic Setup

```typescript
import { Cherrytracer } from "cherrytracer";

const tracer = new Cherrytracer({
  apiKey: "your-api-key",      // Get this from cherrytracer.io
  projectId: "your-project-id"
});
```

That's it! God mode is now activated. 🎉

## ✨ God Mode Features (Enabled by Default)

### 1. 🔗 Auto Context Propagation

**The Problem:** Normally you'd have to manually pass `traceId` everywhere:

```typescript
// 😫 Traditional way - so much boilerplate!
async function getUser(id, traceId) {
  tracer.info("Fetching user", { id }, traceId);
  const user = await db.find(id, traceId);
  return user;
}
```

**The Solution:** Cherrytracer does this automatically:

```typescript
// 🎉 God mode - just log naturally!
async function getUser(id) {
  tracer.info("Fetching user", { id });  // Auto-linked to parent trace!
  const user = await db.find(id);
  return user;
}
```

**How it works:** When you call `tracer.info()` inside a `trace()` block, it automatically knows which request/trace it belongs to. No manual work needed!

### 2. 🔒 Auto Data Scrubbing

**The Problem:** Sensitive data (passwords, tokens, API keys) can accidentally get logged.

**The Solution:** Cherrytracer automatically redacts 30+ sensitive field names:

```typescript
tracer.info("User login", {
  email: "user@example.com",        // ✅ Logged
  username: "john_doe",             // ✅ Logged
  password: "secret123",            // ❌ Becomes [REDACTED]
  apiKey: "sk_live_1234...",       // ❌ Becomes [REDACTED]
  token: "eyJhbGciOiJIUz..."       // ❌ Becomes [REDACTED]
});
```

**Protected fields include:** `password`, `token`, `apiKey`, `secret`, `authorization`, `cookie`, `ssn`, `creditcard`, and more!

### 3. 🌐 Auto Fetch Instrumentation

**The Problem:** External API calls are black boxes - you don't know how long they take or if they fail.

**The Solution:** Every `fetch()` is automatically traced:

```typescript
// Just use fetch() normally
await fetch("https://api.stripe.com/v1/charges");

// Cherrytracer automatically:
// ✅ Creates a span for this request
// ✅ Logs the duration
// ✅ Logs status codes and errors
// ✅ Injects trace headers (for distributed tracing!)
```

**Bonus:** If the external service supports trace headers, you'll get end-to-end tracing across services!

## 📖 Common Use Cases

### Middleware (Express, Koa, Hono, etc.)

Wrap your entire request in a trace span:

```typescript
// Express
app.use(async (req, res, next) => {
  return tracer.trace(`${req.method} ${req.url}`, async () => {
    await next();
  });
});

// Koa
app.use(async (ctx, next) => {
  return tracer.trace(`${ctx.method} ${ctx.url}`, async () => {
    await next();
  });
});
```

Now **every log** from that request is automatically linked! 🎯

### Database Queries

```typescript
async function getUser(id) {
  tracer.info("Fetching user", { id });
  
  const user = await db.users.findUnique({ 
    where: { id } 
  });
  
  tracer.info("User found", { userId: user.id });
  return user;
}
```

Both logs automatically link to the parent request. No extra work needed!

### External API Calls

```typescript
async function sendEmail(to, subject, body) {
  // This fetch is automatically traced!
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "Authorization": `Bearer ${SENDGRID_KEY}` },
    body: JSON.stringify({ to, subject, body })
  });
  
  return response.json();
}
```

In your dashboard, you'll see:
- How long SendGrid took to respond
- The status code (200, 400, 500, etc.)
- Any errors that occurred
- A trace header was sent to SendGrid!

### Error Handling

```typescript
app.get("/api/payment/:id", async (req, res) => {
  return tracer.trace("GET /api/payment", async (span) => {
    try {
      const payment = await chargeUser(req.params.id);
      res.json(payment);
    } catch (error) {
      // Log the error with context
      span.error("Payment failed", { 
        error: error.message,
        userId: req.params.id 
      });
      res.status(500).json({ error: "Payment failed" });
    }
  });
});
```

The error log is automatically linked to the request trace!

## 🛠️ API Reference

### Initialize

```typescript
const tracer = new Cherrytracer({
  apiKey: string;              // Required: Your API key
  projectId: string;           // Required: Your project ID
  
  // Optional (with defaults):
  baseUrl?: string;            // Default: production URL
  flushInterval?: number;      // Default: 2000ms
  batchSize?: number;          // Default: 50 events
  enabled?: boolean;           // Default: true
  
  // God Mode Features (enabled by default):
  autoInstrument?: boolean;    // Default: true (auto-trace fetch)
  scrubSensitiveData?: boolean;// Default: true (redact passwords etc.)
  propagateTraceContext?: boolean; // Default: true (inject trace headers)
  sensitiveKeys?: string[];    // Custom keys to scrub
});
```

### Logging

```typescript
tracer.info(message, data);   // Info level
tracer.warn(message, data);   // Warning level
tracer.error(message, data);  // Error level
tracer.debug(message, data);  // Debug level
```

### Tracing

```typescript
// Automatic span with callback
await tracer.trace("operation name", async (span) => {
  // Your code here
  span.info("Something happened");
  span.error("Uh oh", { reason: "..." });
});

// Manual span control
const span = tracer.startSpan("operation name");
// Do work...
span.end();
```

### Manual Flush

```typescript
await tracer.flush();  // Immediately send all queued logs
```

## 🎨 Real-World Example

Here's a complete API endpoint with Cherrytracer:

```typescript
import { Cherrytracer } from "cherrytracer";
import express from "express";

const app = express();
const tracer = new Cherrytracer({
  apiKey: process.env.CHERRY_API_KEY,
  projectId: "my-saas-app"
});

// Middleware: Trace all requests
app.use(async (req, res, next) => {
  return tracer.trace(`${req.method} ${req.url}`, async () => {
    await next();
  });
});

// Get user profile
app.get("/api/user/:id", async (req, res) => {
  // All these logs auto-link to the request trace!
  tracer.info("Fetching user profile", { userId: req.params.id });
  
  const user = await db.users.findUnique({ 
    where: { id: req.params.id } 
  });
  
  if (!user) {
    tracer.warn("User not found", { userId: req.params.id });
    return res.status(404).json({ error: "Not found" });
  }
  
  // Fetch payment data from Stripe (auto-traced!)
  const charges = await fetch(
    `https://api.stripe.com/v1/customers/${user.stripeId}/charges`
  ).then(r => r.json());
  
  tracer.info("Request completed", { 
    userId: user.id,
    chargesCount: charges.data.length 
  });
  
  res.json({ user, charges });
});

app.listen(3000);
```

**In your dashboard, you'll see:**
- The full request trace with timing
- Each log linked to the request
- How long the database query took
- How long Stripe took to respond
- Any errors with full context

## 🔧 Configuration Examples

### Development Mode

```typescript
const tracer = new Cherrytracer({
  apiKey: "ct_test_...",
  projectId: "dev",
  baseUrl: "http://localhost:3000",
  flushInterval: 1000,  // Flush more frequently in dev
});
```

### Production Mode

```typescript
const tracer = new Cherrytracer({
  apiKey: process.env.CHERRY_API_KEY,
  projectId: process.env.CHERRY_PROJECT_ID,
  flushInterval: 5000,   // Batch more in production
  batchSize: 100,
});
```

### Disable in Tests

```typescript
const tracer = new Cherrytracer({
  apiKey: "ct_test_...",
  projectId: "test",
  enabled: process.env.NODE_ENV !== "test",
});
```

### Custom Sensitive Keys

```typescript
const tracer = new Cherrytracer({
  apiKey: "...",
  projectId: "...",
  sensitiveKeys: ["ssn", "socialSecurityNumber", "driverLicense"],
});
```

### Disable Auto-Instrumentation

```typescript
const tracer = new Cherrytracer({
  apiKey: "...",
  projectId: "...",
  autoInstrument: false,        // Disable fetch auto-tracing
  scrubSensitiveData: false,    // Disable auto-scrubbing
});
```

## 🌍 Framework Compatibility

Cherrytracer works with **any JavaScript/TypeScript framework**:

- ✅ Express.js
- ✅ Koa
- ✅ Hono
- ✅ Next.js
- ✅ Remix
- ✅ Nuxt
- ✅ SvelteKit
- ✅ Bun
- ✅ Node.js
- ✅ Deno
- ✅ Browser apps
- ✅ Serverless functions
- ✅ Edge functions

## 🤔 FAQ

### How does auto context propagation work?

We use `AsyncLocalStorage` in Node/Bun environments and a synchronous stack-based approach in browsers. This allows child function calls to automatically inherit the parent trace context without manual passing.

### Will this slow down my app?

No! Logs are batched and sent asynchronously. The overhead is negligible (microseconds per log).

### What if I want to disable god mode features?

No problem! All features can be disabled individually via configuration options.

### Can I use this in the browser?

Yes! Cherrytracer works in both server and browser environments. Just use a browser-safe API key.

### Does this work with serverless/edge functions?

Absolutely! Cherrytracer works great with Vercel, Cloudflare Workers, Lambda, etc.

## 📚 Learn More

- **Dashboard**: [cherrytracer.io](https://cherrytracer.io)
- **Documentation**: [docs.cherrytracer.io](https://docs.cherrytracer.io)
- **Examples**: See [example-god-mode.ts](./example-god-mode.ts)

## 📄 License

MIT

---

Made with 🍒 by indie hackers, for indie hackers.
