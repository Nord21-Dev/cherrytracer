<template>
    <div class="space-y-4">
        <!-- Severity Tabs -->
        <div class="flex justify-center">
            <UTabs :items="severityTabs" v-model="selectedSeverity" :content="false" size="xs" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <UCard v-for="group in groups" :key="group.id"
                class="group cursor-pointer hover:ring-2 hover:ring-primary-500/50 transition-all duration-200"
                @click="$emit('select', group)">

                <div class="flex justify-between items-start mb-3">
                    <UBadge :color="getLevelColor(group.level)" variant="subtle" size="xs" class="uppercase font-bold">
                        {{ group.level }}
                    </UBadge>
                    <div class="text-xs text-neutral-500 font-mono">
                        {{ formatTime(group.lastSeen) }}
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2 font-mono break-all"
                        :title="group.pattern">
                        {{ group.pattern }}
                    </h4>
                    <p class="text-xs text-neutral-500 mt-1 line-clamp-1 opacity-75">
                        {{ group.exampleMessage }}
                    </p>
                </div>

                <div
                    class="flex items-end justify-between mt-auto pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <div class="flex flex-col">
                        <span class="text-[10px] uppercase text-neutral-400 font-bold tracking-wider">Count</span>
                        <span class="text-lg font-bold text-neutral-900 dark:text-white">{{ formatCount(group.count)
                            }}</span>
                    </div>

                    <!-- Simple visual indicator of 'heat' based on count -->
                    <div class="flex gap-0.5 items-end h-6">
                        <div v-for="i in 5" :key="i" class="w-1 h-1 rounded-full transition-all duration-500"
                            :class="getBarClass(i, group.count)">
                        </div>
                    </div>
                </div>
            </UCard>
        </div>
    </div>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'

const props = defineProps<{
    projectId: string
    crashOnly?: boolean
}>()

defineEmits(['select'])

const { fetchApi } = useCherryApi()
const groups = ref<any[]>([])
const selectedSeverity = ref('error') // Index of the tab

const severityTabs = [
    { label: 'All', value: 'all' },
    { label: 'Errors', value: 'error' },
    { label: 'Warnings', value: 'warn' },
    { label: 'Info', value: 'info' }
]

const fetchGroups = async () => {
    const level = selectedSeverity.value === 'all' ? undefined : selectedSeverity.value;

    const res = await fetchApi<{ data: any[] }>('/api/groups', {
        params: {
            project_id: props.projectId,
            limit: 50,
            sort: 'last_seen',
            level,
            exclude_system_events: 'true',
            crash_only: props.crashOnly ? 'true' : undefined
        }
    })
    if (res?.data) {
        groups.value = res.data
    }
}

// Initial fetch
await fetchGroups()

// Poll every 5 seconds
useIntervalFn(() => {
    fetchGroups()
}, 5000)

// Watch for tab changes
watch([selectedSeverity, () => props.crashOnly, () => props.projectId], () => {
    fetchGroups()
})

// Helpers
const getLevelColor = (level: string) => {
    switch (level) {
        case 'error': return 'error'
        case 'warn': return 'warning'
        case 'debug': return 'info'
        default: return 'neutral'
    }
}

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

const getBarClass = (i: number, count: number) => {
    // Higher count = more active bars colored
    const threshold = count > 100 ? 5 : count > 10 ? 3 : 1
    return i <= threshold ? 'bg-primary-500 dark:bg-primary-400' : 'bg-neutral-200 dark:bg-neutral-800'
}
</script>
