<template>
    <UContainer class="py-8 space-y-6">
        <!-- 1. Header & Controls -->
        <div class="flex flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">Events</h1>
            </div>
            <div class="flex items-center gap-3">
                <UBadge v-if="!isLive && newLogsCount > 0" color="primary" variant="solid" size="xs"
                    class="rounded-full">
                    {{ newLogsCount }}
                </UBadge>
                <USwitch v-model="isLive" label="Live" color="success" />
            </div>
        </div>

        <!-- Filters Toolbar -->
        <FilterBar v-model:search="filters.search" v-model:filters="filters.structured" @refresh="refreshLogs" />

        <UCard>
            <template #header>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <UIcon name="i-lucide-activity" class="text-neutral-500 dark:text-neutral-500" />
                        <h3 class="text-sm font-medium text-neutral-800 dark:text-neutral-200">Live Events</h3>
                    </div>
                </div>
            </template>
            
            <div v-if="logs.length" class="font-mono text-xs">
                <div class="custom-scrollbar overflow-x-auto">
                    <table class="w-full min-w-[720px] text-left border-collapse">
                        <thead
                            class="bg-neutral-50/50 dark:bg-white/2 text-neutral-500 dark:text-neutral-500 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th
                                    class="px-4 py-2 font-medium w-40 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest text-left">
                                    Timestamp</th>
                                <th
                                    class="py-2 font-medium border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Event Name</th>
                                <th
                                    class="py-2 font-medium w-32 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Event Type</th>
                                <th
                                    class="py-2 font-medium w-32 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    User ID</th>
                                <th
                                    class="py-2 font-medium w-32 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Session ID</th>
                                <th
                                    class="py-2 font-medium w-24 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Value</th>
                                <th
                                    class="py-2 font-medium w-36 border-b border-neutral-200 dark:border-neutral-800 text-[10px] uppercase tracking-widest">
                                    Trace</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800/50">
                            <tr v-for="log in logs" :key="log.id" :class="['group hover:bg-neutral-100/30 dark:hover:bg-white/3 transition-colors cursor-pointer relative']" @click="openDrawer(log)">
                                <td
                                    class="py-1 px-1 text-neutral-500 dark:text-neutral-500 whitespace-nowrap group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                                    {{ formatTime(log.timestamp) }}
                                </td>
                                <td class=" text-neutral-700 dark:text-neutral-300">
                                    <div class="flex items-center gap-2 max-w-64">
                                        <p
                                            class="truncate whitespace-nowrap text-xs font-mono text-neutral-900 dark:text-neutral-100 opacity-90 group-hover:opacity-100">
                                            {{ log.message }}
                                        </p>
                                    </div>
                                    <div v-if="log.data && Object.keys(log.data).length"
                                        class="mt-1 text-[10px] opacity-50 truncate max-w-md">
                                        {{ formatData(log.data) }}
                                    </div>
                                </td>
                                <td class="py-1 text-neutral-700 dark:text-neutral-300">
                                    <span class="text-xs font-mono">{{ log.eventType || 'N/A' }}</span>
                                </td>
                                <td class="py-1 text-neutral-700 dark:text-neutral-300">
                                    <span class="text-xs font-mono truncate max-w-32" :title="log.userId">{{ log.userId || 'N/A' }}</span>
                                </td>
                                <td class="py-1 text-neutral-700 dark:text-neutral-300">
                                    <span class="text-xs font-mono truncate max-w-32" :title="log.sessionId">{{ log.sessionId || 'N/A' }}</span>
                                </td>
                                <td class="py-1 text-neutral-700 dark:text-neutral-300">
                                    <span class="text-xs font-mono">{{ log.value ? formatValue(log.value) : 'N/A' }}</span>
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

            <div v-else
                class="p-12 text-center text-neutral-500 dark:text-neutral-500">
                <UIcon name="i-lucide-inbox" class="text-4xl mb-2" />
                <p>No events found.</p>
            </div>

            <!-- Pagination / Load More -->
            <div v-if="logs.length > 0"
                class="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-center">
                <UButton variant="ghost" color="neutral" size="sm" @click="loadMore" :loading="loadingMore"
                    :disabled="!nextCursor">
                    {{ nextCursor ? 'Load older events' : 'No more events' }}
                </UButton>
            </div>
        </UCard>

        <!-- Detail Drawer -->
        <USlideover v-model:open="isDrawerOpen" title="Event Details">
            <template #body>
                <div v-if="selectedLog" class="space-y-6 flex-1 overflow-y-auto">
                    <div v-if="detailLoading" class="text-xs text-neutral-500 dark:text-neutral-500">
                        Loading full details...
                    </div>
                    <div>
                        <label
                            class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Event Name</label>
                        <div class="mt-1 text-neutral-900 dark:text-neutral-200 font-mono">{{ selectedLog.message }}</div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
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
                            <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Event
                                Type</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.eventType || 'N/A' }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">User
                                ID</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.userId || 'N/A' }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Session
                                ID</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.sessionId || 'N/A' }}</div>
                        </div>
                        <div>
                            <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Value</label>
                            <div class="mt-1 font-mono text-sm">{{ selectedLog.value ? formatValue(selectedLog.value) : 'N/A' }}</div>
                        </div>
                    </div>

                    <div>
                        <label class="text-xs text-neutral-500 dark:text-neutral-500 uppercase font-bold">Attributes</label>
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
const { newLogsCount, resetCount } = useRealtime()

// State
const logs = ref<any[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
const isDrawerOpen = ref(false)
const selectedLog = ref<any>(null)
const detailLoading = ref(false)
const isLive = ref(true)

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
    structured: {} as Record<string, string>
})

// Color mode for VueJsonPretty
const colorMode = useColorMode()
const jsonTheme = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

// Data Fetching
const { data: initialData, pending, refresh } = await useAsyncData('events',
    () => fetchApi<{ data: any[], nextCursor?: string | null }>('/api/events', {
        params: {
            limit: 50,
            cursor: undefined,
            search: filters.search,
            filters: JSON.stringify(filters.structured),
        }
    }),
    { watch: [filters], server: false }
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
    const res = await fetchApi<{ data: any[], nextCursor?: string | null }>('/api/events', {
        params: {
            limit: 50,
            cursor: nextCursor.value || undefined,
            search: filters.search,
            filters: JSON.stringify(filters.structured),
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

const formatData = (data: any) => {
    const { type, ...rest } = data || {}
    return JSON.stringify(rest).slice(0, 100) + (JSON.stringify(rest).length > 100 ? '...' : '')
}

const formatValue = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return isNaN(num) ? 'N/A' : num.toFixed(2)
}

const openDrawer = (log: any) => {
    selectedLog.value = log
    isDrawerOpen.value = true
    detailLoading.value = true

    fetchApi<{ data: any }>(`/api/events/${log.id}`, {
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
    await refresh()
    resetCount()
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
