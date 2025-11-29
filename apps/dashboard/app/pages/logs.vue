<template>
    <UContainer class="py-8 space-y-6">
        <!-- 1. Header & Controls -->
        <div class="flex flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">Logs</h1>
            </div>
            <div class="flex items-center gap-3">
                <USwitch v-model="showSystemEvents" label="Raw Events" />
                <USwitch v-model="showCrashesOnly" label="Crashes" color="error" />
                <UBadge v-if="newCriticalCount > 0" color="error" variant="solid" size="xs" class="rounded-full">
                    Crash {{ newCriticalCount }}
                </UBadge>
                <UBadge v-if="!isLive && newLogsCount > 0" color="primary" variant="solid" size="xs"
                    class="rounded-full">
                    {{ newLogsCount }}
                </UBadge>
                <USwitch v-model="isLive" label="Live" color="success" />
            </div>
        </div>

        <!-- Filters Toolbar -->
        <FilterBar v-model:search="filters.search" v-model:filters="filters.structured" @refresh="refreshLogs" />

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="lg:col-span-2 order-2 lg:order-1">
                <UCard>
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <UIcon name="i-lucide-terminal" class="text-neutral-500 dark:text-neutral-500" />
                                <h3 class="text-sm font-medium text-neutral-800 dark:text-neutral-200">Live Logs</h3>
                            </div>

                            <UTabs :items="tabItems" v-model="viewMode" :content="false" size="sm" />
                        </div>
                    </template>
                    <LogGroups v-if="viewMode === 'patterns'" :project-id="selectedProjectId || ''"
                        :crash-only="showCrashesOnly" @select="selectPattern" />
                    <div v-else-if="logs.length" class="font-mono text-xs">
                        <div class="custom-scrollbar overflow-x-auto">
                            <table class="w-full min-w-[720px] text-left border-collapse">
                                <thead
                                    class="bg-neutral-50/50 dark:bg-white/2 text-neutral-500 dark:text-neutral-500 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th
                                            class="px-4 py-2 font-medium w-40 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest text-left">
                                            Timestamp</th>
                                        <th
                                            class="py-2 font-medium w-24 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                            Level</th>
                                        <th
                                            class="py-2 font-medium w-28 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                            Source</th>
                                        <th
                                            class="py-2 font-medium border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                            Message</th>
                                        <th
                                            class="py-2 font-medium w-36 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                            Trace</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800/50">
                                    <tr v-for="log in logs" :key="log.id" :class="['group hover:bg-neutral-100/30 dark:hover:bg-white/3 transition-colors cursor-pointer relative',
                                        isCrashLog(log) ? 'bg-rose-50/40 dark:bg-rose-500/5' : '']" @click="openDrawer(log)">
                                        <td
                                            class="py-1 px-1 text-neutral-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                                            {{ formatTime(log.timestamp) }}
                                        </td>
                                        <td class="">
                                            <UBadge :color="getLevelColor(log.level)" variant="subtle" size="xs"
                                                class="uppercase tracking-wider font-bold scale-90 origin-left">
                                                {{ log.level }}
                                            </UBadge>
                                        </td>
                                        <td class="">
                                            <UBadge v-if="isCrashLog(log)" color="error" variant="solid" size="xs"
                                                class="uppercase tracking-wider font-semibold scale-90 origin-left">
                                                Crash
                                            </UBadge>
                                            <UBadge :color="getSourceColor(log.source)" variant="subtle" size="xs"
                                                class="uppercase tracking-wider font-semibold scale-90 origin-left">
                                                {{ formatSource(log.source) }}
                                            </UBadge>
                                        </td>
                                        <td class=" text-neutral-700 dark:text-neutral-300">
                                            <div class="flex items-center gap-2 max-w-64">
                                                <p
                                                    class="truncate whitespace-nowrap text-xs font-mono text-neutral-900 dark:text-neutral-100 opacity-90 group-hover:opacity-100">
                                                    {{ log.message }}
                                                </p>
                                            </div>
                                            <!-- <div v-if="log.data && Object.keys(log.data).length"
                                        class="mt-1 text-[10px] opacity-50">
                                        {{ JSON.stringify(log.data) }}
                                    </div> -->
                                        </td>
                                        <td class="py-1 flex justify-start items-center gap-2">
                                            <UButton v-if="log.traceId" :to="`/traces/${log.traceId}`" variant="soft"
                                                icon="i-lucide-audio-waveform" color="neutral" size="xs" @click.stop>
                                                Trace
                                            </UButton>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div v-else-if="viewMode === 'list'"
                        class="p-12 text-center text-neutral-500 dark:text-neutral-500">
                        <UIcon name="i-lucide-inbox" class="text-4xl mb-2" />
                        <p>No logs found.</p>
                    </div>

                    <!-- Pagination / Load More -->
                    <div v-if="logs.length > 0 && viewMode === 'list'"
                        class="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-center">
                        <UButton variant="ghost" color="neutral" size="sm" @click="loadMore" :loading="loadingMore"
                            :disabled="!nextCursor">
                            {{ nextCursor ? 'Load older logs' : 'No more logs' }}
                        </UButton>
                    </div>
                </UCard>
            </div>
            <div class="order-1 lg:order-2">
                <CrashOverview />
            </div>
        </div>

        <!-- Detail Drawer -->
        <USlideover v-model:open="isDrawerOpen" title="Log Details">
            <template #body>
                <div v-if="selectedLog" class="space-y-6 flex-1 overflow-y-auto">
                    <div v-if="detailLoading" class="text-xs text-neutral-500 dark:text-neutral-500">
                        Loading full details...
                    </div>
                    <div>
                        <label
                            class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Message</label>
                        <div class="mt-1 text-neutral-900 dark:text-neutral-200">{{ selectedLog.message }}</div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Level</label>
                            <div class="mt-1 uppercase">{{ selectedLog.level }}</div>
                        </div>
                        <div>
                            <label
                                class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Source</label>
                            <div class="mt-1 uppercase">{{ formatSource(selectedLog.source) }}</div>
                        </div>
                        <div>
                            <label
                                class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Crash</label>
                            <div class="mt-1">
                                <UBadge v-if="isCrashLog(selectedLog)" color="error" variant="solid" size="xs">
                                    Auto captured
                                </UBadge>
                                <span v-else class="text-neutral-500 dark:text-neutral-400 text-xs">Manual</span>
                            </div>
                        </div>
                        <div>
                            <label
                                class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Timestamp</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.timestamp }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Trace
                                ID</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.traceId || 'N/A' }}</div>
                        </div>
                        <div>
                        <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Span
                            ID</label>
                        <div class="mt-1 font-mono text-sm">{{ selectedLog.spanId || 'N/A' }}</div>
                    </div>
                </div>

                    <div>
                        <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Payload
                            Data</label>
                        <div
                            class="mt-2 bg-neutral-50 dark:bg-neutral-900 p-4 rounded border border-neutral-200 dark:border-neutral-800 text-xs font-mono overflow-x-auto">
                            <VueJsonPretty :data="selectedLog.data || {}" :deep="2" :theme="jsonTheme" />
                        </div>
                    </div>
                </div>
            </template>
        </USlideover>
    </UContainer>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const { fetchApi } = useCherryApi()
const { selectedProject, selectedProjectId } = useProject()
const { newLogsCount, newCriticalCount, resetCount, resetCriticalCount } = useRealtime()

// State
const logs = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
const isDrawerOpen = ref(false)
const selectedLog = ref<any>(null)
const detailLoading = ref(false)
const isLive = ref(true)
const showSystemEvents = ref(false)
const showCrashesOnly = ref(false)
const viewMode = ref<'list' | 'patterns'>('list')

// Tabs items for view mode
const tabItems = ref([
    { label: 'List', value: 'list', icon: 'i-lucide-list' },
    { label: 'Patterns', value: 'patterns', icon: 'i-lucide-grid' }
])

const selectPattern = (group: any) => {
    // Filter by the pattern string
    // Ideally we'd filter by fingerprint but our search is text-based for now
    // We can use the pattern itself as a search query
    filters.search = `"${group.pattern}"` // Quote it to be exact-ish
    viewMode.value = 'list'
}

watch(() => newLogsCount.value, (count) => {
    if (isLive.value && count > 0) {
        refreshLogs()
    }
})

watch(isLive, (val) => {
    if (val && newLogsCount.value > 0) {
        refreshLogs()
    }
})

// Filters
const filters = reactive({
    search: '',
    level: undefined as string | undefined,
    structured: {} as Record<string, string>
})

// Sync level from structured filters to specific level filter
watch(() => filters.structured.level, (newLevel) => {
    if (newLevel !== filters.level) {
        filters.level = newLevel
    }
})

// Sync level from specific filter to structured filters
watch(() => filters.level, (newLevel) => {
    if (newLevel && filters.structured.level !== newLevel) {
        filters.structured.level = newLevel
    } else if (!newLevel && filters.structured.level) {
        const { level, ...rest } = filters.structured
        filters.structured = rest
    }
})

// Color mode for VueJsonPretty
const colorMode = useColorMode()
const jsonTheme = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

// Data Fetching
const { data: initialData, pending, refresh } = await useAsyncData('logs',
    () => fetchApi<{ data: any[], nextCursor?: string | null }>('/api/logs', {
        params: {
            limit: 50,
            cursor: undefined,
            search: filters.search,
            level: filters.level,
            filters: JSON.stringify(filters.structured),
            exclude_system_events: (!showSystemEvents.value).toString(),
            crash_only: showCrashesOnly.value.toString()
        }
    }),
    { watch: [filters, showSystemEvents, showCrashesOnly], server: false }
)

watch(initialData, (newVal) => {
    if (newVal?.data) {
        logs.value = newVal.data
        nextCursor.value = newVal.nextCursor || null
    } else {
        logs.value = []
        nextCursor.value = null
    }
}, { immediate: true })

watch(() => selectedProjectId.value, async (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
        await refreshLogs()
    }
})

const loadMore = async () => {
    if (!nextCursor.value) return

    loadingMore.value = true
    const res = await fetchApi<{ data: any[], nextCursor?: string | null }>('/api/logs', {
        params: {
            limit: 50,
            cursor: nextCursor.value || undefined,
            search: filters.search,
            level: filters.level,
            filters: JSON.stringify(filters.structured),
            exclude_system_events: (!showSystemEvents.value).toString(),
            crash_only: showCrashesOnly.value.toString()
        }
    })
    if (res?.data) {
        logs.value.push(...res.data)
        nextCursor.value = res.nextCursor || null
    }
    loadingMore.value = false
}

// Helpers
const formatTime = (ts: string) => format(new Date(ts), 'HH:mm:ss.SSS')

const getLevelColor = (level: string) => {
    switch (level) {
        case 'error': return 'error'
        case 'warn': return 'warning'
        case 'debug': return 'info'
        default: return 'neutral'
    }
}

const formatSource = (source?: string) => {
    if (source === 'browser') return 'Browser'
    if (source === 'server') return 'Server'
    return 'Unknown'
}

const getSourceColor = (source?: string) => {
    if (source === 'browser') return 'neutral'
    return 'error'
}

const openDrawer = (log: any) => {
    selectedLog.value = log
    isDrawerOpen.value = true
    detailLoading.value = true

    fetchApi<{ data: any }>(`/api/logs/${log.id}`, {
        params: { project_id: selectedProjectId.value }
    }).then((res) => {
        if (res?.data) {
            // Merge details into selected log
            selectedLog.value = { ...selectedLog.value, ...res.data }
        }
    }).finally(() => {
        detailLoading.value = false
    })
}

const refreshLogs = async () => {
    await refresh() // Your existing refresh function
    resetCount() // Reset the counter to 0
    resetCriticalCount()
}

const isCrashLog = (log: any) => !!(log?.isCritical || log?.data?.error_source === 'auto_captured')
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #f9fafb;
    border-left: 1px solid #e5e7eb;
    border-top: 1px solid #e5e7eb;
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
    border-top: 1px solid #27272a;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #27272a;
    border: 2px solid #0c0c0e;
}

.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #3f3f46;
}
</style>
