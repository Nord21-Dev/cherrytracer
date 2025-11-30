export type LogLevel = "info" | "warn" | "error" | "debug";

export interface CherryConfig {
  apiKey: string;
  projectId: string; // Required to ensure logs go to the right place
  baseUrl?: string; // Defaults to production URL or localhost
  flushInterval?: number; // ms, default 2000
  batchSize?: number; // default 50
  enabled?: boolean; // default true
  keyType?: "browser" | "server"; // Hint for runtime warnings (defaults to environment)

  // God Mode Features
  autoInstrument?: boolean; // Auto-instrument fetch calls (default: true)
  scrubSensitiveData?: boolean; // Auto-scrub sensitive data (default: true)
  sensitiveKeys?: string[]; // Custom sensitive keys to scrub (extends defaults)
  propagateTraceContext?: boolean; // Inject trace headers into fetch (default: true)
  ignoredRoutes?: (string | RegExp)[]; // Custom routes to ignore (substring or RegExp)
  disableDefaultIgnoredRoutes?: boolean; // Disable default ignored routes (Nuxt, Next, etc.)
  captureErrors?: boolean | 'passive'; // Auto-capture uncaught errors (default: true)
  exitDelayMs?: number; // Node only: delay before process exit on crash (default: 100ms)
}

export interface LogEvent {
  level?: LogLevel;
  message: string;
  data?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  timestamp?: string; // ISO string
  type?: "log" | "event";
  // Event-specific fields (populated for type: "event")
  eventType?: string;
  userId?: string;
  sessionId?: string;
  value?: number;
}

export interface StartSpanOptions {
  traceId?: string;
  parentSpanId?: string;
  attributes?: Record<string, any>;
}

export interface Span {
  id: string;
  traceId: string;
  name: string;
  parentSpanId?: string;
  end: (data?: Record<string, any>) => void;
  info: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}
