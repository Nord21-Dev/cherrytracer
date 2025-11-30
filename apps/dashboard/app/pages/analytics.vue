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

        <div class="space-y-4">
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
import { formatDistanceToNow, endOfDay, eachDayOfInterval, isSameDay, eachHourOfInterval, isSameHour } from 'date-fns'
import EventSparkline from '~/components/viz/EventSparkline.vue'
import type { EventSparkPoint } from '~/components/viz/EventSparkline.vue'

const { fetchApi } = useCherryApi()
const { selectedProjectId } = useProject()

// Date Range State
const now = new Date()
const today = new CalendarDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
const sevenDaysAgo = today.subtract({ days: 7 })

const dateRange = ref({
    start: sevenDaysAgo,
    end: today
})

const df = new DateFormatter('en-US', {
    dateStyle: 'medium'
})

const groups = ref<any[]>([])
const isLoading = ref(false)

const fetchGroups = async () => {
    if (!selectedProjectId.value) return
    
    isLoading.value = true
    try {
        const start = dateRange.value.start.toDate(getLocalTimeZone())
        const end = dateRange.value.end.toDate(getLocalTimeZone())
        // Adjust end date to end of day to include all events of that day
        const endAdjusted = endOfDay(end)

        const res = await fetchApi<{ data: any[] }>('/api/events', {
            params: {
                project_id: selectedProjectId.value,
                limit: 1000,
                start_date: start.toISOString(),
                end_date: endAdjusted.toISOString(),
                filters: JSON.stringify({ 'data.type': 'event' })
            }
        })

        if (res?.data) {
            processEvents(res.data, start, endAdjusted)
        } else {
            groups.value = []
        }
    } catch (e) {
        console.error('Failed to fetch analytics', e)
        groups.value = []
    } finally {
        isLoading.value = false
    }
}

const processEvents = (events: any[], start: Date, end: Date) => {
    const eventGroups = new Map<string, any>();

    // 1. Group events
    for (const event of events) {
        const key = event.eventType || event.message;
        if (!eventGroups.has(key)) {
            eventGroups.set(key, {
                id: key,
                pattern: key,
                exampleMessage: event.message,
                count: 0,
                totalValue: 0,
                lastSeen: event.timestamp,
                events: [] // Store for sparkline generation
            });
        }
        const group = eventGroups.get(key)!;
        group.count += 1;
        group.totalValue += (event.value || 0);
        if (new Date(event.timestamp) > new Date(group.lastSeen)) {
            group.lastSeen = event.timestamp;
            group.exampleMessage = event.message;
        }
        group.events.push(event);
    }

    // 2. Generate sparkline data for each group
    const result = Array.from(eventGroups.values()).map(group => {
        group.sparkline = generateSparkline(group.events, start, end)
        delete group.events // Cleanup to save memory
        return group
    })

    // 3. Sort by count
    groups.value = result.sort((a, b) => b.count - a.count).slice(0, 50);
}

const generateSparkline = (events: any[], start: Date, end: Date): EventSparkPoint[] => {
    // Determine bucket size (hour or day)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    const useHours = durationHours <= 48

    let buckets: Date[] = []
    try {
        buckets = useHours
            ? eachHourOfInterval({ start, end })
            : eachDayOfInterval({ start, end })
    } catch (e) {
        // Fallback if interval is invalid
        return []
    }

    const points = buckets.map(date => ({
        timestamp: date.getTime(),
        count: 0
    }))

    for (const event of events) {
        const ts = new Date(event.timestamp)
        const bucketIndex = useHours
            ? buckets.findIndex(b => isSameHour(b, ts))
            : buckets.findIndex(b => isSameDay(b, ts))

        if (bucketIndex !== -1) {
            points[bucketIndex].count++
        }
    }

    return points
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
    return new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(num)
}
</script>
