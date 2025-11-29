import { Cherrytracer } from './src/index';

// Mock fetch
const originalFetch = globalThis.fetch;
const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    // console.log(`[MockFetch] ${input}`);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
};
globalThis.fetch = mockFetch as any;

async function runTest() {
    console.log("--- Starting Smart Ignore Test ---");

    // 1. Test Default Behavior (Smart Ignore Enabled)
    console.log("\n1. Testing Default Behavior (Smart Ignore Enabled)");
    const tracer1 = new Cherrytracer({
        apiKey: "test_key",
        projectId: "test_project",
        autoInstrument: true,
        // disableDefaultIgnoredRoutes: false (default)
    });

    // Wait for instrumentation to apply
    await new Promise(resolve => setTimeout(resolve, 100));

    let capturedSpans1: string[] = [];
    // Monkey patch emit to capture spans
    (tracer1 as any).emit = (level: any, message: string, data: any) => {
        if (message.startsWith("Started fetch")) {
            // Message format: "Started fetch <url>"
            const url = message.replace("Started fetch ", "");
            capturedSpans1.push(url);
        }
    };

    await fetch("/_nuxt/builds/latest.json?123"); // Should be IGNORED
    await fetch("/api/users"); // Should be CAPTURED

    console.log("Captured Spans (Default):", capturedSpans1);
    if (capturedSpans1.some(url => url.includes("/_nuxt/"))) {
        console.error("FAIL: /_nuxt/ request was NOT ignored by default.");
    } else {
        console.log("PASS: /_nuxt/ request was ignored by default.");
    }
    if (!capturedSpans1.some(url => url.includes("/api/users"))) {
        console.error("FAIL: /api/users request was NOT captured.");
    } else {
        console.log("PASS: /api/users request was captured.");
    }

    // Cleanup
    (tracer1 as any).flushTimer && clearInterval((tracer1 as any).flushTimer);


    // 2. Test Disable Default Ignore
    console.log("\n2. Testing Disable Default Ignore");
    // We need to uninstrument first because it's global
    const { uninstrumentFetch } = require('./src/instrumentation');
    uninstrumentFetch();

    const tracer2 = new Cherrytracer({
        apiKey: "test_key",
        projectId: "test_project",
        autoInstrument: true,
        disableDefaultIgnoredRoutes: true,
    });

    let capturedSpans2: string[] = [];
    (tracer2 as any).emit = (level: any, message: string, data: any) => {
        if (message.startsWith("Started fetch")) {
            const url = message.replace("Started fetch ", "");
            capturedSpans2.push(url);
        }
    };

    await fetch("/_nuxt/builds/latest.json?456"); // Should be CAPTURED

    console.log("Captured Spans (Disabled Defaults):", capturedSpans2);
    if (capturedSpans2.some(url => url.includes("/_nuxt/"))) {
        console.log("PASS: /_nuxt/ request was captured when defaults disabled.");
    } else {
        console.error("FAIL: /_nuxt/ request was ignored when defaults disabled.");
    }

    // Cleanup
    (tracer2 as any).flushTimer && clearInterval((tracer2 as any).flushTimer);


    // 3. Test Custom Ignore
    console.log("\n3. Testing Custom Ignore");
    uninstrumentFetch();

    const tracer3 = new Cherrytracer({
        apiKey: "test_key",
        projectId: "test_project",
        autoInstrument: true,
        ignoredRoutes: ["/custom-ignore", /regex-ignore/],
    });

    let capturedSpans3: string[] = [];
    (tracer3 as any).emit = (level: any, message: string, data: any) => {
        if (message.startsWith("Started fetch")) {
            const url = message.replace("Started fetch ", "");
            capturedSpans3.push(url);
        }
    };

    await fetch("/custom-ignore/resource"); // Should be IGNORED
    await fetch("/regex-ignore/resource"); // Should be IGNORED
    await fetch("/api/data"); // Should be CAPTURED

    console.log("Captured Spans (Custom):", capturedSpans3);
    if (capturedSpans3.some(url => url.includes("/custom-ignore"))) {
        console.error("FAIL: /custom-ignore request was NOT ignored.");
    } else {
        console.log("PASS: /custom-ignore request was ignored.");
    }
    if (capturedSpans3.some(url => url.includes("/regex-ignore"))) {
        console.error("FAIL: /regex-ignore request was NOT ignored.");
    } else {
        console.log("PASS: /regex-ignore request was ignored.");
    }


    console.log("\n--- Test Complete ---");
    // Restore original fetch
    globalThis.fetch = originalFetch;
}

runTest().catch(console.error);
