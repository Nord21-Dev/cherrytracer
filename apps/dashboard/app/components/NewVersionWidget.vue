<template>
    <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
        <div v-if="loading" class="h-8 animate-pulse bg-gray-100 dark:bg-neutral-800 rounded"></div>
        <div v-else>
            <div class="flex justify-between items-end">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Version</span>
                <div class="flex items-center gap-1">
                    <span class="text-[10px] font-mono text-gray-500 dark:text-neutral-400">
                        <span v-if="versionInfo.update_available">New: </span>v{{ versionInfo.latest }}
                    </span>
                </div>
            </div>

            <!-- Version Details -->
            <div v-if="versionInfo.update_available" class="mt-1 flex justify-between text-[9px] text-gray-400">
                <span>
                    Current: v{{ versionInfo.current}}
                </span>
                <UBadge color="primary" variant="solid" size="xs"
                    class="animate-pulse cursor-pointer"
                    @click="navigateTo('/settings#system-updates')">
                    Update now
                </UBadge>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const { fetchApi } = useCherryApi()

const versionInfo = ref({
    current: '...',
    latest: '...',
    update_available: false,
    release_notes: '',
    release_url: ''
})
const loading = ref(true)

const refreshVersion = async () => {
    try {
        const res = await fetchApi<any>('/api/system/version', { skipProject: true })
        versionInfo.value = res
    } catch (e) {
        // silent fail
    } finally {
        loading.value = false
    }
}

onMounted(() => {
    refreshVersion()
})
</script>