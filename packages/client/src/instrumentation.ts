import type { Cherrytracer } from "./index";

/**
 * Fetch Auto-Instrumentation
 * Automatically wraps fetch calls in spans and injects trace headers
 */

// Store the original fetch
let originalFetch: typeof fetch | null = null;

/**
 * Generate W3C Trace Context traceparent header
 * Format: 00-{trace-id}-{parent-id}-{trace-flags}
 */
function generateTraceparent(traceId: string, spanId: string): string {
    // Ensure IDs are properly formatted (32 hex for trace, 16 hex for span)
    const paddedTraceId = traceId.padEnd(32, '0').slice(0, 32);
    const paddedSpanId = spanId.padEnd(16, '0').slice(0, 16);

    return `00-${paddedTraceId}-${paddedSpanId}-01`;
}

/**
 * Get URL string from fetch input
 */
function getUrlString(input: RequestInfo | URL): string {
    if (typeof input === 'string') {
        return input;
    }
    if (input instanceof URL) {
        return input.toString();
    }
    if (input instanceof Request) {
        return input.url;
    }
    return String(input);
}

function shouldSkipInstrumentation(url: string, baseUrl: string): boolean {
    if (!baseUrl) return false;

    const ingestEndpoint = `${baseUrl}/ingest`;
    return url === ingestEndpoint;
}

/**
 * Instrument fetch to automatically create spans and inject trace headers
 */
export function instrumentFetch(tracer: Cherrytracer) {
    // Check if fetch is available
    if (typeof globalThis.fetch !== 'function') {
        return; // Fetch not available in this environment
    }

    // Save original fetch
    originalFetch = globalThis.fetch.bind(globalThis);

    // Replace with instrumented version
    (globalThis.fetch as any) = async function instrumentedFetch(
        input: RequestInfo | URL,
        init?: RequestInit
    ): Promise<Response> {
        const url = getUrlString(input);
        const baseUrl = (tracer as any).config.baseUrl;

        if (shouldSkipInstrumentation(url, baseUrl)) {
            // Avoid instrumenting our own ingest calls to prevent recursive logging
            return originalFetch!(input, init);
        }

        // Wrap in a trace span
        return tracer.trace(`fetch ${url}`, async (span) => {
            try {
                // Inject trace context headers if enabled
                const headers = new Headers(init?.headers);

                // Only inject if propagateTraceContext is enabled
                if ((tracer as any).config.propagateTraceContext) {
                    headers.set('traceparent', generateTraceparent(span.traceId, span.id));
                    // Optional: Add tracestate for vendor-specific data
                    // headers.set('tracestate', `cherrytracer=${span.traceId}`);
                }

                // Make the actual fetch call
                const startTime = Date.now();
                const response = await originalFetch!(input, {
                    ...init,
                    headers,
                });
                const duration = Date.now() - startTime;

                // Log fetch metadata
                const method = (init?.method || 'GET').toUpperCase();
                span.info(`${method} ${url}`, {
                    url,
                    method,
                    status: response.status,
                    statusText: response.statusText,
                    duration_ms: duration,
                    ok: response.ok,
                });

                return response;
            } catch (error) {
                // Log fetch error
                span.error('fetch failed', {
                    url,
                    method: init?.method || 'GET',
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error;
            }
        }) as Promise<Response>;
    };
}

/**
 * Restore original fetch (for testing/cleanup)
 */
export function uninstrumentFetch() {
    if (originalFetch) {
        globalThis.fetch = originalFetch;
        originalFetch = null;
    }
}
