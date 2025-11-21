<template>
    <div class="app-root">
        <div class="container">

            <div class="header">
                <h1 class="title">Cherrytracer Sandbox</h1>
                <p class="lead">Generate chaos to test your implementation.</p>
            </div>

            <!-- Configuration -->
            <div class="card">
                <div class="row">
                    <input v-model="config.projectId" placeholder="Project ID" class="input" />
                    <input v-model="config.apiKey" placeholder="API Key" class="input" />
                </div>
                <button @click="init" class="btn btn-primary">Initialize Client</button>
            </div>

            <div v-if="ready" class="grid">
                <!-- Manual Triggers -->
                <div class="card">
                    <h3 class="card-title">Scenarios</h3>

                    <button @click="sim.checkoutSuccess()" class="btn btn-success">
                        <span>Successful Checkout</span>
                        <span class="meta">Trace + 3 Spans</span>
                    </button>

                    <button @click="sim.checkoutFail()" class="btn btn-danger">
                        <span>Failed Payment</span>
                        <span class="meta">Trace + Error</span>
                    </button>
                </div>

                <!-- Load Testing -->
                <div class="card">
                    <h3 class="card-title">Load & Server</h3>

                    <div class="row spaced">
                        <span class="small">Auto-Pilot (Traffic)</span>
                        <button @click="toggleAuto" :class="['toggle', { on: autoEnabled }]">
                            <div class="knob" />
                        </button>
                    </div>

                    <button @click="sim.burst(1000)" class="btn">🔥 Fire 1,000 Logs (Burst)</button>

                    <button @click="triggerServerLog" :disabled="loadingServer" class="btn">
                        {{ loadingServer ? 'Processing...' : '☁️ Trigger Server-Side Log' }}
                    </button>
                </div>

                <!-- Request Console -->
                <div class="card full">
                    <div class="row between">
                        <div>
                            <h3 class="card-title">Request Console</h3>
                            <p class="small muted">Send a diagnostic log and inspect recent responses.</p>
                        </div>
                        <div v-if="latestRequest" class="right small">
                            <p class="muted">Last Response</p>
                            <p :class="latestRequest.ok ? 'text-success' : 'text-danger'" class="strong">
                                {{ latestRequest.ok ? 'OK' : 'Error' }} · {{ latestRequest.status || '—' }}
                            </p>
                        </div>
                    </div>

                    <button @click="sendDiagnosticLog" :disabled="requestPending" class="btn">
                        <span v-if="requestPending">Sending…</span>
                        <span v-else>📡 Send Diagnostic Event</span>
                    </button>

                    <div class="console">
                        <div v-if="!requestHistory.length" class="muted center">No requests yet.</div>
                        <div v-for="entry in requestHistory" :key="entry.id" class="entry">
                            <div>
                                <p :class="entry.ok ? 'text-success' : 'text-danger'" class="strong">
                                    {{ entry.status || '—' }} · {{ entry.ok ? 'SUCCESS' : 'FAILED' }}
                                </p>
                                <p class="muted">{{ entry.message }}</p>
                            </div>
                            <span class="muted nowrap">{{ formatTimestamp(entry.timestamp) }}</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup lang="ts">
import { CherryTracer } from 'cherrytracer'
import { Simulator } from './utils/simulator'

const API_BASE = 'http://localhost:3000'

const config = reactive({
    projectId: '',
    apiKey: '',
})

const ready = ref(false)
const autoEnabled = ref(false)
const loadingServer = ref(false)
const requestPending = ref(false)
const requestHistory = ref<{ id: string; status: number; ok: boolean; message: string; timestamp: string }[]>([])
const latestRequest = computed(() => requestHistory.value[0])
let sim: Simulator

const createId = () =>
(typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2))

const init = () => {
    const logger = new CherryTracer({
        apiKey: config.apiKey,
        projectId: config.projectId,
        baseUrl: API_BASE
    })
    sim = new Simulator(logger)
    ready.value = true
}

const toggleAuto = () => {
    autoEnabled.value = !autoEnabled.value
    sim.toggleAutoPilot(autoEnabled.value)
}

const triggerServerLog = async () => {
    loadingServer.value = true
    // Call Nuxt server route which uses the SDK internally
    await $fetch('/api/test-log', {
        method: 'POST',
        body: { apiKey: config.apiKey }
    })
    loadingServer.value = false
}

const sendDiagnosticLog = async () => {
    requestPending.value = true
    const timestamp = new Date().toISOString()
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey
        }

        if (config.projectId) {
            headers['x-project-id'] = config.projectId
        }

        const response = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId: config.projectId,
                events: {
                    level: 'info',
                    message: 'Manual diagnostic ping',
                    data: { source: 'playground-console' },
                    timestamp
                }
            })
        })

        const data = await response.json().catch(() => null)

        pushRequestHistory({
            id: createId(),
            status: response.status,
            ok: response.ok,
            message: data?.error || `Queued ${data?.queued ?? 0} events`,
            timestamp
        })
    } catch (error: any) {
        pushRequestHistory({
            id: createId(),
            status: 0,
            ok: false,
            message: error?.message || 'Request failed',
            timestamp
        })
    } finally {
        requestPending.value = false
    }
}

const pushRequestHistory = (entry: { id: string; status: number; ok: boolean; message: string; timestamp: string }) => {
    requestHistory.value.unshift(entry)
    requestHistory.value = requestHistory.value.slice(0, 5)
}

const formatTimestamp = (ts: string) => new Date(ts).toLocaleTimeString()
</script>