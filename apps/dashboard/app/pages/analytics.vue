<template>
    <UContainer class="py-8 space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">Analytics</h1>
                <UBadge color="primary" variant="subtle" size="xs">Beta</UBadge>
            </div>

            <!-- Date Range Picker -->
            <UPopover :popper="{ placement: 'bottom-end' }">
                <UButton color="neutral" variant="subtle" icon="i-lucide-calendar">
                    <template v-if="dateRange.start">
                        <template v-if="dateRange.end">
                            {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }} - {{
                                df.format(dateRange.end.toDate(getLocalTimeZone())) }}
                        </template>

                        <template v-else>
                            {{ df.format(dateRange.start.toDate(getLocalTimeZone())) }}
                        </template>
                    </template>
                    <template v-else>
                        Pick a date
                    </template>
                </UButton>

                <template #content>
                    <UCalendar v-model="dateRange" class="p-2" :number-of-months="2" range />
                </template>
            </UPopover>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UCard v-for="group in groups" :key="group.id"
                class="group hover:ring-2 hover:ring-primary-500/50 transition-all duration-200">
                <div class="flex flex-col md:flex-row gap-6 items-center">
                    <!-- Info -->
                    <div class="flex-1 min-w-0 w-full md:w-auto">
                        <div class="flex items-center gap-2 mb-1">
                            <UBadge color="neutral" variant="subtle" size="xs" class="uppercase font-bold">
                                Event
                            </UBadge>
                            <span class="text-xs text-neutral-500 font-mono">
                                Last seen {{ formatTime(group.lastSeen) }}
                            </span>
                        </div>
                        <h4 class="text-lg font-medium text-neutral-900 dark:text-white font-mono break-all"
                            :title="group.pattern">
                            {{ group.pattern }}
                        </h4>
                    </div>

                    <!-- Sparkline -->
                    <div class="h-16 w-full md:w-48 lg:w-64 shrink-0">
                        <EventSparkline :data="group.sparkline" />
                    </div>

                    <!-- Stats -->
                    <div class="flex items-center gap-8 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-neutral-100 dark:border-neutral-800 pt-4 md:pt-0">
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] uppercase text-neutral-400 font-bold tracking-wider">Count</span>
                            <span class="text-2xl font-bold text-neutral-900 dark:text-white">
                                {{ formatCount(group.count) }}
                            </span>
                        </div>
                        <div v-if="group.totalValue > 0" class="flex flex-col items-end">
                            <span class="text-[10px] uppercase text-neutral-400 font-bold tracking-wider">Value</span>
                            <span class="text-2xl font-bold text-neutral-900 dark:text-white">
                                {{ formatCount(group.totalValue) }}
                            </span>
                        </div>
                    </div>
                </div>
            </UCard>

            <div v-if="groups.length === 0 && !isLoading" class="text-center py-12 text-neutral-500">
                <UIcon name="i-lucide-bar-chart-3" class="text-4xl mb-2" />
                <p>No analytics data found for this period.</p>
                <p class="text-xs mt-2">Try adjusting the date range or track events using <code>cherry.track('event_name')</code></p>
            </div>
            
            <div v-if="isLoading" class="text-center py-12 text-neutral-500">
                <UIcon name="i-lucide-loader-2" class="text-4xl mb-2 animate-spin" />
                <p>Loading analytics...</p>
            </div>
        </div>
    </UContainer>
</template>

<script setup lang="ts">
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { formatDistanceToNow, endOfDay } from 'date-fns'
import EventSparkline from '~/components/viz/EventSparkline.vue'
import type { EventSparkPoint } from '~/components/viz/EventSparkline.vue'

const { fetchApi } = useCherryApi()
const { selectedProjectId } = useProject()

type AnalyticsGroup = {
    id: string
    eventName: string
    pattern: string
    count: number
    totalValue: number
    lastSeen: string
    sparkline: EventSparkPoint[]
}

// Date Range State
const now = new Date()
const today = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
const sevenDaysAgo = today.subtract({ days: 7 })

const dateRange = ref<any>({
    start: sevenDaysAgo,
    end: today
})

const df = new DateFormatter('en-US', {
    dateStyle: 'medium'
})

const groups = ref<AnalyticsGroup[]>([])
const isLoading = ref(false)
let refreshQueued = false

const fetchGroups = async () => {
    const projectId = selectedProjectId.value
    const range = dateRange.value
    if (!projectId || !range?.start || !range?.end) return
    if (isLoading.value) {
        refreshQueued = true
        return
    }
    
    isLoading.value = true
    try {
        const start = range.start.toDate(getLocalTimeZone())
        const endAdjusted = endOfDay(range.end.toDate(getLocalTimeZone()))

        const res = await fetchApi<{ data: any[] }>('/api/events/analytics', {
            params: {
                project_id: projectId,
                start_date: start.toISOString(),
                end_date: endAdjusted.toISOString()
            }
        })

        if (res?.data) {
            groups.value = res.data.map((item: any) => {
                const sparkline = (item.sparkline || []).map((point: any) => {
                    const ts = point.timestamp instanceof Date
                        ? point.timestamp.getTime()
                        : typeof point.timestamp === 'string'
                            ? new Date(point.timestamp).getTime()
                            : Number(point.timestamp)

                    return {
                        timestamp: ts,
                        count: Number(point.count) || 0,
                        totalValue: Number(point.totalValue) || 0
                    } as EventSparkPoint
                })

                const name = item.eventName || item.id
                const lastSeen = item.lastSeen instanceof Date
                    ? item.lastSeen.toISOString()
                    : typeof item.lastSeen === 'string'
                        ? item.lastSeen
                        : ''

                return {
                    id: item.id || name,
                    eventName: name,
                    pattern: name,
                    count: Number(item.count) || 0,
                    totalValue: Number(item.totalValue) || 0,
                    lastSeen,
                    sparkline
                } as AnalyticsGroup
            })
        } else {
            groups.value = []
        }
    } catch (e) {
        console.error('Failed to fetch analytics', e)
        groups.value = []
    } finally {
        isLoading.value = false
        if (refreshQueued) {
            refreshQueued = false
            fetchGroups()
        }
    }
}

// Initial fetch
onMounted(() => {
    fetchGroups()
})

// Poll every 10 seconds (reduced frequency due to heavier processing)
useIntervalFn(() => {
    fetchGroups()
}, 10000)

// Watch for changes
watch([selectedProjectId, dateRange], () => {
    fetchGroups()
}, { deep: true })

// Helpers
const formatTime = (ts: string) => {
    try {
        return formatDistanceToNow(new Date(ts), { addSuffix: true })
    } catch (e) {
        return ts
    }
}

const formatCount = (num: number) => {
    return new Intl.NumberFormat('en-US', {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 2
    }).format(num || 0)
}
</script>
