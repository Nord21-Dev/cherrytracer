<template>
    <UContainer class="py-8 space-y-6">
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Service Health</h2>
                <p class="text-sm text-gray-500">Performance metrics by operation (Last 24h)</p>
            </div>
            <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="pending" @click="() => refresh()" />
        </div>

        <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <USkeleton v-for="i in 6" :key="i" class="h-40 rounded-xl bg-gray-100 dark:bg-neutral-900" />
        </div>

        <div v-else-if="!Object.keys(groupedSpans).length" class="text-center py-20">
            <div class="p-4 rounded-full bg-gray-100 dark:bg-neutral-900 inline-block mb-4">
                <UIcon name="i-lucide-activity" class="size-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">No Trace Data</h3>
            <p class="text-gray-500 mt-1">Waiting for spans with "end" events...</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UCard
                v-for="(group, name) in groupedSpans"
                :key="name"
                :ui="{ body: 'p-0 sm:p-0' }"
                class="overflow-hidden hover:ring-2 hover:ring-neutral-500/20 transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                role="button"
                tabindex="0"
                @click="openSpanDetails(name, group)"
                @keydown.enter.stop.prevent="openSpanDetails(name, group)"
            >
                <div class="p-4 border-b border-gray-100 dark:border-neutral-800">
                    <div class="flex items-start justify-between mb-2">
                        <h3 class="font-medium text-sm text-gray-900 dark:text-white truncate pr-4" :title="name">
                            {{ name }}
                        </h3>
                        <UBadge variant="subtle" size="xs" color="neutral">{{ group.totalReqs }} reqs</UBadge>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-bold text-gray-900 dark:text-white font-mono">{{ group.avgLatency }}</span>
                        <span class="text-xs text-gray-500">ms avg</span>
                    </div>
                </div>
                
                <div class="h-20 w-full bg-gray-50/50 dark:bg-neutral-900/50">
                    <VizTraceSparkline :data="group.history" />
                </div>
            </UCard>
        </div>
    </UContainer>

    <USlideover v-model:open="isDetailsOpen" side="right" modal :title="selectedSpan?.name || 'Span details'">
        <template #header>
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-xs uppercase tracking-widest text-gray-500 dark:text-neutral-500">Span</p>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate max-w-xs">{{ selectedSpan?.name }}</h3>
                    </div>
                    <div class="flex items-center gap-2">
                        <UBadge size="xs" variant="soft" color="neutral">
                            {{ selectedSpan?.group.totalReqs ?? 0 }} reqs
                        </UBadge>
                        <UBadge size="xs" variant="soft" color="neutral">
                            {{ selectedSpan?.group.avgLatency ?? 0 }} ms avg
                        </UBadge>
                    </div>
                </div>
                <p v-if="selectedSpan" class="text-xs text-gray-500 dark:text-neutral-500">
                    Showing {{ traceSamples.length }} recently sampled traces
                </p>
            </div>
        </template>

        <template #body>
            <div v-if="!selectedSpan || traceSamplesStatus === 'pending'" class="space-y-3">
                <USkeleton class="h-6 w-1/2 rounded-full" />
                <USkeleton class="h-24 rounded-xl" />
                <USkeleton class="h-3 rounded-full" />
                <USkeleton class="h-3 rounded-full w-3/4" />
                <USkeleton class="h-40 rounded-xl" />
            </div>

            <div v-else-if="traceSamplesStatus === 'error'" class="space-y-4 text-center py-6">
                <p class="text-sm text-gray-600 dark:text-neutral-400">{{ traceSamplesError }}</p>
                <UButton label="Retry" color="primary" variant="ghost" size="sm" @click="retryTraceSamples" />
            </div>

            <div v-else class="space-y-6">
                <section class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                                Latency window
                            </p>
                            <p class="text-2xl font-semibold text-gray-900 dark:text-white">
                                {{ latestHistoryPoint?.avgLatency ?? selectedSpan?.group.avgLatency ?? 0 }} ms
                            </p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs text-gray-500 dark:text-neutral-400">Min</p>
                            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ historyStats.min }} ms</p>
                            <p class="text-xs text-gray-500 dark:text-neutral-400 mt-1">Max</p>
                            <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ historyStats.max }} ms</p>
                        </div>
                    </div>
                    <VizTraceSparkline :data="selectedSpan?.group.history ?? []" class="h-28" />
                </section>

                <section class="space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Recent traces</h4>
                        <span class="text-xs text-gray-500 dark:text-neutral-500">
                            {{ traceSamples.length ? `${traceSamples.length} shown` : 'Awaiting samples' }}
                        </span>
                    </div>

                    <div v-if="!traceSamples.length" class="rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 p-4 text-sm text-gray-500 dark:text-neutral-400">
                        No recent traces captured for this span yet.
                    </div>

                    <ul v-else class="space-y-2">
                        <li
                            v-for="sample in traceSamples"
                            :key="sample.traceId"
                            class="flex items-start justify-between gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3"
                        >
                            <div class="flex-1 min-w-0 space-y-1">
                                <p class="font-mono text-sm text-gray-900 dark:text-white truncate">
                                    {{ sample.traceId }}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-neutral-500 capitalize">
                                    {{ sample.level }} • {{ formatRelative(sample.latestTimestamp) }}
                                </p>
                            </div>
                            <div class="flex flex-col items-end gap-2">
                                <UBadge size="xs" variant="soft" :color="levelBadgeColor(sample.level)">
                                    {{ sample.level }}
                                </UBadge>
                                <UButton size="xs" variant="ghost" color="neutral" label="Open" @click="navigateToTrace(sample.traceId)" />
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </template>

        <template #footer>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-500">
                <span>Powered by recent log sampling</span>
                <div v-if="latestTraceSample">
                    <span class="uppercase tracking-wider">Latest trace:</span>
                    <button
                        class="font-mono text-xs text-primary-600 dark:text-primary-300 underline underline-offset-2"
                        type="button"
                        @click="navigateToTrace(latestTraceSample.traceId)"
                    >
                        {{ latestTraceSample.traceId.slice(0, 12) }}…
                    </button>
                </div>
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

const groupedSpans = computed(() => {
    const raw = response.value?.data || []
    const groups: Record<string, { history: SpanPoint[], avgLatency: number, totalReqs: number }> = {}

    raw.forEach(item => {
        const name = item.spanName
        if (!groups[name]) {
            groups[name] = { history: [], avgLatency: 0, totalReqs: 0 }
        }
        groups[name].history.push(item)
    })

    // Calculate aggregates
    Object.keys(groups).forEach(name => {
        const g = groups[name]
        if (!g) return

        const totalTime = g.history.reduce((acc, curr) => acc + (curr.avgLatency * curr.throughput), 0)
        const totalReqs = g.history.reduce((acc, curr) => acc + curr.throughput, 0)
        
        g.totalReqs = totalReqs
        g.avgLatency = totalReqs > 0 ? Math.round(totalTime / totalReqs) : 0
        
        // Sort history by time
        g.history.sort((a, b) => a.timestamp - b.timestamp)
    })

    return groups
})

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface TraceSample {
    traceId: string
    latestTimestamp: number
    level: LogLevel
    entryCount: number
}

interface SelectedSpan {
    name: string
    group: {
        history: SpanPoint[]
        avgLatency: number
        totalReqs: number
    }
}

const isDetailsOpen = ref(false)
const selectedSpan = ref<SelectedSpan | null>(null)
const traceSamples = ref<TraceSample[]>([])
const traceSamplesStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const traceSamplesError = ref<string | null>(null)

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    error: 3,
    warn: 2,
    info: 1,
    debug: 0
}

const levelBadgeColor: Record<LogLevel, 'error' | 'warning' | 'success' | 'neutral'> = {
    error: 'error',
    warn: 'warning',
    info: 'success',
    debug: 'neutral'
}

const latestHistoryPoint = computed(() => {
    const history = selectedSpan.value?.group.history ?? []
    return history[history.length - 1] ?? null
})

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

const latestTraceSample = computed(() => traceSamples.value[0] ?? null)

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

    try {
        const res = await fetchApi<{ data: Array<{ traceId: string | null; timestamp: string; level: LogLevel; message: string }> }>('/api/logs', {
            params: {
                limit: '60',
                filters: JSON.stringify({ 'data.span_name': spanName }),
                exclude_system_events: 'true'
            }
        })

        const grouped = new Map<string, TraceSample>()

        for (const log of res.data || []) {
            if (!log.traceId) continue
            const ts = new Date(log.timestamp).getTime()
            if (!Number.isFinite(ts)) continue

            const existing = grouped.get(log.traceId)

            if (!existing) {
                grouped.set(log.traceId, {
                    traceId: log.traceId,
                    latestTimestamp: ts,
                    level: log.level,
                    entryCount: 1
                })
                continue
            }

            existing.latestTimestamp = Math.max(existing.latestTimestamp, ts)
            existing.entryCount += 1

            if (LEVEL_PRIORITY[log.level] > LEVEL_PRIORITY[existing.level]) {
                existing.level = log.level
            }
        }

        traceSamples.value = Array.from(grouped.values())
            .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
            .slice(0, 8)

        traceSamplesStatus.value = 'success'
    } catch (error: unknown) {
        traceSamplesStatus.value = 'error'
        traceSamplesError.value = (error instanceof Error ? error.message : 'Unable to load trace samples.')
    }
}

const openSpanDetails = (name: string, group: SelectedSpan['group']) => {
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
