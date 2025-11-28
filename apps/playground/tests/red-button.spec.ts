/// <reference types="vitest" />
/// <reference types="node" />

import { Cherrytracer } from 'cherrytracer'

const flushMicrotasks = () => Promise.resolve()

describe('Red Button Error Hook', () => {
    let originalFetch: typeof globalThis.fetch | undefined
    let originalUncaught: Function[] = []
    let originalUnhandled: Function[] = []

    beforeEach(() => {
        originalFetch = global.fetch
        originalUncaught = process.listeners('uncaughtException')
        originalUnhandled = process.listeners('unhandledRejection')
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
        vi.restoreAllMocks()

        if (originalFetch) {
            global.fetch = originalFetch
        }

        process.removeAllListeners('uncaughtException')
        process.removeAllListeners('unhandledRejection')
        for (const listener of originalUncaught) {
            process.on('uncaughtException', listener as any)
        }
        for (const listener of originalUnhandled) {
            process.on('unhandledRejection', listener as any)
        }
    })

    it('captures uncaught exceptions, flushes, and triggers exit delay', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true })
        global.fetch = fetchMock as any

        const tracer = new Cherrytracer({
            apiKey: 'ct_pub_test',
            projectId: 'prj_test',
            baseUrl: 'http://localhost:5999',
            captureErrors: true,
            exitDelayMs: 25,
        })

        const errorSpy = vi.spyOn(tracer as any, 'error')
        const flushSpy = vi.spyOn(tracer as any, 'flush').mockResolvedValue()
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any)

        const boom = new Error('Playground crash')

        const latestListener = process.listeners('uncaughtException')
            .find((listener) => !originalUncaught.includes(listener))

        expect(latestListener).toBeTypeOf('function')

        await (latestListener as (err: Error, origin: string) => Promise<void> | void)(boom, 'uncaughtException')

    expect(errorSpy).toHaveBeenCalledTimes(1)
        expect(errorSpy.mock.calls[0][0]).toContain('[CRITICAL] Playground crash')
        expect(errorSpy.mock.calls[0][1]).toMatchObject({
            error_source: 'auto_captured',
            error_type: 'Error',
            type: 'uncaughtException',
            origin: 'uncaughtException'
        })

    await flushMicrotasks()
        expect(flushSpy).toHaveBeenCalled()

        vi.advanceTimersByTime(30)
        expect(exitSpy).toHaveBeenCalledWith(1)
    })
})
