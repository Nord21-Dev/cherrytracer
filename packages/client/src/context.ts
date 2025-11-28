import type { Span } from "./types";

/**
 * Universal Context Manager
 * Abstracts AsyncLocalStorage for Node/Bun and provides a fallback for browsers
 */
export interface ContextManager {
    run<T>(span: Span, fn: () => T): T;
    getStore(): Span | undefined;
    isAvailable(): boolean;
}

/**
 * AsyncLocalStorage-based context (Node/Bun)
 */
class AsyncStorageContext implements ContextManager {
    private storage: any;

    constructor(storage: any) {
        this.storage = storage;
    }

    run<T>(span: Span, fn: () => T): T {
        return this.storage.run(span, fn);
    }

    getStore(): Span | undefined {
        return this.storage.getStore();
    }

    isAvailable(): boolean {
        return true;
    }
}

/**
 * Synchronous stack-based context (Browser fallback)
 * Works for synchronous code and Promise chains but NOT across setTimeout/setInterval
 */
class SyncStackContext implements ContextManager {
    private stack: Span[] = [];

    run<T>(span: Span, fn: () => T): T {
        this.stack.push(span);
        try {
            return fn();
        } finally {
            this.stack.pop();
        }
    }

    getStore(): Span | undefined {
        return this.stack[this.stack.length - 1];
    }

    isAvailable(): boolean {
        return true;
    }
}

/**
 * No-op context (when context propagation is disabled)
 */
class NoOpContext implements ContextManager {
    run<T>(_span: Span, fn: () => T): T {
        return fn();
    }

    getStore(): Span | undefined {
        return undefined;
    }

    isAvailable(): boolean {
        return false;
    }
}

/**
 * Create the appropriate context manager for the current environment
 */
export function createContextManager(): ContextManager {
    // Node/Bun - use AsyncLocalStorage
    if (typeof window === "undefined") {
        try {
            // @ts-ignore - Dynamic require for Node environments
            const { AsyncLocalStorage } = require("node:async_hooks");
            return new AsyncStorageContext(new AsyncLocalStorage());
        } catch (e) {
            // Fallback if async_hooks not available
            return new SyncStackContext();
        }
    }

    // Browser - use synchronous stack
    // Note: This works well for Promise chains but not for setTimeout/setInterval
    return new SyncStackContext();
}
