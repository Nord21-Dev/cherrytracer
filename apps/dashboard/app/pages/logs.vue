<template>
    <UContainer class="py-8 space-y-6">
        <!-- 1. Header & Controls -->
        <div class="flex flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Logs</h1>
            </div>
            <div class="flex items-center gap-3">
                <UBadge v-if="!isLive && newLogsCount > 0" color="primary" variant="solid" size="xs"
                    class="rounded-full">
                    {{ newLogsCount }}
                </UBadge>
                <div class="flex items-center gap-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Live data</span>
                    <USwitch v-model="isLive" />
                </div>
            </div>
        </div>

        <!-- Filters Toolbar -->
        <FilterBar
            v-model:search="filters.search"
            v-model:filters="filters.structured"
            @refresh="refreshLogs"
        />

        <UCard>
            <template #header>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-terminal" class="text-neutral-500 dark:text-neutral-500" />
                        <h3 class="text-sm font-medium text-gray-800 dark:text-neutral-200">Live Logs</h3>
                    </div>

                    <UTabs :items="tabItems" v-model="viewMode" :content="false" size="sm"/>
                </div>
            </template>
            <LogGroups v-if="viewMode === 'patterns'" :project-id="selectedProjectId || ''" @select="selectPattern" />
            <div v-else-if="logs.length" class="font-mono text-xs">
                <div class="custom-scrollbar overflow-x-auto">
                    <table class="w-full min-w-[720px] text-left border-collapse">
                        <thead
                            class="bg-gray-50/50 dark:bg-white/2 text-gray-500 dark:text-neutral-500 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th
                                    class="px-4 py-2 font-medium w-40 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest text-left">
                                    Timestamp</th>
                                <th
                                    class="px-4 py-2 font-medium w-24 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Level</th>
                                <th
                                    class="px-4 py-2 font-medium w-28 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Source</th>
                                <th
                                    class="px-4 py-2 font-medium border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Message</th>
                                <th
                                    class="px-4 py-2 font-medium w-36 border-b border-gray-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Trace</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-neutral-800/50">
                            <tr v-for="log in logs" :key="log.id"
                                class="group hover:bg-gray-100/30 dark:hover:bg-white/3 transition-colors cursor-pointer"
                                @click="openDrawer(log)">
                                <td
                                    class="px-4 py-2 text-gray-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-gray-700 dark:group-hover:text-neutral-300">
                                    {{ formatTime(log.timestamp) }}
                                </td>
                                <td class="px-4 py-2">
                                    <UBadge :color="getLevelColor(log.level)" variant="subtle" size="xs"
                                        class="uppercase tracking-wider font-bold scale-90 origin-left">
                                        {{ log.level }}
                                    </UBadge>
                                </td>
                                <td class="px-4 py-2">
                                    <UBadge :color="getSourceColor(log.source)" variant="subtle" size="xs"
                                        class="uppercase tracking-wider font-semibold scale-90 origin-left">
                                        {{ formatSource(log.source) }}
                                    </UBadge>
                                </td>
                                <td class="px-4 py-2 text-gray-700 dark:text-neutral-300">
                                    <p
                                        class="text-xs font-mono text-gray-900 dark:text-neutral-100 opacity-90 group-hover:opacity-100 break-all">
                                        {{ log.message }}
                                    </p>
                                    <div v-if="log.data && Object.keys(log.data).length"
                                        class="mt-1 text-[10px] opacity-50">
                                        {{ JSON.stringify(log.data) }}
                                    </div>
                                </td>
                                <td class="px-4 py-2">
                                    <UButton v-if="log.traceId" :to="`/traces/${log.traceId}`" variant="ghost"
                                        color="primary" size="xs" @click.stop
                                        class="font-mono px-2 py-1 text-[11px] hover:bg-primary-500/10">
                                        View Trace
                                    </UButton>
                                    <span v-else class="text-gray-400 dark:text-neutral-600 tracking-widest">—</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div v-else-if="viewMode === 'list'" class="p-12 text-center text-gray-500 dark:text-neutral-500">
                <UIcon name="i-lucide-inbox" class="text-4xl mb-2" />
                <p>No logs found.</p>
            </div>

            <!-- Pagination / Load More -->
            <div v-if="logs.length > 0 && viewMode === 'list'"
                class="p-3 border-t border-gray-200 dark:border-neutral-800 flex justify-center">
                <UButton variant="ghost" color="neutral" size="sm" @click="loadMore" :loading="loadingMore">
                    Load older logs
                </UButton>
            </div>
        </UCard>

        <!-- Detail Drawer -->
        <USlideover v-model:open="isDrawerOpen" title="Log Details">
            <template #body>
                <div v-if="selectedLog" class="space-y-6 flex-1 overflow-y-auto">
                    <div>
                        <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Message</label>
                        <div class="mt-1 text-gray-900 dark:text-neutral-200">{{ selectedLog.message }}</div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Level</label>
                            <div class="mt-1 uppercase">{{ selectedLog.level }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Source</label>
                            <div class="mt-1 uppercase">{{ formatSource(selectedLog.source) }}</div>
                        </div>
                        <div>
                            <label
                                class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Timestamp</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.timestamp }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Trace
                                ID</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.traceId || 'N/A' }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Span
                                ID</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.spanId || 'N/A' }}</div>
                        </div>
                    </div>

                    <div>
                        <label class="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold">Payload
                            Data</label>
                        <div
                            class="mt-2 bg-gray-50 dark:bg-neutral-900 p-4 rounded border border-gray-200 dark:border-neutral-800 text-xs font-mono overflow-x-auto">
                            <VueJsonPretty :data="selectedLog.data" :deep="2" :theme="jsonTheme" />
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
const { newLogsCount, resetCount } = useRealtime()

// State
const logs = ref<any[]>([])
const offset = ref(0)
const loadingMore = ref(false)
const isDrawerOpen = ref(false)
const selectedLog = ref<any>(null)
const isLive = ref(true)
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
    () => fetchApi<{ data: any[] }>('/api/logs', {
        params: {
            limit: 50,
            offset: 0,
            search: filters.search,
            level: filters.level,
            filters: JSON.stringify(filters.structured)
        }
    }),
    { watch: [filters], server: false }
)

watch(initialData, (newVal) => {
    if (newVal?.data) {
        logs.value = newVal.data
        offset.value = 0
    } else {
        logs.value = []
    }
}, { immediate: true })

watch(() => selectedProjectId.value, async (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
        await refreshLogs()
    }
})

const loadMore = async () => {
    loadingMore.value = true
    const nextOffset = offset.value + 50
    const res = await fetchApi<{ data: any[] }>('/api/logs', {
        params: {
            limit: 50,
            offset: nextOffset,
            search: filters.search,
            level: filters.level,
            filters: JSON.stringify(filters.structured)
        }
    })
    if (res?.data) {
        logs.value.push(...res.data)
        offset.value = nextOffset
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
        default: return 'primary'
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
}

const refreshLogs = async () => {
    await refresh() // Your existing refresh function
    resetCount() // Reset the counter to 0
}
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
