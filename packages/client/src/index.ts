import { CherryConfig, LogEvent, LogLevel, Span } from "./types";
import { generateId, getContext } from "./utils";

export class CherryTracer {
  private queue: LogEvent[] = [];
  private config: Required<CherryConfig>;
  private flushTimer: any = null;
  private baseContext: Record<string, any>;
  private isFlushing = false;
  private pendingFlush = false;
  private retryDelayMs = 0;
  private readonly BASE_RETRY_DELAY = 500;
  private readonly MAX_RETRY_DELAY = 10000;

  constructor(config: CherryConfig) {
    const runtime = typeof window !== "undefined" ? "browser" : "server";
    const defaultBaseUrl = config.baseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    const keyType = config.keyType || runtime;

    this.config = {
      apiKey: config.apiKey,
      baseUrl: defaultBaseUrl,
      projectId: config.projectId,
      flushInterval: config.flushInterval || 2000,
      batchSize: config.batchSize || 50,
      enabled: config.enabled ?? true,
      keyType
    };

    if (runtime === "browser" && (keyType !== "browser" || !this.config.apiKey.startsWith("ct_pub_"))) {
      console.warn("[CherryTracer] Browser environment detected. Use a browser key restricted to allowed referrers.");
    }

    this.baseContext = getContext();

    if (typeof window !== "undefined") {
      // Auto-flush on page unload
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flush(true);
        }
      });
    }

    // Start the flush timer
    this.startTimer();
  }

  private startTimer() {
    if (!this.config.enabled) return;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
  }

  /**
   * Add a log to the queue
   */
  private emit(level: LogLevel, message: string, data: any = {}, traceId?: string, spanId?: string) {
    if (!this.config.enabled) return;

    const entry: LogEvent = {
      level,
      message,
      traceId,
      spanId,
      timestamp: new Date().toISOString(),
      data: {
        ...this.baseContext,
        ...data,
      },
    };

    this.queue.push(entry);

    if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  // Public API
  public info(message: string, data?: any) { this.emit("info", message, data); }
  public warn(message: string, data?: any) { this.emit("warn", message, data); }
  public error(message: string, data?: any) { this.emit("error", message, data); }
  public debug(message: string, data?: any) { this.emit("debug", message, data); }

  /**
   * Trace / Spans
   * Returns an object that allows logging *within* that span context
   */
  public startSpan(name: string, parentTraceId?: string): Span {
    const traceId = parentTraceId || generateId();
    const spanId = generateId();
    const startTime = Date.now();

    // Log the start
    this.emit("info", `Span Started: ${name}`, { span_event: 'start' }, traceId, spanId);

    return {
      id: spanId,
      traceId: traceId,

      info: (msg, data) => this.emit("info", msg, data, traceId, spanId),
      error: (msg, data) => this.emit("error", msg, data, traceId, spanId),

      end: (data?: any) => {
        const duration = Date.now() - startTime;
        this.emit("info", `Span Ended: ${name}`, {
          ...data,
          duration_ms: duration,
          span_event: 'end'
        }, traceId, spanId);
      }
    };
  }

  /**
   * Flush queue to API
   */
  public async flush(useBeacon = false) {
    if (this.queue.length === 0) return;

    if (this.isFlushing) {
      this.pendingFlush = true;
      return;
    }

    this.isFlushing = true;

    while (this.queue.length) {
      const batch = this.queue.splice(0, this.config.batchSize);

      try {
        await this.sendBatch(batch, useBeacon);
        this.retryDelayMs = 0;
      } catch (e) {
        // Re-queue the failed batch at the front and retry with backoff.
        this.queue.unshift(...batch);

        const delay = this.retryDelayMs || this.BASE_RETRY_DELAY;
        this.retryDelayMs = Math.min(delay * 2, this.MAX_RETRY_DELAY);
        setTimeout(() => this.flush(useBeacon), delay);
        break;
      }
    }

    this.isFlushing = false;

    if (this.pendingFlush && this.queue.length) {
      this.pendingFlush = false;
      this.flush(useBeacon);
    }
  }

  private async sendBatch(batch: LogEvent[], useBeacon: boolean) {
    const url = `${this.config.baseUrl}/ingest`;
    const payload = this.config.projectId
      ? JSON.stringify({ projectId: this.config.projectId, events: batch })
      : JSON.stringify(batch);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
    };

    if (this.config.projectId) {
      headers["x-project-id"] = this.config.projectId;
    }

    const requestInit: RequestInit = {
      method: "POST",
      headers,
      body: payload,
    };

    if (useBeacon) {
      requestInit.keepalive = true; // Only use keepalive for unload scenarios
    }

    const response = await fetch(url, requestInit);
    if (!response.ok) {
      throw new Error(`Ingest failed with status ${response.status}`);
    }
  }
}
