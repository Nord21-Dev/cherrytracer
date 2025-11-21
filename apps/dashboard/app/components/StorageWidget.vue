<template>
    <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
        <div v-if="loading" class="h-8 animate-pulse bg-gray-100 dark:bg-neutral-800 rounded"></div>
        <div v-else>
            <div class="flex justify-between items-end mb-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Storage</span>
                <span class="text-[10px] font-mono" :class="usageColor">
                    {{ formatBytes(stats.used_bytes) }} / {{ formatBytes(stats.hard_limit_bytes) }}
                </span>
            </div>
            
            <!-- The Bar -->
            <div class="h-1.5 w-full bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden flex">
                <!-- Used Space -->
                <div 
                    class="h-full transition-all duration-500"
                    :class="barColor"
                    :style="{ width: `${percentUsed}%` }"
                ></div>
            </div>

            <!-- Markers -->
            <div class="mt-1 flex justify-between text-[9px] text-gray-400">
                <span>{{ percentUsed.toFixed(0) }}%</span>
                <span v-if="percentSoft > 0 && percentSoft < 100" class="text-orange-400">Limit: {{ formatBytes(stats.soft_limit_bytes) }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const { fetchApi } = useCherryApi()

const stats = ref({
    used_bytes: 0,
    soft_limit_bytes: 0,
    hard_limit_bytes: 0
})
const loading = ref(true)

const refreshStats = async () => {
    try {
        const res = await fetchApi<any>('/api/system/storage', { skipProject: true })
        stats.value = res
    } catch (e) {
        // silent fail
    } finally {
        loading.value = false
    }
}

// Calculate Percentages
const percentUsed = computed(() => {
    if (!stats.value.hard_limit_bytes) return 0
    return Math.min((stats.value.used_bytes / stats.value.hard_limit_bytes) * 100, 100)
})

const percentSoft = computed(() => {
    if (!stats.value.hard_limit_bytes) return 0
    return Math.min((stats.value.soft_limit_bytes / stats.value.hard_limit_bytes) * 100, 100)
})

// Dynamic Colors
const barColor = computed(() => {
    if (stats.value.used_bytes > stats.value.hard_limit_bytes * 0.95) return 'bg-red-500'
    if (stats.value.used_bytes > stats.value.soft_limit_bytes) return 'bg-orange-500'
    return 'bg-primary-500'
})

const usageColor = computed(() => {
    if (stats.value.used_bytes > stats.value.soft_limit_bytes) return 'text-orange-500 font-bold'
    return 'text-gray-500 dark:text-neutral-400'
})

const formatBytes = (bytes: number, decimals = 1) => {
    if (!+bytes) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

onMounted(() => {
    refreshStats()
})
</script>