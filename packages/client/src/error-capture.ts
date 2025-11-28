import type { Cherrytracer } from "./index";

interface ErrorCaptureConfig {
    enabled: boolean | 'passive';
    exitDelayMs: number;
}

// Track captured errors to prevent infinite loops
const capturedErrors = new WeakSet<Error>();
const capturedMessages = new Set<string>();
const MAX_MESSAGE_CACHE = 50;

/**
 * Main entry point - detects runtime and sets up appropriate error handlers
 */
export function setupErrorCapture(tracer: Cherrytracer, config: ErrorCaptureConfig) {
    if (config.enabled === false) return;

    try {
        if (typeof window !== 'undefined') {
            setupBrowserErrorCapture(tracer, config);
        } else if (typeof process !== 'undefined') {
            setupNodeErrorCapture(tracer, config);
        }
    } catch (e) {
        // Never throw in error setup - fail silently
        console.warn('[Cherrytracer] Failed to setup error capture:', e);
    }
}

/**
 * Browser: Register window.onerror and window.onunhandledrejection
 */
function setupBrowserErrorCapture(tracer: Cherrytracer, config: ErrorCaptureConfig) {
    // Check if handlers already exist (passive mode)
    const hasExistingHandlers = window.onerror !== null || window.onunhandledrejection !== null;

    if (config.enabled === 'passive' && hasExistingHandlers) {
        return; // Respect existing handlers in passive mode
    }

    // Save existing handlers for defensive chaining
    const existingOnError = window.onerror;
    const existingOnRejection = window.onunhandledrejection;

    // Register window.onerror
    window.onerror = function (message, source, lineno, colno, error) {
        try {
            // Call existing handler first (defensive chaining)
            if (existingOnError) {
                existingOnError.call(window, message, source, lineno, colno, error);
            }

            // Capture to Cherrytracer
            const errorObj = error || new Error(String(message));
            captureCriticalError(tracer, errorObj, {
                source,
                lineno,
                colno,
                type: 'onerror'
            });

            // Use sendBeacon for critical flush
            attemptFinalFlush(tracer);
        } catch (e) {
            // Never throw in error handler
            console.error('[Cherrytracer] Error in error handler:', e);
        }

        // Don't suppress default error behavior
        return false;
    };

    // Register window.onunhandledrejection
    window.onunhandledrejection = function (event) {
        try {
            // Call existing handler first
            if (existingOnRejection) {
                existingOnRejection.call(window, event);
            }

            // Capture to Cherrytracer
            const reason = event.reason;
            const errorObj = reason instanceof Error ? reason : new Error(String(reason));

            captureCriticalError(tracer, errorObj, {
                type: 'unhandledrejection',
                promise: true
            });

            // Use sendBeacon for critical flush
            attemptFinalFlush(tracer);
        } catch (e) {
            console.error('[Cherrytracer] Error in rejection handler:', e);
        }
    };
}

/**
 * Node: Register process error handlers
 */
function setupNodeErrorCapture(tracer: Cherrytracer, config: ErrorCaptureConfig) {
    // Check for existing handlers (passive mode)
    const hasExistingHandlers = process.listenerCount('uncaughtException') > 0 ||
        process.listenerCount('unhandledRejection') > 0;

    if (config.enabled === 'passive' && hasExistingHandlers) {
        return; // Respect existing handlers in passive mode
    }

    // Register uncaughtException handler
    process.on('uncaughtException', (error, origin) => {
        try {
            captureCriticalError(tracer, error, {
                type: 'uncaughtException',
                origin
            });

            // Attempt synchronous flush before exit
            attemptSyncFlush(tracer);

            // Delay exit to allow async flush to complete
            setTimeout(() => {
                process.exit(1);
            }, config.exitDelayMs);
        } catch (e) {
            console.error('[Cherrytracer] Error in uncaughtException handler:', e);
            process.exit(1);
        }
    });

    // Register unhandledRejection handler
    process.on('unhandledRejection', (reason, promise) => {
        try {
            const errorObj = reason instanceof Error ? reason : new Error(String(reason));

            captureCriticalError(tracer, errorObj, {
                type: 'unhandledRejection',
                promise: true
            });

            // Flush but don't exit (Node doesn't exit on unhandled rejections by default)
            attemptSyncFlush(tracer);
        } catch (e) {
            console.error('[Cherrytracer] Error in unhandledRejection handler:', e);
        }
    });
}

/**
 * Capture critical error to tracer with rich metadata
 */
function captureCriticalError(
    tracer: Cherrytracer,
    error: Error | any,
    context?: Record<string, any>
) {
    // Deduplication: prevent capturing the same error multiple times
    if (error instanceof Error) {
        if (capturedErrors.has(error)) return;
        capturedErrors.add(error);
    } else {
        const messageKey = String(error);
        if (capturedMessages.has(messageKey)) return;
        capturedMessages.add(messageKey);

        // Limit cache size to prevent memory leaks
        if (capturedMessages.size > MAX_MESSAGE_CACHE) {
            const firstKey = capturedMessages.values().next().value;
            if (firstKey !== undefined) {
                capturedMessages.delete(firstKey);
            }
        }
    }

    // Extract error details
    const errorMessage = error instanceof Error ? (error.message || 'Unknown Error') : String(error);
    const stackTrace = extractStackTrace(error);

    // Build rich error data
    const errorData: Record<string, any> = {
        error_source: 'auto_captured',
        error_type: error?.constructor?.name || 'Error',
        stack_trace: stackTrace,
        ...context,
    };

    // Add error properties if available
    if (error instanceof Error) {
        errorData.error_name = error.name;
        if ((error as any).code) errorData.error_code = (error as any).code;
        if ((error as any).errno) errorData.error_errno = (error as any).errno;
    }

    // Log as CRITICAL error (uses public .error() method)
    tracer.error(`[CRITICAL] ${errorMessage}`, errorData);
}

/**
 * Extract stack trace from error
 */
function extractStackTrace(error: any): string[] {
    if (!error) return [];

    if (error instanceof Error && error.stack) {
        return error.stack
            .split('\n')
            .slice(1) // Skip first line (error message)
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
    }

    if (typeof error.stack === 'string') {
        return error.stack.split('\n').map((line: string) => line.trim());
    }

    return [];
}

/**
 * Browser: Attempt final flush using sendBeacon or fetch with keepalive
 */
function attemptFinalFlush(tracer: Cherrytracer) {
    if (typeof window === 'undefined') return;

    try {
        // Trigger async flush with keepalive
        tracer.flush(true);
    } catch (e) {
        console.error('[Cherrytracer] Failed to flush on error:', e);
    }
}

/**
 * Node: Attempt synchronous flush (blocking)
 */
function attemptSyncFlush(tracer: Cherrytracer) {
    if (typeof process === 'undefined') return;

    try {
        // Flush immediately (async but we wait via setTimeout in caller)
        tracer.flush(false);
    } catch (e) {
        console.error('[Cherrytracer] Failed to flush on error:', e);
    }
}
