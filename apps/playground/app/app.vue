<template>
    <div class="app-root">
        <div class="container">

            <div class="header">
                <h1 class="title">Cherrytracer Sandbox</h1>
                <p class="lead">Generate chaos to test your implementation.</p>
            </div>

            <!-- Configuration -->
            <div class="card">
                <h3 class="card-title">Configuration</h3>
                <div class="row">
                    <div class="input-group">
                        <label class="label">Project ID</label>
                        <input v-model="config.projectId" placeholder="e.g. prj_123..." class="input" />
                    </div>
                    <div class="input-group">
                        <label class="label">Browser API Key (Public)</label>
                        <input v-model="config.browserApiKey" placeholder="ct_pub_..." class="input" />
                    </div>
                    <div class="input-group">
                        <label class="label">Server API Key (Secret)</label>
                        <input v-model="config.serverApiKey" placeholder="ct_sk_..." class="input" type="password" />
                    </div>
                </div>
                <div class="row" style="margin-top: 1rem; justify-content: flex-end;">
                    <button @click="init" class="btn btn-primary" :disabled="!config.browserApiKey">
                        {{ ready ? 'Re-Initialize Client' : 'Initialize Client' }}
                    </button>
                </div>
            </div>

            <div v-if="ready" class="grid">
                <!-- Manual Triggers -->
                <div class="card">
                    <h3 class="card-title">Browser Scenarios</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <button @click="sim.checkoutSuccess()" class="btn btn-success" data-tooltip="Simulates a full checkout flow with multiple spans">
                            <span>Successful Checkout</span>
                            <span class="meta">Trace + 3 Spans</span>
                        </button>

                        <button @click="sim.checkoutFail()" class="btn btn-danger" data-tooltip="Simulates a payment failure with error logging">
                            <span>Failed Payment</span>
                            <span class="meta">Trace + Error</span>
                        </button>

                        <button @click="sim.danglingSpan()" class="btn" data-tooltip="Starts a span without ending it to simulate in-flight work">
                            <span>In-Flight Span (no end)</span>
                            <span class="meta">Trace + open span</span>
                        </button>

                        <button @click="sim.triggerFatalError()" class="btn btn-danger" data-tooltip="Throws an unhandled exception to exercise the Red Button error hook">
                            <span>Simulate Fatal Error</span>
                            <span class="meta">Unhandled exception</span>
                        </button>
                    </div>
                </div>

                <!-- Business Scenarios -->
                <div class="card">
                    <h3 class="card-title">Business Scenarios</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <button @click="sim.signupFlow()" class="btn btn-primary" data-tooltip="Simulates a user signup flow with events and traces">
                            <span>User Signup Flow</span>
                            <span class="meta">Events + Trace</span>
                        </button>

                        <button @click="sim.subscriptionUpgrade()" class="btn btn-success" data-tooltip="Simulates a high-value subscription upgrade">
                            <span>Subscription Upgrade</span>
                            <span class="meta">$$$ Event</span>
                        </button>

                        <button @click="sim.enterpriseSamlLogin()" class="btn" data-tooltip="Simulates SAML login with trace + auth events">
                            <span>Enterprise SAML Login</span>
                            <span class="meta">Auth + Session</span>
                        </button>

                        <button @click="sim.billingDisputeFlow()" class="btn btn-warning" data-tooltip="Tests dispute + refund events and revenue adjustments">
                            <span>Billing Dispute & Refund</span>
                            <span class="meta">Revenue Negative/Positive</span>
                        </button>

                        <button @click="sim.fraudInvestigation()" class="btn btn-danger" data-tooltip="Flags high-risk activity and manual review">
                            <span>Fraud Investigation</span>
                            <span class="meta">Risk + Decision</span>
                        </button>
                    </div>
                </div>

                <!-- Load Testing -->
                <div class="card">
                    <h3 class="card-title">Load & Server</h3>

                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="row spaced">
                            <span class="small">Auto-Pilot (Traffic)</span>
                            <button @click="toggleAuto" :class="['toggle', { on: autoEnabled }]" data-tooltip="Automatically generates random traffic">
                                <div class="knob" />
                            </button>
                        </div>

                        <button @click="sim.burst(1000)" class="btn" data-tooltip="Fires 1000 log events in rapid succession">
                            🔥 Fire 1,000 Logs (Burst)
                        </button>

                        <button @click="triggerServerLog" :disabled="loadingServer || !config.serverApiKey" class="btn" data-tooltip="Triggers a log from the Nuxt server using the Server Key">
                            {{ loadingServer ? 'Processing...' : '☁️ Trigger Server-Side Log' }}
                        </button>
                        <p v-if="!config.serverApiKey" class="meta text-danger">Server Key required for server logs</p>
                    </div>
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

                    <div style="margin-top: 1rem;">
                        <button @click="sendDiagnosticLog" :disabled="requestPending" class="btn" data-tooltip="Sends a single manual log entry">
                            <span v-if="requestPending">Sending…</span>
                            <span v-else>📡 Send Diagnostic Event</span>
                        </button>
                    </div>

                    <div class="console">
                        <div v-if="!requestHistory.length" class="muted center">No requests yet.</div>
                        <div v-for="entry in requestHistory" :key="entry.id" class="entry">
                            <div style="flex: 1;">
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
import { Cherrytracer } from 'cherrytracer'
import { Simulator } from './utils/simulator'

const API_BASE = 'http://localhost:3000'

const config = reactive({
    projectId: '',
    browserApiKey: '',
    serverApiKey: '',
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
    if (!config.browserApiKey) return

    const logger = new Cherrytracer({
        apiKey: config.browserApiKey,
        projectId: config.projectId,
        baseUrl: API_BASE,
        batchSize: 250
    })
    sim = new Simulator(logger)
    ready.value = true
}

const toggleAuto = () => {
    autoEnabled.value = !autoEnabled.value
    sim.toggleAutoPilot(autoEnabled.value)
}

const triggerServerLog = async () => {
    if (!config.serverApiKey) return
    
    loadingServer.value = true
    try {
        // Call Nuxt server route which uses the SDK internally
        await $fetch('/api/test-log', {
            method: 'POST',
            body: { 
                apiKey: config.serverApiKey,
                projectId: config.projectId
            }
        })
        pushRequestHistory({
            id: createId(),
            status: 200,
            ok: true,
            message: 'Server log triggered successfully',
            timestamp: new Date().toISOString()
        })
    } catch (e: any) {
        pushRequestHistory({
            id: createId(),
            status: 500,
            ok: false,
            message: e.message || 'Server log failed',
            timestamp: new Date().toISOString()
        })
    } finally {
        loadingServer.value = false
    }
}

const sendDiagnosticLog = async () => {
    requestPending.value = true
    const timestamp = new Date().toISOString()
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': config.browserApiKey
        }

        if (config.projectId) {
            headers['x-project-id'] = config.projectId
        }

        const response = await fetch(`${API_BASE}/ingest`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                projectId: config.projectId,
                events: [{
                    level: 'info',
                    message: 'Manual diagnostic ping',
                    data: { source: 'playground-console' },
                    timestamp
                }]
            })
        })

        const data = await response.json().catch(() => null)

        pushRequestHistory({
            id: createId(),
            status: response.status,
            ok: response.ok,
            message: data?.error || `Queued events`,
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
