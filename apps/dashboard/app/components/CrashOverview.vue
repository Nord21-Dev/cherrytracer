<template>
    <UCard>
        <template #header>
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-alert-triangle" class="text-error-500" />
                    <h3 class="text-sm font-medium">Crash Overview</h3>
                </div>
                <UBadge color="error" variant="solid" size="xs" class="uppercase tracking-widest">
                    {{ totalHits }} hits
                </UBadge>
            </div>
        </template>

        <div v-if="loading" class="space-y-2 animate-pulse">
            <div v-for="i in 3" :key="i" class="h-12 bg-neutral-100 dark:bg-neutral-900 rounded" />
        </div>

        <div v-else-if="!crashes.length" class="text-sm text-neutral-500 dark:text-neutral-400 text-center py-6">
            No auto-captured crashes yet.
        </div>

        <div v-else class="space-y-3">
            <div v-for="crash in crashes" :key="crashKey(crash)"
                class="rounded border border-neutral-200 dark:border-neutral-800 p-3 bg-white dark:bg-neutral-900">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-mono text-neutral-900 dark:text-neutral-100 break-all">
                            {{ crash.message }}
                        </p>
                        <p class="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                            {{ crash.error_type || crash.error_name || 'Crash' }}
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ crash.count }}</p>
                        <p class="text-[10px] uppercase tracking-widest text-neutral-400">hits</p>
                    </div>
                </div>
                <div class="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap gap-3">
                    <span class="font-mono truncate max-w-[70%]" :title="crash.top_frame || 'unknown frame'">
                        {{ crash.top_frame || 'Top frame unavailable' }}
                    </span>
                    <span class="ml-auto">{{ formatRelative(crash.last_seen) }}</span>
                </div>
            </div>
        </div>
    </UCard>
</template>

<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import type { Ref } from 'vue'

const props = withDefaults(defineProps<{ limit?: number }>(), {
    limit: 8
})

const { fetchApi } = useCherryApi()
const { selectedProjectId } = useProject()

const crashes: Ref<any[]> = ref([])
const loading = ref(false)

const loadCrashes = async () => {
    if (!selectedProjectId.value) {
        crashes.value = []
        return
    }

    loading.value = true
    try {
        const res = await fetchApi<{ data: any[] }>('/api/crashes', {
            params: {
                project_id: selectedProjectId.value,
                limit: props.limit.toString()
            }
        })
        crashes.value = Array.isArray(res?.data) ? res!.data : []
    } catch (e) {
        crashes.value = []
    } finally {
        loading.value = false
    }
}

await loadCrashes()

watch(() => selectedProjectId.value, () => {
    loadCrashes()
})

useIntervalFn(() => {
    loadCrashes()
}, 10000)

const crashKey = (crash: any) => `${crash.message}-${crash.top_frame}-${crash.error_type}`

const formatRelative = (value: string | null) => {
    if (!value) return 'unknown'
    try {
        return formatDistanceToNow(new Date(value), { addSuffix: true })
    } catch (e) {
        return value
    }
}

const totalHits = computed(() => crashes.value.reduce((sum, item) => sum + (item.count || 0), 0))
</script>
