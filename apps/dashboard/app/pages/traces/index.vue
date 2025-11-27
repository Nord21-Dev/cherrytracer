<template>
    <UContainer class="py-8 space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-2xl font-semibold text-neutral-900 dark:text-white">Service Health</h2>
                <p class="text-sm text-neutral-500">Performance metrics by operation (Last 24h)</p>
            </div>
            <div class="flex items-center gap-4">
                <USwitch v-model="showProblemsOnly" label="Show problems only" />
                <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="pending" @click="() => refresh()" />
            </div>
        </div>

        <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <USkeleton v-for="i in 6" :key="i" class="h-40 rounded-xl bg-neutral-100 dark:bg-neutral-900" />
        </div>

        <div v-else-if="!sortedGroups.length" class="text-center py-20">
            <div class="p-4 rounded-full bg-neutral-100 dark:bg-neutral-900 inline-block mb-4">
                <UIcon name="i-lucide-activity" class="size-8 text-neutral-400" />
            </div>
            <h3 class="text-lg font-medium text-neutral-900 dark:text-white">
                {{ showProblemsOnly ? 'No Problems Found' : 'No Trace Data' }}
            </h3>
            <p class="text-neutral-500 mt-1">
                {{ showProblemsOnly ? 'All systems are operating normally.' : 'Waiting for spans with "end" events...' }}
            </p>
        </div>

        <TransitionGroup 
            v-else 
            tag="div" 
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
            move-class="transition duration-500 ease-in-out"
        >
            <UCard
                v-for="group in sortedGroups"
                :key="group.name"
                :ui="{ body: 'p-0 sm:p-0' }"
                :class="[
                    'overflow-hidden transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 border',
                    group.healthStatus === 'critical' 
                        ? 'bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-900 hover:ring-2 hover:ring-red-500/20' 
                        : group.healthStatus === 'warning'
                            ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900 hover:ring-2 hover:ring-amber-500/20'
                            : 'hover:ring-2 hover:ring-neutral-500/20 border-neutral-100 dark:border-neutral-800'
                ]"
                role="button"
                tabindex="0"
                @click="openSpanDetails(group.name, group)"
                @keydown.enter.stop.prevent="openSpanDetails(group.name, group)"
            >
                <div class="p-4 border-b" :class="[
                    group.healthStatus === 'critical' ? 'border-red-100 dark:border-red-900/50' :
                    group.healthStatus === 'warning' ? 'border-amber-100 dark:border-amber-900/50' :
                    'border-neutral-100 dark:border-neutral-800'
                ]">
                    <div class="flex items-start justify-between mb-2">
                        <h3 class="font-medium text-sm text-neutral-900 dark:text-white truncate pr-4" :title="group.name">
                            {{ group.name }}
                        </h3>
                        <div class="flex items-center gap-2">
                            <UBadge v-if="group.errorRate > 0" variant="subtle" size="xs" color="error">
                                {{ group.errorRate }}% err
                            </UBadge>
                            <UBadge variant="subtle" size="xs" color="neutral">
                                {{ group.rpm }} rpm
                            </UBadge>
                        </div>
                    </div>
                    <div class="flex items-baseline gap-3">
                        <div class="flex items-baseline gap-1">
                            <span class="text-2xl font-bold font-mono" :class="[
                                group.healthStatus === 'critical' ? 'text-red-600 dark:text-red-400' :
                                group.healthStatus === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                                'text-neutral-900 dark:text-white'
                            ]">{{ group.avgLatency }}</span>
                            <span class="text-xs text-neutral-500">ms avg</span>
                        </div>
                        
                        <div v-if="group.trend !== 0" class="flex items-center text-xs font-medium" :class="[
                            group.trend > 0 
                                ? (group.trend > 20 ? 'text-red-500' : 'text-amber-500') 
                                : 'text-green-500'
                        ]">
                            <UIcon :name="group.trend > 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'" class="w-3 h-3 mr-0.5" />
                            {{ Math.abs(group.trend) }}%
                        </div>
                    </div>
                </div>
                
                <div class="h-20 w-full" :class="[
                    group.healthStatus === 'critical' ? 'bg-red-50/30 dark:bg-red-900/5' :
                    group.healthStatus === 'warning' ? 'bg-amber-50/30 dark:bg-amber-900/5' :
                    'bg-neutral-50/50 dark:bg-neutral-900/50'
                ]">
                    <VizTraceSparkline 
                        :data="group.history" 
                        :color="group.healthStatus === 'critical' ? '#ef4444' : group.healthStatus === 'warning' ? '#f59e0b' : '#3b82f6'"
                    />
                </div>
            </UCard>
        </TransitionGroup>
    </UContainer>

    <USlideover 
        v-model:open="isDetailsOpen" 
        side="right" 
        modal 
        :ui="{ 
            header: 'p-0 sm:px-0',
            body: 'p-6'
        }"
    >
        <template #header>
            <div 
                v-if="selectedSpan"
                class="p-6 border-b border-neutral-100 dark:border-neutral-800 w-full"
                :class="[
                    selectedSpan.group.healthStatus === 'critical' ? 'bg-red-50/50 dark:bg-red-950/20' :
                    selectedSpan.group.healthStatus === 'warning' ? 'bg-amber-50/50 dark:bg-amber-950/20' :
                    'bg-white dark:bg-neutral-900'
                ]"
            >
                <div class="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <p class="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-500">Span Details</p>
                            <UBadge 
                                v-if="selectedSpan.group.healthStatus !== 'healthy'"
                                size="xs" 
                                variant="soft" 
                                :color="selectedSpan.group.healthStatus === 'critical' ? 'error' : 'warning'"
                            >
                                {{ selectedSpan.group.healthStatus.toUpperCase() }}
                            </UBadge>
                        </div>
                        <h3 class="text-xl font-bold text-neutral-900 dark:text-white break-all">{{ selectedSpan.name }}</h3>
                    </div>
                    <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="isDetailsOpen = false" />
                </div>

                <!-- Performance HUD -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-3 rounded-lg bg-white/50 dark:bg-neutral-950/50 border border-neutral-200/50 dark:border-neutral-800/50">
                        <p class="text-xs text-neutral-500 dark:text-neutral-500 mb-1">Avg Latency</p>
                        <div class="flex items-baseline gap-2">
                            <span class="text-xl font-bold text-neutral-900 dark:text-white">{{ selectedSpan.group.avgLatency }}ms</span>
                            <span v-if="selectedSpan.group.trend !== 0" class="text-xs font-medium" :class="[
                                selectedSpan.group.trend > 0 ? 'text-red-500' : 'text-green-500'
                            ]">
                                {{ selectedSpan.group.trend > 0 ? '↗' : '↘' }} {{ Math.abs(selectedSpan.group.trend) }}%
                            </span>
                        </div>
                    </div>
                    <div class="p-3 rounded-lg bg-white/50 dark:bg-neutral-950/50 border border-neutral-200/50 dark:border-neutral-800/50">
                        <p class="text-xs text-neutral-500 dark:text-neutral-500 mb-1">Error Rate</p>
                        <div class="flex items-baseline gap-2">
                            <span class="text-xl font-bold" :class="selectedSpan.group.errorRate > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-900 dark:text-white'">
                                {{ selectedSpan.group.errorRate }}%
                            </span>
                            <span class="text-xs text-neutral-400">of reqs</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-lg bg-white/50 dark:bg-neutral-950/50 border border-neutral-200/50 dark:border-neutral-800/50">
                        <p class="text-xs text-neutral-500 dark:text-neutral-500 mb-1">Throughput</p>
                        <div class="flex items-baseline gap-2">
                            <span class="text-xl font-bold text-neutral-900 dark:text-white">{{ selectedSpan.group.rpm }}</span>
                            <span class="text-xs text-neutral-400">rpm</span>
                        </div>
                    </div>
                    <div class="p-3 rounded-lg bg-white/50 dark:bg-neutral-950/50 border border-neutral-200/50 dark:border-neutral-800/50">
                        <p class="text-xs text-neutral-500 dark:text-neutral-500 mb-1">Total Reqs</p>
                        <div class="flex items-baseline gap-2">
                            <span class="text-xl font-bold text-neutral-900 dark:text-white">{{ selectedSpan.group.totalReqs }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <template #body>
            <div v-if="!selectedSpan || traceSamplesStatus === 'pending'" class="space-y-4">
                <USkeleton class="h-32 rounded-xl" />
                <USkeleton class="h-8 w-full rounded-lg" />
                <div class="space-y-3">
                    <USkeleton v-for="i in 3" :key="i" class="h-16 rounded-xl" />
                </div>
            </div>

            <div v-else-if="traceSamplesStatus === 'error'" class="space-y-4 text-center py-6">
                <p class="text-sm text-neutral-600 dark:text-neutral-400">{{ traceSamplesError }}</p>
                <UButton label="Retry" color="primary" variant="ghost" size="sm" @click="retryTraceSamples" />
            </div>

            <div v-else class="space-y-6">
                <!-- Sparkline Context -->
                <section>
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                            24h Trend
                        </h4>
                        <div class="text-xs text-neutral-400">
                            Min: {{ historyStats.min }}ms • Max: {{ historyStats.max }}ms
                        </div>
                    </div>
                    <div class="h-[82px] w-full bg-neutral-50/50 dark:bg-neutral-900/50 rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                        <VizTraceSparkline 
                            :data="selectedSpan.group.history" 
                            :color="selectedSpan.group.healthStatus === 'critical' ? '#ef4444' : selectedSpan.group.healthStatus === 'warning' ? '#f59e0b' : '#3b82f6'"
                        />
                    </div>
                </section>

                <!-- Smart Investigator Tabs -->
                <section class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-semibold text-neutral-900 dark:text-white">Investigate Traces</h4>
                    </div>

                    <UTabs 
                        v-model="selectedTab"
                        :items="tabItems" 
                        class="w-full"
                    />

                    <div v-if="!activeSamples.length" class="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 p-8 text-center">
                        <p class="text-sm text-neutral-500 dark:text-neutral-400">
                            {{ selectedTab === 'errors' ? 'No error traces found in recent samples.' : 'No traces available.' }}
                        </p>
                    </div>

                    <ul v-else class="space-y-2">
                        <li
                            v-for="sample in activeSamples"
                            :key="sample.traceId"
                            class="group flex items-start justify-between gap-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 hover:border-primary-500/50 hover:ring-1 hover:ring-primary-500/50 transition-all cursor-pointer"
                            @click="navigateToTrace(sample.traceId)"
                        >
                            <div class="flex-1 min-w-0 space-y-1">
                                <div class="flex items-center gap-2">
                                    <UBadge size="xs" variant="soft" :color="sample.status === 'error' ? 'error' : 'success'">
                                        {{ sample.status === 'error' ? 'Error' : 'Success' }}
                                    </UBadge>
                                    <span class="text-xs text-neutral-500 dark:text-neutral-500">
                                        {{ formatRelative(sample.latestTimestamp) }}
                                    </span>
                                </div>
                                <p class="font-mono text-xs text-neutral-600 dark:text-neutral-400 truncate mt-1">
                                    {{ sample.traceId }}
                                </p>
                                <p v-if="sample.duration" class="text-xs text-neutral-500 mt-0.5">
                                    Duration: {{ sample.duration }}ms
                                </p>
                            </div>
                            <div class="flex items-center">
                                <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-neutral-300 group-hover:text-primary-500 transition-colors" />
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

const { selectedProjectId } = useProjectState()
const { fetchApi } = useCherryApi()

type SpanMetricApi = {
    time_bucket: string | number | Date
    span_name: string | null
    avg_latency: number
    throughput: number
    error_count?: number
    success_count?: number
}

type SpanPoint = {
    timestamp: number
    rawTime: string
    spanName: string
    avgLatency: number
    throughput: number
    errorCount: number
    successCount: number
}

type HealthStatus = 'critical' | 'warning' | 'healthy'

interface SpanGroup {
    name: string
    history: SpanPoint[]
    avgLatency: number
    totalReqs: number
    totalErrors: number
    errorRate: number
    rpm: number
    trend: number
    healthStatus: HealthStatus
}

const showProblemsOnly = ref(false)

const normalizeTimestamp = (value: string | number | Date) => {
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'number') return value

    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : NaN
}

const toSpanPoint = (entry: SpanMetricApi): SpanPoint | null => {
    const timestamp = normalizeTimestamp(entry.time_bucket)
    if (!Number.isFinite(timestamp)) return null

    return {
        timestamp,
        rawTime: entry.time_bucket instanceof Date ? entry.time_bucket.toISOString() : String(entry.time_bucket),
        spanName: entry.span_name || 'Unknown Operation',
        avgLatency: entry.avg_latency ?? 0,
        throughput: entry.throughput ?? 0,
        errorCount: entry.error_count ?? 0,
        successCount: entry.success_count ?? 0
    }
}

const { data: response, status, refresh } = await useAsyncData<{ data: SpanPoint[] }>(
    'trace-metrics',
    async () => {
        if (!selectedProjectId.value) {
            return { data: [] as SpanPoint[] }
        }

        const res = await fetchApi<{ data: SpanMetricApi[] }>('/api/stats/spans', {
            params: { period: '24h' }
        })

        const points = (res?.data || [])
            .map(toSpanPoint)
            .filter((p): p is SpanPoint => Boolean(p))

        return { data: points }
    },
    {
        watch: [selectedProjectId]
    }
)

const pending = computed(() => status.value === 'pending')

const sortedGroups = computed(() => {
    const raw = response.value?.data || []
    const groups: Record<string, SpanGroup> = {}

    raw.forEach(item => {
        const name = item.spanName
        if (!groups[name]) {
            groups[name] = { 
                name,
                history: [], 
                avgLatency: 0, 
                totalReqs: 0,
                totalErrors: 0,
                errorRate: 0,
                rpm: 0,
                trend: 0,
                healthStatus: 'healthy'
            }
        }
        groups[name].history.push(item)
    })

    // Calculate aggregates and health
    const processedGroups = Object.values(groups).map(g => {
        // Sort history by time first
        g.history.sort((a, b) => a.timestamp - b.timestamp)

        const totalTime = g.history.reduce((acc, curr) => acc + (curr.avgLatency * curr.throughput), 0)
        const totalReqs = g.history.reduce((acc, curr) => acc + curr.throughput, 0)
        const totalErrors = g.history.reduce((acc, curr) => acc + curr.errorCount, 0)
        
        g.totalReqs = totalReqs
        g.totalErrors = totalErrors
        g.avgLatency = totalReqs > 0 ? Math.round(totalTime / totalReqs) : 0
        g.errorRate = totalReqs > 0 ? Math.round((totalErrors / totalReqs) * 100) : 0
        
        // RPM (Average over the last 24h window, or however much data we have)
        // Assuming 24h window for now as per API param
        g.rpm = Math.round(totalReqs / (24 * 60)) 
        if (g.rpm === 0 && totalReqs > 0) g.rpm = 1 // Minimum 1 if there's traffic

        // Trend Calculation (Compare last 20% vs first 20%)
        if (g.history.length >= 2) {
            const splitIndex = Math.floor(g.history.length * 0.2) || 1
            const firstPart = g.history.slice(0, splitIndex)
            const lastPart = g.history.slice(-splitIndex)
            
            const firstAvg = firstPart.reduce((acc, curr) => acc + curr.avgLatency, 0) / firstPart.length
            const lastAvg = lastPart.reduce((acc, curr) => acc + curr.avgLatency, 0) / lastPart.length
            
            if (firstAvg > 0) {
                g.trend = Math.round(((lastAvg - firstAvg) / firstAvg) * 100)
            }
        }

        // Health Status Determination
        if (g.errorRate > 0) {
            g.healthStatus = 'critical'
        } else if (g.trend > 20 || g.avgLatency > 2000) { // Warning if trend > 20% or latency > 2s
            g.healthStatus = 'warning'
        } else {
            g.healthStatus = 'healthy'
        }

        return g
    })

    // Filter
    const filtered = showProblemsOnly.value 
        ? processedGroups.filter(g => g.healthStatus !== 'healthy')
        : processedGroups

    // Sort
    return filtered.sort((a, b) => {
        // 1. Critical first
        if (a.healthStatus === 'critical' && b.healthStatus !== 'critical') return -1
        if (b.healthStatus === 'critical' && a.healthStatus !== 'critical') return 1
        
        // 2. Warning second
        if (a.healthStatus === 'warning' && b.healthStatus !== 'warning') return -1
        if (b.healthStatus === 'warning' && a.healthStatus !== 'warning') return 1

        // 3. Within Critical: Sort by Error Rate desc
        if (a.healthStatus === 'critical') {
            return b.errorRate - a.errorRate
        }

        // 4. Within Warning: Sort by Trend desc
        if (a.healthStatus === 'warning') {
            return b.trend - a.trend
        }

        // 5. Within Healthy: Sort by RPM desc (busiest first)
        return b.rpm - a.rpm
    })
})

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface TraceSample {
    traceId: string
    latestTimestamp: number
    status: 'success' | 'error'
    duration?: number
    entryCount: number
}

interface SelectedSpan {
    name: string
    group: SpanGroup
}

const isDetailsOpen = ref(false)
const selectedSpan = ref<SelectedSpan | null>(null)
const traceSamples = ref<TraceSample[]>([])
const traceSamplesStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const traceSamplesError = ref<string | null>(null)

// Tabs Logic
const selectedTab = ref('latest')

const tabItems = computed(() => {
    const errorCount = traceSamples.value.filter(s => s.status === 'error').length
    return [
        { label: 'Latest', icon: 'i-lucide-clock', value: 'latest' },
        { label: `Errors (${errorCount})`, icon: 'i-lucide-alert-circle', value: 'errors', disabled: errorCount === 0 },
        { label: 'Slowest', icon: 'i-lucide-snail', value: 'slowest' }
    ]
})

const activeSamples = computed(() => {
    if (selectedTab.value === 'errors') { // Errors
        return traceSamples.value.filter(s => s.status === 'error')
    }
    if (selectedTab.value === 'slowest') { // Slowest
        return [...traceSamples.value].sort((a, b) => (b.duration || 0) - (a.duration || 0))
    }
    return traceSamples.value // Latest
})


const LEVEL_PRIORITY: Record<LogLevel, number> = {
    error: 3,
    warn: 2,
    info: 1,
    debug: 0
}

const historyStats = computed(() => {
    const history = selectedSpan.value?.group.history ?? []
    if (!history.length) {
        return { min: 0, max: 0 }
    }

    let min = Infinity
    let max = -Infinity

    for (const point of history) {
        min = Math.min(min, point.avgLatency)
        max = Math.max(max, point.avgLatency)
    }

    return {
        min: Math.round(min),
        max: Math.round(max)
    }
})

const formatRelative = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
}

const navigateToTrace = (traceId: string) => {
    isDetailsOpen.value = false
    navigateTo(`/traces/${traceId}`)
}

const loadTraceSamples = async (spanName: string) => {
    traceSamplesStatus.value = 'pending'
    traceSamplesError.value = null
    traceSamples.value = []
    selectedTab.value = 'latest' // Reset tab

    try {
        // Fetch logs that have this span name (including system events)
        const res = await fetchApi<{ data: Array<{ 
            traceId: string | null; 
            timestamp: string; 
            level: LogLevel; 
            message: string;
            data?: { status?: string; duration_ms?: number } 
        }> }>('/api/logs', {
            params: {
                limit: '60',
                filters: JSON.stringify({ 'data.span_name': spanName })
                // Removed exclude_system_events: 'true' to allow finding the span events
            }
        })

        const grouped = new Map<string, TraceSample>()

        for (const log of res.data || []) {
            if (!log.traceId) continue
            const ts = new Date(log.timestamp).getTime()
            if (!Number.isFinite(ts)) continue

            const existing = grouped.get(log.traceId)
            const logStatus = log.data?.status === 'error' ? 'error' : 'success'
            const logDuration = log.data?.duration_ms

            if (!existing) {
                grouped.set(log.traceId, {
                    traceId: log.traceId,
                    latestTimestamp: ts,
                    status: logStatus,
                    duration: logDuration,
                    entryCount: 1
                })
                continue
            }

            existing.latestTimestamp = Math.max(existing.latestTimestamp, ts)
            existing.entryCount += 1
            
            // If any log in the trace is an error, mark trace as error
            if (logStatus === 'error') {
                existing.status = 'error'
            }
            // Capture duration if available
            if (logDuration) {
                existing.duration = logDuration
            }
        }

        traceSamples.value = Array.from(grouped.values())
            .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
            .slice(0, 20)

        traceSamplesStatus.value = 'success'
    } catch (error: unknown) {
        traceSamplesStatus.value = 'error'
        traceSamplesError.value = (error instanceof Error ? error.message : 'Unable to load trace samples.')
    }
}

const openSpanDetails = (name: string, group: SpanGroup) => {
    selectedSpan.value = {
        name,
        group
    }
    isDetailsOpen.value = true
    void loadTraceSamples(name)
}

const retryTraceSamples = () => {
    if (!selectedSpan.value) return
    void loadTraceSamples(selectedSpan.value.name)
}
</script>
