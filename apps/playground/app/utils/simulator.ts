import { CherryTracer } from "cherrytracer-client"; // Assuming workspace link

const PRODUCTS = ["Premium Plan", "Credits Pack", "Enterprise Seat"];
const ERRORS = ["Card Declined", "Gateway Timeout", "Insufficient Funds"];

export class Simulator {
  private logger: CherryTracer;
  private isRunning = false;
  private timer: any = null;

  constructor(logger: CherryTracer) {
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
      
      const pSpan = this.logger.startSpan("payment_gateway", span.traceId);
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
      const pSpan = this.logger.startSpan("payment_gateway", span.traceId);
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

  // 3. Burst Mode (Load Test)
  async burst(count: number = 500) {
    const span = this.logger.startSpan("load_test_burst");
    span.info(`Starting burst of ${count} logs`);
    
    for (let i = 0; i < count; i++) {
      this.logger.info(`Stress test log #${i}`, { iteration: i });
      // No sleep! Hammer the queue.
    }
    
    span.end({ count });
  }

  toggleAutoPilot(enabled: boolean) {
    if (this.isRunning === enabled) return;
    this.isRunning = enabled;

    if (enabled) {
      this.timer = setInterval(() => {
        const rand = Math.random();
        if (rand > 0.7) this.checkoutSuccess();
        else if (rand > 0.9) this.checkoutFail();
        else this.logger.info("User navigation", { path: "/pricing" });
      }, 800); // New activity every 800ms
    } else {
      clearInterval(this.timer);
    }
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}