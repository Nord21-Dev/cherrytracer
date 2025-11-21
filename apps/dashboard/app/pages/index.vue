<template>
    <UContainer class="py-8 space-y-8">

        <!-- 1. Header & Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Overview</h1>
                <ClientOnly>
                    <p class="text-gray-500 dark:text-neutral-400 text-sm">System health{{ selectedProject?.name ? ` for ${selectedProject.name}` : '' }}</p>
                </ClientOnly>
            </div>

            <UTabs v-model="selectedPeriod" :items="periods" size="sm" />
        </div>

        <div class="space-y-8 animate-in fade-in duration-500">

            <!-- 2. KPI Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- Total Traffic -->
                <UCard class="ring-1 ring-gray-200 dark:ring-neutral-800 bg-white dark:bg-neutral-900/50">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                                Total Requests</p>
                            <h3 class="text-2xl font-bold mt-1">{{ stats?.kpis?.total_requests?.toLocaleString() || '0'
                                }}</h3>
                        </div>
                        <div
                            class="p-2 rounded-lg bg-neutral-500/10 text-neutral-500 aspect-square flex items-center justify-center">
                            <UIcon name="i-lucide-activity" class="w-5 h-5" />
                        </div>
                    </div>
                </UCard>

                <!-- Error Rate -->
                <UCard class="ring-1 ring-gray-200 dark:ring-neutral-800 bg-white dark:bg-neutral-900/50">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                                Error Rate</p>
                            <div class="flex items-baseline gap-2 mt-1">
                                <h3 class="text-2xl font-bold" :class="getErrorColor(stats?.kpis?.error_rate || '0')">
                                    {{ stats?.kpis?.error_rate || '0' }}%
                                </h3>
                            </div>
                        </div>
                        <div
                            class="p-2 rounded-lg bg-red-500/10 text-red-500 aspect-square flex items-center justify-center">
                            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5" />
                        </div>
                    </div>
                </UCard>

                <!-- Active Traces -->
                <UCard class="ring-1 ring-gray-200 dark:ring-neutral-800 bg-white dark:bg-neutral-900/50">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-500">
                                Unique Traces</p>
                            <h3 class="text-2xl font-bold mt-1">{{ stats?.kpis?.active_traces?.toLocaleString() || '0'
                                }}</h3>
                        </div>
                        <div
                            class="p-2 rounded-lg bg-blue-500/10 text-blue-500 aspect-square flex items-center justify-center">
                            <UIcon name="i-lucide-network" class="w-5 h-5" />
                        </div>
                    </div>
                </UCard>
            </div>

            <!-- 3. The Pulse Chart -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 h-full">
                    <UCard class="h-full flex flex-col ring-1 ring-gray-200 dark:ring-neutral-800">
                        <template #header>
                            <div class="flex items-center justify-between">
                                <div class="flex flex-col">
                                    <h3 class="font-semibold text-gray-900 dark:text-white">Traffic Volume</h3>
                                    <span class="text-xs text-gray-400 font-normal">
                                        {{ selectedPeriod === '1h' ? 'Last 60 Minutes' : selectedPeriod === '24h' ?
                                        'Last 24 Hours' : 'Last 7 Days' }}
                                    </span>
                                </div>
                                <div class="flex items-center gap-4 text-xs">
                                    <div class="flex items-center gap-1.5">
                                        <span class="w-2 h-2 rounded-full bg-green-500"></span>
                                        <span class="text-gray-500">Success</span>
                                    </div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="w-2 h-2 rounded-full bg-red-500"></span>
                                        <span class="text-gray-500">Error</span>
                                    </div>
                                </div>
                            </div>
                        </template>

                        <div class="p-2 min-h-[300px]">
                            <VizPulseChart :data="stats?.chart || []" :period="selectedPeriod" />
                        </div>
                    </UCard>
                </div>

                <!-- 4. Top Offenders List -->
                <div class="lg:col-span-1">
                    <UCard class="h-full ring-1 ring-gray-200 dark:ring-neutral-800">
                        <template #header>
                            <div class="flex items-center gap-2">
                                <UIcon name="i-lucide-siren" class="text-red-500" />
                                <h3 class="font-semibold text-gray-900 dark:text-white">Top Offenders</h3>
                            </div>
                        </template>

                        <div class="space-y-1">
                            <div v-if="!stats?.offenders?.length" class="text-sm text-neutral-500 py-4 text-center">
                                System is healthy. No errors found. 🍒
                            </div>

                            <div v-for="(err, idx) in stats?.offenders || []" :key="idx"
                                class="group p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-neutral-700">
                                <div class="flex justify-between items-start mb-1">
                                    <UBadge color="error" variant="subtle" size="xs" class="font-bold">{{ err.count }}x
                                    </UBadge>
                                    <span class="text-[10px] text-neutral-500 font-mono">{{ formatTime(err.last_seen)
                                        }}</span>
                                </div>
                                <p class="text-xs font-mono text-gray-700 dark:text-neutral-300 break-all line-clamp-2"
                                    :title="err.message">
                                    {{ err.message }}
                                </p>
                            </div>
                        </div>
                    </UCard>
                </div>
            </div>
        </div>
    </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
  ssr: false
})

import { formatDistanceToNow } from 'date-fns'

const { fetchApi } = useCherryApi()
const { selectedProject } = useProject()
const { lastUpdate } = useRealtime()

const periods = [
    { value: '1h', label: '1H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' }
]
const selectedPeriod = ref('24h')

const { data: stats, pending, refresh } = await useAsyncData(
    'dashboard-stats',
    () => fetchApi<any>('/api/stats/dashboard', {
        params: {
            project_id: selectedProject.value?.id,
            period: selectedPeriod.value
        }
    }),
    {
        watch: [selectedProject, selectedPeriod],
        server: false // Fetch on client to allow timezone correctness and animation
    }
)

// ⚡️ Live Update Logic
watch(lastUpdate, () => {
    // Debounce slightly to avoid spamming refresh if logs come in fast bursts
    refresh()
})

const getErrorColor = (rate: string) => {
    const r = parseFloat(rate)
    if (r > 5) return 'text-red-500'
    if (r > 1) return 'text-orange-500'
    return 'text-emerald-500'
}

const formatTime = (ts: string) => formatDistanceToNow(new Date(ts), { addSuffix: true })
</script>