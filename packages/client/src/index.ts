import { CherryConfig, LogEvent, LogLevel, Span } from "./types";
import { generateId, getContext } from "./utils";

export class CherryTracer {
  private queue: LogEvent[] = [];
  private config: Required<CherryConfig>;
  private flushTimer: any = null;
  private baseContext: Record<string, any>;

  constructor(config: CherryConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || "http://localhost:3000",
      projectId: config.projectId || "",
      flushInterval: config.flushInterval || 2000,
      batchSize: config.batchSize || 50,
      enabled: config.enabled ?? true,
    };

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

    const batch = [...this.queue];
    this.queue = [];

    try {
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

      // Browser "Beacon" attempt for reliability on close
      if (useBeacon && typeof navigator !== "undefined" && typeof navigator.sendBeacon !== "undefined") {
        // sendBeacon doesn't allow custom headers easily with JSON, 
        // so we fallback to fetch with keepalive usually.
        // However, if we strictly need headers for Auth, fetch keepalive is the modern way.
      }

      await fetch(url, {
        method: "POST",
        keepalive: true, // Crucial for browser unload
        headers,
        body: payload,
      });
    } catch (e) {
      // Fail silently - never crash the host app
      // Optionally: console.error('Cherrytracer lost logs', e);
      // In a robust SDK, we might re-queue failed logs here up to a limit.
    }
  }
}