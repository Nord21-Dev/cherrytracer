export type LogLevel = "info" | "warn" | "error" | "debug";

export interface CherryConfig {
  apiKey: string;
  projectId: string; // Required to ensure logs go to the right place
  baseUrl?: string; // Defaults to production URL or localhost
  flushInterval?: number; // ms, default 2000
  batchSize?: number; // default 50
  enabled?: boolean; // default true
  keyType?: "browser" | "server"; // Hint for runtime warnings (defaults to environment)
}

export interface LogEvent {
  level: LogLevel;
  message: string;
  data?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  timestamp?: string; // ISO string
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
