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
            <UCard v-for="(group, name) in groupedSpans" :key="name" :ui="{ body: 'p-0 sm:p-0' }" class="overflow-hidden hover:ring-2 hover:ring-primary-500/20 transition-all cursor-default">
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
                
                <div class="h-[80px] w-full bg-gray-50/50 dark:bg-neutral-900/50">
                    <VizTraceSparkline :data="group.history" />
                </div>
            </UCard>
        </div>
    </UContainer>
</template>

<script setup lang="ts">
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
</script>
