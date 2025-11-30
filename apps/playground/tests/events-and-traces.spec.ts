/// <reference types="vitest" />
/// <reference types="node" />

import { Cherrytracer } from 'cherrytracer';

describe('Playground Examples', () => {
    let originalFetch: typeof globalThis.fetch | undefined;
    let tracer: Cherrytracer | undefined;
    let fetchMock: ReturnType<typeof vi.fn>;

    const createTracer = () => new Cherrytracer({
        apiKey: 'ct_pub_test',
        projectId: 'prj_test',
        baseUrl: 'http://localhost:5999',
        batchSize: 10,
        flushInterval: 10_000,
        autoInstrument: false,
        captureErrors: false,
        propagateTraceContext: false,
    });

    beforeEach(() => {
        originalFetch = global.fetch;
        fetchMock = vi.fn().mockResolvedValue({ ok: true });
        global.fetch = fetchMock as any;
        vi.useFakeTimers();
    });

    afterEach(() => {
        if (tracer) {
            clearInterval((tracer as any).flushTimer);
        }
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (originalFetch) {
            global.fetch = originalFetch;
        }
    });

    it('ships business events with analytics fields intact', async () => {
        tracer = createTracer();

        tracer.track('signup_completed', {
            eventType: 'conversion',
            userId: 'u_123',
            sessionId: 'sess_abc',
            value: 199,
            plan: 'pro_annual',
        });

        await tracer.flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        expect(payload).toMatchObject({ projectId: 'prj_test' });
        expect(payload.events).toHaveLength(1);

        const event = payload.events[0];
        expect(event.type).toBe('event');
        expect(event.level).toBeUndefined();
        expect(event.message).toBe('signup_completed');
        expect(event.eventType).toBe('conversion');
        expect(event.userId).toBe('u_123');
        expect(event.sessionId).toBe('sess_abc');
        expect(event.value).toBe(199);
        expect(event.data.plan).toBe('pro_annual');
    });

    it('propagates trace context across start/end and child logs', async () => {
        tracer = createTracer();

        await tracer.trace('outer_operation', (span) => {
            span.info('step-one', { step: 1 });
        });

        await tracer.flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
        const events = payload.events;
        expect(events.length).toBe(3); // start, info, end

        const traceIds = new Set(events.map((e: any) => e.traceId));
        const spanIds = new Set(events.map((e: any) => e.spanId));
        expect(traceIds.size).toBe(1);
        expect(spanIds.size).toBe(1);

        const start = events.find((e: any) => e.data?.span_event === 'start');
        const info = events.find((e: any) => e.message === 'step-one');
        const end = events.find((e: any) => e.data?.span_event === 'end');

        expect(start?.message).toContain('Started outer_operation');
        expect(info?.traceId).toBe(start?.traceId);
        expect(info?.spanId).toBe(start?.spanId);
        expect(end?.data?.duration_ms).toBeGreaterThanOrEqual(0);
    });
});
