<template>
    <!-- Top Navigation Bar -->
    <header
        class="sticky top-0 z-50 border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-xl">
        <UContainer class="flex items-center justify-between py-4">
            <div class="flex items-center gap-4">
                <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" to="/logs" label="Back to Logs"
                    size="xs" />
            </div>

            <div class="flex items-center gap-3">
                <span class="text-xs text-neutral-500 dark:text-neutral-500 font-medium">Trace ID</span>
                <UTooltip text="Click to copy" :shortcuts="['⌘', 'C']">
                    <UBadge variant="subtle" color="neutral" size="md"
                        class="font-mono cursor-copy hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors group"
                        @click="copyToClipboard(traceId)">
                        {{ traceId }}
                        <UIcon name="i-lucide-copy"
                            class="ml-2 size-3" />
                    </UBadge>
                </UTooltip>
                <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" :loading="pending"
                    @click="() => refresh()" />
            </div>
        </UContainer>
    </header>

    <UContainer class="py-8 space-y-6">

        <!-- KPI / Header Section -->
        <section class="flex flex-row items-center md:flex-row md:items-end justify-between gap-6">
            <div>
                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-1">Trace Details</h2>
                <p v-if="logs.length" class="text-sm text-gray-500">
                    Started at {{ formatTime(logs[logs.length - 1]?.timestamp || '') }}
                </p>
            </div>

            <!-- The "Grok" Metric Card -->
            <div class="flex items-end flex-col">
                <div class="text-[8px] uppercase tracking-widest text-gray-500 dark:text-neutral-500 font-bold">
                    Total
                    Latency</div>
                <div class="flex items-baseline gap-1">
                    <span class="text-xl font-mono font-bold text-primary-500 tracking-tighter">
                            {{ pending ? '---' : formattedTotalDuration.value }}
                    </span>
                        <span class="text-sm text-gray-500 dark:text-neutral-500 font-medium">
                            {{ formattedTotalDuration.unit }}
                        </span>
                </div>
            </div>
        </section>

        <!-- Loading State -->
        <div v-if="pending" class="space-y-4">
            <USkeleton class="h-64 w-full rounded-xl bg-gray-200 dark:bg-neutral-900" />
            <USkeleton class="h-48 w-full rounded-xl bg-gray-200 dark:bg-neutral-900" />
        </div>

        <!-- Empty State -->
        <div v-else-if="!logs.length"
            class="flex flex-col items-center justify-center py-32 rounded-xl border border-dashed border-gray-300 dark:border-neutral-800 bg-gray-100/20 dark:bg-neutral-900/20">
            <div class="p-4 rounded-full bg-gray-200 dark:bg-neutral-900 mb-4">
                <UIcon name="i-lucide-search-x" class="size-8 text-gray-500 dark:text-neutral-500" />
            </div>
            <h3 class="text-gray-900 dark:text-white font-medium">No Data Found</h3>
            <p class="text-gray-500 dark:text-neutral-500 text-sm mt-1">
                Could not find any logs for Trace ID: <span class="font-mono">{{ traceId }}</span>
            </p>
            <UButton label="Go Back" to="/" variant="outline" class="mt-4" />
        </div>

        <div v-else class="space-y-6">

            <!-- VISUALIZATION: Waterfall -->
            <UCard v-if="spans.length > 0">
                <template #header>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <UIcon name="i-lucide-align-left" class="text-gray-600 dark:text-neutral-400" />
                            <h3 class="text-sm font-medium text-gray-900 dark:text-white">Waterfall View</h3>
                        </div>
                        <UBadge variant="soft" color="neutral" size="xs">{{ spans.length }} Spans</UBadge>
                    </div>
                </template>

                <div class="relative w-full overflow-hidden">

                    <!-- The "Initialization/Overhead" Gray Zone -->
                    <div v-if="preparedSpans.length && preparedSpans[0].offsetPercent > 0"
                        class="absolute top-0 bottom-0 left-0 bg-gray-100/50 dark:bg-neutral-800/30 border-r border-dashed border-gray-300 dark:border-neutral-700 z-0"
                        :style="{ width: `${preparedSpans[0].offsetPercent}%` }">
                        <div
                            class="sticky top-10 px-2 text-[9px] font-mono text-gray-400 uppercase tracking-widest rotate-90 origin-left translate-x-full whitespace-nowrap">
                            Initial Latency
                        </div>
                    </div>

                    <!-- Timeline Ruler -->
                    <div
                        class="h-8 border-b border-gray-200 dark:border-neutral-800 select-none bg-gray-50/50 dark:bg-neutral-950/50 backdrop-blur flex items-end px-2 pb-1">

                        <!-- 1. Invisible Spacer (Matches the Span Label Column exactly) -->
                        <!-- Must have same width/margin as the span rows: w-1/4 min-w-[200px] mr-4 -->
                        <div class="w-1/4 min-w-[120px] mr-4 border-r border-transparent">
                            <span
                                class="text-[10px] font-medium text-gray-400 dark:text-neutral-600 uppercase tracking-wider">
                                Operation
                            </span>
                        </div>

                        <!-- 2. The Actual Ruler (Matches the Span Bar Column) -->
                        <div class="flex-1 relative h-full">

                            <!-- Labels -->
                            <div
                                class="absolute inset-x-0 bottom-0 flex justify-between text-[10px] font-mono text-gray-500 dark:text-neutral-500 leading-none z-10">
                                <!-- Using translate-x to center the middle labels and keep ends aligned -->
                                <span>0ms</span>
                                <span class="-translate-x-1/2">{{ Math.round(totalDuration * 0.25) }}ms</span>
                                <span class="-translate-x-1/2">{{ Math.round(totalDuration * 0.5) }}ms</span>
                                <span class="-translate-x-1/2">{{ Math.round(totalDuration * 0.75) }}ms</span>
                                <span>{{ totalDuration.toFixed(0) }}ms</span>
                            </div>

                            <!-- Vertical Grid Lines (Background) -->
                            <!-- We move this inside the flex-1 container so lines don't overlap text labels -->
                            <div
                                class="absolute top-8 left-0 w-full h-[9999px] pointer-events-none z-0 opacity-10 mix-blend-multiply dark:mix-blend-overlay">
                                <div class="w-full h-full flex justify-between">
                                    <!-- Start Line -->
                                    <div class="w-px border-l border-gray-900 dark:border-white"></div>
                                    <!-- Quarter -->
                                    <div class="w-px border-l border-dashed border-gray-400 dark:border-neutral-400">
                                    </div>
                                    <!-- Middle -->
                                    <div class="w-px border-l border-dashed border-gray-400 dark:border-neutral-400">
                                    </div>
                                    <!-- Three Quarter -->
                                    <div class="w-px border-l border-dashed border-gray-400 dark:border-neutral-400">
                                    </div>
                                    <!-- End Line -->
                                    <div class="w-px border-l border-gray-900 dark:border-white"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Spans List -->
                    <div class="py-4 space-y-1 relative min-h-[100px]">
                        <div v-for="span in preparedSpans" :key="span.id"
                            class="group relative flex items-center px-2 py-1 hover:bg-gray-100/50 dark:hover:bg-white/2 transition-none">
                            <!-- Span Label -->
                            <div class="w-1/4 min-w-[120px] pr-1 flex flex-col truncate  mr-4">
                                <div class="flex items-center gap-2">
                                    <div class="size-1.5 rounded-full shadow-[0_0_8px_currentColor]"
                                        :class="span.active ? 'bg-amber-400 text-amber-400' : span.error ? 'bg-red-500 text-red-500' : 'bg-emerald-500 text-emerald-500'">
                                    </div>
                                    <span
                                        class="text-xs font-medium text-gray-700 dark:text-neutral-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        {{ span.name }}
                                    </span>
                                    <UBadge v-if="span.active" variant="soft" color="warning" size="xs">In Flight</UBadge>
                                </div>
                                <span class="text-[10px] font-mono text-gray-600 dark:text-neutral-600 pl-3.5">{{
                                    span.id.slice(0,
                                        8) }}...</span>
                                <div v-if="span.relatedTraceId"
                                    class="pl-3.5 mt-0.5 flex items-center gap-1 text-[10px] text-primary-600 dark:text-primary-300">
                                    <UIcon name="i-lucide-link-2" class="size-3" />
                                    <button type="button" class="underline underline-offset-2 decoration-dotted"
                                        @click.stop="handleSpanClick(span, $event)">
                                        {{ span.relatedTraceId.slice(0, 8) }}...
                                    </button>
                                </div>
                            </div>

                            <!-- The Bar -->
                            <div class="flex-1 relative h-8 flex items-center">
                                    <div class="absolute h-3 rounded-full min-w-1 transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(var(--color-primary-500),0.2)] overflow-visible"
                                        :class="[
                                            span.active
                                                ? 'bg-amber-200 dark:bg-amber-500/40 border border-amber-300 dark:border-amber-400 animate-pulse'
                                                : span.error
                                                    ? 'bg-red-500/80 border border-red-500'
                                                    : 'bg-gray-300 dark:bg-neutral-700 border border-gray-400 dark:border-neutral-600 group-hover:bg-primary-500 group-hover:border-primary-400',
                                            span.relatedTraceId ? 'cursor-pointer ring-1 ring-primary-300/60 dark:ring-primary-500/30' : 'cursor-crosshair'
                                        ]" :style="{
                                                left: `${span.offsetPercent}%`,
                                                width: `${span.widthPercent}%`
                                            }" @click="handleSpanClick(span, $event)">
                                        <div v-if="span.relatedTraceId"
                                            class="absolute -top-3 right-0 text-[10px] text-primary-600 dark:text-primary-300 flex items-center gap-1">
                                            <UIcon name="i-lucide-external-link" class="size-3" />
                                            <span class="hidden sm:inline">Jump</span>
                                        </div>

                                        <div v-if="span.showLogMarkers && span.logMarkers.length"
                                            class="absolute inset-0 pointer-events-none">
                                            <div v-for="marker in span.logMarkers" :key="marker.id"
                                                class="absolute -top-2 pointer-events-auto -translate-x-1.5"
                                                :style="{ left: `${marker.offsetPercent}%` }">
                                                <UTooltip :text="markerTooltip(marker)"
                                                    :delay-duration="0"
                                                    :popper="{ placement: 'top' }">
                                                    <button type="button"
                                                        class="relative size-3 rounded-full border shadow-sm shadow-black/10 dark:shadow-black/30 ring-2 ring-white/60 dark:ring-black/30 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                        :class="markerToneClass(marker.level)"
                                                        @click.stop="handleMarkerClick(marker)">
                                                        <span v-if="marker.count > 1"
                                                            class="absolute -top-3 -right-1 text-[9px] font-semibold text-gray-700 dark:text-neutral-200 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-full px-1 leading-none">
                                                            {{ marker.count }}
                                                        </span>
                                                    </button>
                                                </UTooltip>
                                            </div>
                                        </div>
                                    </div>

                                <!-- Duration Label (Right of bar) -->
                                <div class="absolute flex items-center gap-2"
                                    :style="{ left: `calc(${span.offsetPercent + span.widthPercent}% + 8px)` }">
                                    <span
                                        class="text-[10px] font-mono text-gray-600 dark:text-neutral-600 ml-2 pointer-events-none transition-all opacity-0 group-hover:opacity-100">
                                        {{ span.active ? `${formatLatencyLabel(span.duration)} (live)` : formatLatencyLabel(span.duration) }}
                                    </span>
                                    <UButton v-if="span.logMarkers.length > LOG_MARKER_COLLAPSE_THRESHOLD" size="xs"
                                        color="neutral" variant="ghost" class="text-[10px]! px-2!"
                                        @click.stop="toggleSpanMarkers(span.id, !span.showLogMarkers)">
                                        {{ span.showLogMarkers ? 'Hide log markers' : `Show ${span.logMarkers.length} logs` }}
                                    </UButton>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </UCard>

            <!-- Fallback if we have logs but no spans (legacy logs) -->
            <div v-else
                class="p-4 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm flex items-center gap-2">
                <UIcon name="i-lucide-info" />
                <span>These logs are part of a trace, but contain no Span ID information to generate a
                    waterfall.</span>
            </div>

            <!-- DATA: Raw Logs Console -->
            <UCard>
                <template #header>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <UIcon name="i-lucide-terminal" class="text-neutral-500 dark:text-neutral-500" />
                            <h3 class="text-sm font-medium text-gray-800 dark:text-neutral-200">System Events
                            </h3>
                        </div>
                        <!-- Active Badge selection -->
                        <div class="flex gap-1.5">
                            <!-- Error -->
                            <div class="size-2.5 rounded-full bg-error-500/20 border border-error-500/50"></div>
                            <!-- Warning -->
                            <div class="size-2.5 rounded-full bg-warning-500/20 border border-warning-500/50">
                            </div>
                            <!-- Info -->
                            <div class="size-2.5 rounded-full bg-info-500/20 border border-info-500/50">
                            </div>
                        </div>
                    </div>
                </template>

                <div class="font-mono text-xs">
                    <table class="w-full text-left border-collapse">
                        <thead
                            class="bg-gray-50/50 dark:bg-white/2 text-gray-500 dark:text-neutral-500 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th class="px-4 py-2 font-medium w-32 border-b border-gray-200 dark:border-neutral-800">
                                    Timestamp
                                </th>
                                <th class="px-4 py-2 font-medium w-24 border-b border-gray-200 dark:border-neutral-800">
                                    Level</th>
                                <th class="px-4 py-2 font-medium border-b border-gray-200 dark:border-neutral-800">
                                    Message</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-neutral-800/50">
                            <tr v-for="log in logs" :key="log.id" :ref="el => setLogRowRef(log.id, el as HTMLElement | null)"
                                class="group transition-colors"
                                :class="highlightedLogId === log.id
                                    ? 'bg-primary-50/70 dark:bg-primary-900/30 shadow-[0_0_0_2px_rgba(59,130,246,0.35)] dark:shadow-[0_0_0_2px_rgba(14,165,233,0.45)]'
                                    : 'hover:bg-gray-100/30 dark:hover:bg-white/3'">
                                <td
                                    class="px-4 py-2 text-gray-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-gray-700 dark:group-hover:text-neutral-300">
                                    {{ formatTime(log.timestamp) }}
                                </td>
                                <td class="px-4 py-2">
                                    <UBadge size="xs" variant="subtle" :color="getLogLevelColor(log.level)"
                                        class="uppercase tracking-wider font-bold scale-90 origin-left">
                                        {{ log.level }}
                                    </UBadge>
                                </td>
                                <td class="px-4 py-2 text-gray-700 dark:text-neutral-300 break-all">
                                    {{ log.message }}
                                    <div v-if="log.data && Object.keys(log.data).length > 0"
                                        class="mt-1 opacity-50 text-[10px]">
                                        {{ JSON.stringify(log.data) }}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </UCard>

        </div>
    </UContainer>
</template>

<script setup lang="ts">
import { format } from 'date-fns'

const route = useRoute()
const traceId = route.params.id as string
const toast = useToast()
const { fetchApi } = useCherryApi()
const { selectedProjectId } = useProject()

const DURATION_UNITS = [
    { label: 'd', divisor: 86_400_000 },
    { label: 'h', divisor: 3_600_000 },
    { label: 'min', divisor: 60_000 },
    { label: 's', divisor: 1_000 },
    { label: 'ms', divisor: 1 }
] as const

const DEFAULT_DURATION_UNIT = DURATION_UNITS[DURATION_UNITS.length - 1]!
const LOG_MARKER_COLLAPSE_THRESHOLD = 120
const MAX_MARKERS_PER_SPAN = 180
const MIN_TRACE_ID_LENGTH = 8
const ACTIVE_POLL_INTERVAL_MS = 3_000

const LEVEL_PRIORITY: Record<LogEntry['level'], number> = {
    error: 3,
    warn: 2,
    info: 1,
    debug: 0
}

interface SpanMarker {
    id: string
    logId: string | null
    ts: number
    level: LogEntry['level']
    message: string
    count: number
    offsetPercent: number
}

interface SpanAggregate {
    id: string
    start: number | null
    end: number | null
    lastSeen: number | null
    logs: LogEntry[]
    error: boolean
    name: string
    hasEndEvent: boolean
    relatedTraceCounts: Map<string, number>
}

interface SpanWithTimes extends SpanAggregate {
    duration: number
    active: boolean
    effectiveEnd: number
    relatedTraceId: string | null
    start: number
}

interface PreparedSpan extends SpanWithTimes {
    offsetPercent: number
    widthPercent: number
    logMarkers: SpanMarker[]
    showLogMarkers: boolean
}

const resolveDurationUnit = (absMs: number): (typeof DURATION_UNITS)[number] => {
    for (const entry of DURATION_UNITS) {
        if (absMs >= entry.divisor) {
            return entry
        }
    }

    return DEFAULT_DURATION_UNIT
}

const formatLatency = (ms: number) => {
    const absMs = Math.abs(ms)
    const unit = resolveDurationUnit(absMs)
    const normalized = ms / unit.divisor
    const decimals = Math.abs(normalized) >= 10 ? 0 : 2

    return {
        value: normalized.toFixed(decimals),
        unit: unit.label
    }
}

const formatLatencyLabel = (ms: number) => {
    const { value, unit } = formatLatency(ms)
    return `${value}${unit}`
}

// --- Types ---
interface LogEntry {
    id: string
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    spanId?: string
    source?: string
    data?: Record<string, any>
}

const extractDurationMs = (log: LogEntry): number | null => {
    const raw = (log.data as any)?.duration_ms ?? (log.data as any)?.durationMs ?? (log.data as any)?.duration
    const value = typeof raw === 'string' ? Number(raw) : raw

    return Number.isFinite(value) ? value : null
}

const normalizeTraceCandidate = (value: unknown) => {
    if (typeof value !== 'string') return null

    const trimmed = value.trim()
    if (!trimmed || trimmed.length < MIN_TRACE_ID_LENGTH) return null
    if (trimmed === traceId) return null

    return trimmed
}

const extractRelatedTraceId = (log: LogEntry): string | null => {
    const data = log.data as Record<string, any> | undefined
    if (!data) return null

    const keysToCheck = [
        'related_trace_id',
        'relatedTraceId',
        'linked_trace_id',
        'linkedTraceId',
        'parent_trace_id',
        'parentTraceId',
        'child_trace_id',
        'childTraceId',
        'trace_parent_id'
    ]

    for (const key of keysToCheck) {
        if (key in data) {
            const normalized = normalizeTraceCandidate((data as any)[key])
            if (normalized) return normalized
        }
    }

    const nested = normalizeTraceCandidate((data as any)?.trace?.id ?? (data as any)?.trace?.trace_id)
    if (nested) return nested

    return null
}

const pickRelatedTraceId = (relatedTraceCounts: Map<string, number>) => {
    let best: string | null = null
    let bestCount = 0

    relatedTraceCounts.forEach((count, id) => {
        if (count > bestCount) {
            best = id
            bestCount = count
        }
    })

    return best
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value))

const truncateMessage = (message: string, max = 140) => {
    if (!message) return ''
    return message.length > max ? `${message.slice(0, max - 3)}...` : message
}

const buildLogMarkers = (span: SpanWithTimes): SpanMarker[] => {
    if (!span.duration) return []

    const rawMarkers = span.logs
        .map((log) => {
            const ts = new Date(log.timestamp).getTime()
            if (!Number.isFinite(ts)) return null

            const offsetPercent = ((ts - span.start) / span.duration) * 100

            return {
                id: log.id,
                logId: log.id,
                ts,
                level: log.level,
                message: log.message,
                offsetPercent: clampPercent(offsetPercent),
                count: 1
            } as SpanMarker
        })
        .filter(Boolean) as SpanMarker[]

    if (rawMarkers.length <= MAX_MARKERS_PER_SPAN) {
        return rawMarkers
    }

    const bucketCount = MAX_MARKERS_PER_SPAN
    const bucketSizeMs = span.duration / bucketCount || 1
    const buckets = new Map<number, SpanMarker & { highestLevel: LogEntry['level'] }>()

    rawMarkers.forEach((marker) => {
        const bucketIndex = Math.min(
            bucketCount - 1,
            Math.max(0, Math.floor((marker.ts - span.start) / bucketSizeMs))
        )
        const existing = buckets.get(bucketIndex)

        if (!existing) {
            buckets.set(bucketIndex, {
                ...marker,
                id: `bucket-${span.id}-${bucketIndex}`,
                count: 1,
                offsetPercent: clampPercent((((bucketIndex + 0.5) * bucketSizeMs) / span.duration) * 100),
                highestLevel: marker.level
            })
        } else {
            existing.count += 1
            if (LEVEL_PRIORITY[marker.level] > LEVEL_PRIORITY[existing.highestLevel]) {
                existing.highestLevel = marker.level
                existing.level = marker.level
                existing.message = marker.message
                existing.logId = marker.logId
            }
        }
    })

    return Array.from(buckets.values()).map(({ highestLevel, ...rest }) => rest)
}

const spanMarkerVisibility = ref<Record<string, boolean>>({})

const resolveMarkerVisibility = (spanId: string, markerCount: number) => {
    const userPreference = spanMarkerVisibility.value[spanId]
    if (typeof userPreference === 'boolean') return userPreference

    return markerCount <= LOG_MARKER_COLLAPSE_THRESHOLD
}

const toggleSpanMarkers = (spanId: string, nextValue?: boolean) => {
    const current = spanMarkerVisibility.value[spanId]
    const next = typeof nextValue === 'boolean' ? nextValue : !(typeof current === 'boolean' ? current : false)

    spanMarkerVisibility.value = {
        ...spanMarkerVisibility.value,
        [spanId]: next
    }
}

const markerToneClass = (level: LogEntry['level']) => {
    switch (level) {
        case 'error': return 'bg-error-500 border-error-600'
        case 'warn': return 'bg-warning-500 border-warning-600'
        case 'info': return 'bg-info-500 border-info-600'
        default: return 'bg-neutral-400 border-neutral-500'
    }
}

const markerTooltip = (marker: SpanMarker) => {
    const tsLabel = format(new Date(marker.ts), 'HH:mm:ss.SSS')
    const levelLabel = marker.level.toUpperCase()
    const countSuffix = marker.count > 1 ? ` • ${marker.count} logs` : ''

    return `${tsLabel} • ${levelLabel}${countSuffix} — ${truncateMessage(marker.message, 110)}`
}

const highlightedLogId = ref<string | null>(null)
const logRowRefs = ref<Record<string, HTMLElement | null>>({})
let highlightTimer: number | null = null

const setLogRowRef = (id: string, el: HTMLElement | null) => {
    if (el) {
        logRowRefs.value[id] = el
    } else {
        delete logRowRefs.value[id]
    }
}

const focusLogRow = async (logId: string) => {
    highlightedLogId.value = logId
    await nextTick()
    const target = logRowRefs.value[logId]
    if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    if (highlightTimer) {
        clearTimeout(highlightTimer)
    }

    highlightTimer = window.setTimeout(() => {
        if (highlightedLogId.value === logId) {
            highlightedLogId.value = null
        }
    }, 3200)
}

const handleMarkerClick = (marker: SpanMarker) => {
    if (!marker.logId) return
    focusLogRow(marker.logId)
}

// --- Data Fetching ---
const { data: response, status, refresh } = await useAsyncData(
    `trace-${traceId}`,
    () => fetchApi<{ data: LogEntry[] }>('/api/logs', {
        params: {
            trace_id: traceId,
            limit: 1000, // Fetch a large batch to ensure we get the whole trace
            offset: 0
        }
    })
)

const pending = computed(() => status.value === 'pending')
const logs = computed(() => {
    // Sort chronologically just in case API order varies
    return (response.value?.data || []).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
})

const now = ref(Date.now())

// --- Span Processing Logic ---
const spans = computed(() => {
    const raw = logs.value
    const spanMap = new Map()

    raw.forEach(log => {
        if (!log.spanId) return

        if (!spanMap.has(log.spanId)) {
            spanMap.set(log.spanId, {
                id: log.spanId,
                start: null as number | null,
                end: null as number | null,
                lastSeen: null as number | null,
                logs: [],
                error: false,
                name: 'Unknown Operation',
                hasEndEvent: false,
                relatedTraceCounts: new Map()
            })
        }

        const entry = spanMap.get(log.spanId)
        entry.logs.push(log)

        const ts = new Date(log.timestamp).getTime()
        entry.lastSeen = entry.lastSeen === null ? ts : Math.max(entry.lastSeen, ts)
        const durationMs = extractDurationMs(log)
        const isStartEvent = log.data?.span_event === 'start'
        const isEndEvent = log.data?.span_event === 'end'
        const relatedTraceId = extractRelatedTraceId(log)

        // Prefer explicit span name hints if available
        if (log.message.includes('Started:')) {
            const parts = log.message.split('Started:')
            if (parts[1]) {
                entry.name = parts[1].trim()
            }
        } else if (log.data?.span_name) {
            entry.name = log.data.span_name
        } else if (entry.name === 'Unknown Operation') {
            entry.name = log.message
        }

        // Heuristic: determine start/end
        if (isStartEvent) {
            entry.start = entry.start === null ? ts : Math.min(entry.start, ts)
        }

        if (isEndEvent) {
            entry.end = entry.end === null ? ts : Math.max(entry.end, ts)
            entry.hasEndEvent = true
        }

        // If we only have an end event but the producer sent duration_ms, backfill the start.
        if (isEndEvent && durationMs !== null) {
            const inferredStart = ts - durationMs
            entry.start = entry.start === null ? inferredStart : Math.min(entry.start, inferredStart)
        }

        // Fallback: use observed timestamp bounds if no explicit markers
        entry.start = entry.start === null ? ts : Math.min(entry.start, ts)

        if (log.level === 'error') entry.error = true

        if (relatedTraceId) {
            const current = entry.relatedTraceCounts.get(relatedTraceId) || 0
            entry.relatedTraceCounts.set(relatedTraceId, current + 1)
        }
    })

    // Convert Map to Array and calculate duration
    return Array.from(spanMap.values())
        .filter(s => s.start) // Show spans even if no end event (in-flight)
        .map((s: any) => {
            const effectiveEnd = s.hasEndEvent
                ? s.end
                : now.value
            const relatedTraceId = pickRelatedTraceId(s.relatedTraceCounts)

            return {
                ...s,
                end: s.end ?? s.lastSeen ?? s.start,
                duration: Math.max((effectiveEnd - s.start), 1), // Avoid 0ms div by zero issues
                active: !s.hasEndEvent,
                effectiveEnd,
                relatedTraceId
            }
        })
        .sort((a, b) => a.start - b.start)
})

// --- Metrics ---
// 1. Anchor the start time to the very first Log, not the first Span.
//    This preserves the visual "gap" if there is latency before the first span begins.
const traceStart = computed(() => {
    if (!logs.value.length) return 0
    const firstLogTime = new Date(logs.value[0]!.timestamp).getTime()

    // Safety check: in rare async cases, a span might claim to start before the first log
    const firstSpanTime = spans.value.length ? Math.min(...spans.value.map(s => s.start)) : Infinity

    return Math.min(firstLogTime, firstSpanTime)
})

// 2. Calculate total duration based on the absolute last event in the entire log history
const totalDuration = computed(() => {
    if (!logs.value.length) return 0

    const start = traceStart.value
    const lastLogTime = new Date(logs.value[logs.value.length - 1]?.timestamp || start).getTime()
    const lastSpanEnd = spans.value.length ? Math.max(...spans.value.map(s => s.effectiveEnd || s.end || 0)) : 0

    const end = Math.max(lastLogTime, lastSpanEnd)

    return Math.max(end - start, 1) // Ensure at least 1ms to prevent div by zero
})

const formattedTotalDuration = computed(() => formatLatency(totalDuration.value))

// 3. Update offsets to be relative to the Global Trace Start
const preparedSpans = computed(() => {
    const start = traceStart.value
    const total = totalDuration.value

    return spans.value.map(s => {
        // Calculate how far from the absolute start this span began
        const offset = ((s.start - start) / total) * 100
        const width = (s.duration / total) * 100

        const logMarkers = buildLogMarkers(s as SpanWithTimes)
        const showLogMarkers = resolveMarkerVisibility(s.id, logMarkers.length)

        return {
            ...s,
            offsetPercent: Math.max(0, offset), // Prevent negative offsets
            widthPercent: Math.max(width, 0.5),  // Min visibility width
            logMarkers,
            showLogMarkers
        }
    })
})

onBeforeUnmount(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
})

const hasActiveSpans = computed(() => spans.value.some(s => s.active))

if (process.client) {
    let nowTimer: any = null
    let pollTimer: any = null

    const stopNowTimer = () => {
        if (nowTimer) {
            clearInterval(nowTimer)
            nowTimer = null
        }
    }

    const stopPollTimer = () => {
        if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
        }
    }

    const maybeRefreshTrace = async () => {
        if (status.value === 'pending') return

        try {
            await refresh()
        } catch (error) {
            console.error('Failed to refresh trace data', error)
        }
    }

    watch(hasActiveSpans, (active) => {
        if (active) {
            if (!nowTimer) {
                nowTimer = setInterval(() => {
                    now.value = Date.now()
                }, 1000)
            }

            if (!pollTimer) {
                pollTimer = setInterval(maybeRefreshTrace, ACTIVE_POLL_INTERVAL_MS)
            }
        } else {
            stopNowTimer()
            stopPollTimer()
        }
    }, { immediate: true })

    onBeforeUnmount(() => {
        stopNowTimer()
        stopPollTimer()
    })
}

onBeforeUnmount(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
})

// --- Utilities ---
const formatTime = (ts: string) => format(new Date(ts), 'HH:mm:ss.SSS')

const getLogLevelColor = (level: string) => {
    switch (level) {
        case 'error': return 'error'
        case 'warn': return 'warning'
        case 'info': return 'info'
        case 'debug': return 'neutral'
        default: return 'neutral'
    }
}

const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied to clipboard', icon: 'i-lucide-check', color: 'success' })
}

const spanTooltip = (span: PreparedSpan) => {
    const base = `${formatLatencyLabel(span.duration)} — ${span.name}${span.active ? ' (in-flight)' : ''}`
    if (span.relatedTraceId) {
        return `${base} — Jump to trace ${span.relatedTraceId.slice(0, 8)}`
    }

    return base
}

const handleSpanClick = (span: PreparedSpan, event: MouseEvent) => {
    if (!span.relatedTraceId) return

    if (event.metaKey || event.ctrlKey || event.button === 1) {
        window.open(`/traces/${span.relatedTraceId}`, '_blank', 'noopener')
        return
    }

    navigateTo(`/traces/${span.relatedTraceId}`)
}

watch(() => selectedProjectId.value, (newVal, oldVal) => {
    if (process.client && oldVal && newVal !== oldVal) {
        navigateTo('/traces')
    }
})
</script>

<style scoped>
/* Refined Scrollbar to match dark aesthetic */
.custom-scrollbar::-webkit-scrollbar {
    width: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #f9fafb;
    border-left: 1px solid #e5e7eb;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 0;
    border: 2px solid #f9fafb;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}

.dark .custom-scrollbar::-webkit-scrollbar-track {
    background: #0c0c0e;
    border-left: 1px solid #27272a;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #27272a;
    border: 2px solid #0c0c0e;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
}
</style>
