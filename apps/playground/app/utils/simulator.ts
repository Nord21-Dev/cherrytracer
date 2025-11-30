import { Cherrytracer } from "cherrytracer"; // Assuming workspace link

const PRODUCTS = ["Premium Plan", "Credits Pack", "Enterprise Seat", "API Access", "Storage Add-on"];
const ERRORS = ["Card Declined", "Gateway Timeout", "Insufficient Funds", "Network Error"];
const USER_AGENTS = ["Chrome/91.0", "Firefox/89.0", "Safari/14.0", "Edge/91.0"];
const COUNTRIES = ["US", "UK", "DE", "FR", "CA", "AU"];

export class Simulator {
  private logger: Cherrytracer;
  private isRunning = false;
  private timer: any = null;
  private activeUsers = new Map<string, { sessionId: string; lastActivity: number }>();

  constructor(logger: Cherrytracer) {
    this.logger = logger;
  }

  // 1. Scenario: Successful Checkout (Complex Trace)
  async checkoutSuccess() {
    const span = this.logger.startSpan("checkout_flow");
    const cartId = Math.random().toString(36).substring(7);

    try {
      span.info("Cart validated", { cartId, items: 2 });
      await this.sleep(100); // Fake latency

      span.info("Calculating tax...", { region: "US-CA" });
      await this.sleep(50);

      const pSpan = this.logger.startSpan("payment_gateway", { traceId: span.traceId, parentSpanId: span.id });
      pSpan.info("Contacting Stripe API");
      await this.sleep(300);
      pSpan.end({ status: "captured", amount: 9900 });

      span.info("Email sent", { template: "receipt_v2" });
      span.end({ success: true, orderId: "ord_" + cartId });
    } catch (e) {
      span.error("Checkout crashed (should not happen in this scenario)");
      span.end();
    }
  }

  // 2. Scenario: Failed Payment (Error visualization)
  async checkoutFail() {
    const span = this.logger.startSpan("checkout_flow");

    try {
      span.info("Processing payment");
      await this.sleep(150);

      // Simulate nested failure
      const pSpan = this.logger.startSpan("payment_gateway", { traceId: span.traceId, parentSpanId: span.id });
      await this.sleep(200);
      const errorMsg = ERRORS[Math.floor(Math.random() * ERRORS.length)];
      pSpan.error("Payment Provider Error", { code: "ERR_402", provider_msg: errorMsg });
      pSpan.end({ success: false });

      throw new Error(errorMsg);
    } catch (e: any) {
      span.error("Checkout Failed", { error: e.message });
      span.end({ success: false });
    }
  }

  // 3. Enhanced User Signup Flow (Events + Trace + Session)
  async signupFlow() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);

    await this.logger.trace("user_signup_flow", async (span) => {
      // Track user journey with structured events
      this.logger.track("page_view", {
        eventType: "navigation",
        userId,
        sessionId,
        page: "/pricing",
        referrer: "google.com"
      });
      await this.sleep(500);

      this.logger.track("plan_selected", {
        eventType: "engagement",
        userId,
        sessionId,
        plan: "pro_monthly",
        value: 29
      });
      span.info("User selected plan", { plan: "pro_monthly" });
      await this.sleep(300);

      this.logger.track("signup_started", {
        eventType: "conversion",
        userId,
        sessionId
      });
      await this.sleep(800); // Filling form...

      // Simulate backend call
      await this.logger.trace("create_user_api", async (apiSpan) => {
        await this.sleep(200);
        apiSpan.end({ status: 201 });
      });

      this.logger.track("signup_completed", {
        eventType: "conversion",
        userId,
        sessionId,
        plan: "pro_monthly",
        value: 29,
        currency: "USD"
      });
      span.info("Signup completed", { userId });
    });
  }

  // 4. Subscription Upgrade (High Value Event)
  async subscriptionUpgrade() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);

    await this.logger.trace("subscription_upgrade", async (span) => {
      this.logger.track("dashboard_viewed", {
        eventType: "engagement",
        userId,
        sessionId
      });
      await this.sleep(400);

      this.logger.track("upgrade_clicked", {
        eventType: "engagement",
        userId,
        sessionId,
        currentPlan: "free"
      });
      span.info("Upgrade modal opened");
      await this.sleep(1000); // User thinking...

      await this.logger.trace("process_payment", async (pSpan) => {
        await this.sleep(500);
        pSpan.end({ success: true, amount: 9900 });
      });

      this.logger.track("payment_success", {
        eventType: "revenue",
        userId,
        sessionId,
        value: 99,
        currency: "USD",
        product: "enterprise_plan"
      });

      this.logger.track("subscription_activated", {
        eventType: "lifecycle",
        userId,
        sessionId,
        tier: "enterprise",
        previousTier: "free"
      });
    });
  }

  // 5. E-commerce Purchase Flow
  async ecommercePurchase() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);
    const cartValue = Math.floor(Math.random() * 500) + 50;

    await this.logger.trace("purchase_flow", async (span) => {
      this.logger.track("product_view", {
        eventType: "ecommerce",
        userId,
        sessionId,
        productId: "prod_123",
        category: "software"
      });
      await this.sleep(300);

      this.logger.track("add_to_cart", {
        eventType: "ecommerce",
        userId,
        sessionId,
        productId: "prod_123",
        quantity: 1,
        value: cartValue
      });
      await this.sleep(200);

      this.logger.track("checkout_started", {
        eventType: "conversion",
        userId,
        sessionId,
        cartValue
      });
      span.info("Checkout initiated");

      await this.logger.trace("payment_processing", async (pSpan) => {
        await this.sleep(400);
        pSpan.end({ success: true });
      });

      this.logger.track("purchase_completed", {
        eventType: "revenue",
        userId,
        sessionId,
        value: cartValue,
        currency: "USD",
        products: ["prod_123"],
        orderId: "ord_" + Math.random().toString(36).substring(7)
      });
    });
  }

  // 6. User Session with Multiple Events
  async userSession() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);

    // Simulate a full user session
    this.logger.track("session_start", {
      eventType: "session",
      userId,
      sessionId,
      userAgent: USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)]
    });

    await this.sleep(200);
    this.logger.track("page_view", { eventType: "navigation", userId, sessionId, page: "/dashboard" });
    await this.sleep(300);
    this.logger.track("feature_used", { eventType: "engagement", userId, sessionId, feature: "export_data" });
    await this.sleep(400);
    this.logger.track("page_view", { eventType: "navigation", userId, sessionId, page: "/settings" });
    await this.sleep(200);
    this.logger.track("settings_updated", { eventType: "engagement", userId, sessionId, setting: "notifications" });
    await this.sleep(500);

    this.logger.track("session_end", {
      eventType: "session",
      userId,
      sessionId,
      duration: 1800 // 30 minutes
    });
  }

  // 7. Error Scenarios with Events
  async errorScenario() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);

    try {
      await this.logger.trace("api_call", async (span) => {
        this.logger.track("api_request", {
          eventType: "api",
          userId,
          sessionId,
          endpoint: "/api/data"
        });

        await this.sleep(200);
        throw new Error("API rate limit exceeded");
      });
    } catch (e) {
      this.logger.track("api_error", {
        eventType: "error",
        userId,
        sessionId,
        errorType: "rate_limit",
        endpoint: "/api/data"
      });
      this.logger.error("API call failed", { error: (e as Error).message, userId, sessionId });
    }
  }

  // 8. A/B Test Simulation
  async abTestScenario() {
    const userId = "u_" + Math.random().toString(36).substring(7);
    const sessionId = "sess_" + Math.random().toString(36).substring(7);
    const variant = Math.random() > 0.5 ? "A" : "B";

    this.logger.track("experiment_exposed", {
      eventType: "experiment",
      userId,
      sessionId,
      experiment: "checkout_flow",
      variant
    });

    await this.sleep(300);

    if (variant === "A") {
      this.logger.track("checkout_conversion", {
        eventType: "conversion",
        userId,
        sessionId,
        experiment: "checkout_flow",
        variant: "A",
        value: 50
      });
    } else {
      this.logger.track("checkout_abandoned", {
        eventType: "engagement",
        userId,
        sessionId,
        experiment: "checkout_flow",
        variant: "B"
      });
    }
  }

  // 9. Burst Mode (Load Test)
  async burst(count: number = 500) {
    const span = this.logger.startSpan("load_test_burst");
    span.info(`Starting burst of ${count} logs`);

    for (let i = 0; i < count; i++) {
      this.logger.info(`Stress test log #${i}`, { iteration: i });
      // No sleep! Hammer the queue.
    }

    span.end({ count });
  }

  // 10. Event Burst (Business Events)
  async eventBurst(count: number = 100) {
    const span = this.logger.startSpan("event_burst_test");
    span.info(`Starting burst of ${count} events`);

    for (let i = 0; i < count; i++) {
      const userId = `u_${Math.floor(Math.random() * 100)}`;
      const eventType = ["page_view", "click", "purchase", "signup"][Math.floor(Math.random() * 4)];

      this.logger.track(`${eventType}_${i}`, {
        eventType,
        userId,
        sessionId: `sess_${Math.floor(Math.random() * 50)}`,
        value: eventType === "purchase" ? Math.floor(Math.random() * 100) + 10 : undefined
      });
    }

    span.end({ count });
  }

  // 11. Long-running / unfinished span (no end)
  async danglingSpan() {
    const span = this.logger.startSpan("long_running_job");

    await this.sleep(250);
    span.info("Still running...", { phase: "processing" });
    // Intentionally do NOT call span.end() to simulate an in-flight span
  }

  // 12. Performance Test with Events
  async performanceTest() {
    const startTime = Date.now();
    const span = this.logger.startSpan("performance_test");

    // Simulate multiple concurrent operations
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(this.logger.trace(`operation_${i}`, async (opSpan) => {
        await this.sleep(Math.random() * 200 + 50);
        opSpan.end({ duration: Math.random() * 100 + 50 });
      }));
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    span.end({ totalTime, operations: 10 });
  }

  triggerFatalError() {
    // Throw on the next tick so it bubbles as an uncaught exception
    setTimeout(() => {
      throw new Error("Simulated fatal error from the Cherrytracer Playground");
    }, 0);
  }

  toggleAutoPilot(enabled: boolean) {
    if (this.isRunning === enabled) return;
    this.isRunning = enabled;

    if (enabled) {
      this.timer = setInterval(() => {
        const rand = Math.random();
        if (rand > 0.8) this.checkoutSuccess();
        else if (rand > 0.85) this.checkoutFail();
        else if (rand > 0.9) this.signupFlow();
        else if (rand > 0.95) this.errorScenario();
        else this.logger.track("page_view", {
          eventType: "navigation",
          userId: `u_${Math.floor(Math.random() * 100)}`,
          sessionId: `sess_${Math.floor(Math.random() * 50)}`,
          page: ["/dashboard", "/pricing", "/docs", "/settings"][Math.floor(Math.random() * 4)]
        });
      }, 600); // New activity every 600ms
    } else {
      clearInterval(this.timer);
    }
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}
