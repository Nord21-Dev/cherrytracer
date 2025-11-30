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
 * Minimal async context propagation for browsers.
 * Keeps the active span for the lifetime of an async function and wraps timers/Promise chains
 * so async/await and setTimeout-style work keep the active span.
 */
const browserContextState: {
    currentSpan?: Span;
    promiseContext: WeakMap<Promise<unknown>, Span | undefined>;
    patched: boolean;
} = {
    currentSpan: undefined,
    promiseContext: new WeakMap<Promise<unknown>, Span | undefined>(),
    patched: false,
};

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
    !!value && typeof (value as any).then === "function";

const wrapWithContext = <T extends (...args: any[]) => any>(context: Span | undefined, fn?: T) => {
    if (!fn || typeof fn !== "function") return fn;

    return function (this: any, ...args: Parameters<T>) {
        const previous = browserContextState.currentSpan;
        browserContextState.currentSpan = context;
        try {
            return fn.apply(this, args);
        } finally {
            browserContextState.currentSpan = previous;
        }
    } as T;
};

function patchBrowserAsyncHooks() {
    if (browserContextState.patched) return;
    browserContextState.patched = true;

    // Patch Promise.then to capture/restore context for async/await
    const originalThen: Promise<any>["then"] = Promise.prototype.then;
    Promise.prototype.then = function patchedThen<TResult1 = any, TResult2 = never>(
        onFulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
        const context = browserContextState.promiseContext.get(this) ?? browserContextState.currentSpan;
        const wrappedOnFulfilled = wrapWithContext(context, onFulfilled ?? undefined);
        const wrappedOnRejected = wrapWithContext(context, onRejected ?? undefined);
        const nextPromise = originalThen.call(
            this,
            wrappedOnFulfilled,
            wrappedOnRejected
        ) as Promise<TResult1 | TResult2>;

        if (context && isPromiseLike(nextPromise)) {
            browserContextState.promiseContext.set(nextPromise, context);
        }

        return nextPromise;
    };

    // Patch common async entry points to capture context at scheduling time
    const patchTimer = (name: "setTimeout" | "setInterval" | "queueMicrotask" | "requestAnimationFrame") => {
        const original = (globalThis as any)[name];
        if (typeof original !== "function") return;

        (globalThis as any)[name] = (...args: any[]) => {
            const [callback, ...rest] = args;
            const context = browserContextState.currentSpan;
            const wrappedCallback = wrapWithContext(context, callback);
            return original.call(globalThis, wrappedCallback, ...rest);
        };
    };

    patchTimer("setTimeout");
    patchTimer("setInterval");
    patchTimer("queueMicrotask");
    patchTimer("requestAnimationFrame");
}

class BrowserAsyncContext implements ContextManager {
    constructor() {
        patchBrowserAsyncHooks();
    }

    run<T>(span: Span, fn: () => T): T {
        const previous = browserContextState.currentSpan;
        browserContextState.currentSpan = span;

        let result: any;

        try {
            result = fn();
        } catch (e) {
            browserContextState.currentSpan = previous;
            throw e;
        }

        // Keep context active until the promise settles so async/await continuations
        // (which do not call Promise.then) still see the active span.
        if (isPromiseLike(result)) {
            browserContextState.promiseContext.set(result, span);
            return (result as Promise<any>).finally(() => {
                // Only restore if the current span wasn't replaced by a nested run.
                if (browserContextState.currentSpan === span) {
                    browserContextState.currentSpan = previous;
                }
            }) as any as T;
        }

        browserContextState.currentSpan = previous;
        return result;
    }

    getStore(): Span | undefined {
        return browserContextState.currentSpan;
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
            return new BrowserAsyncContext();
        }
    }

    // Browser - lightweight async-aware fallback
    return new BrowserAsyncContext();
}
