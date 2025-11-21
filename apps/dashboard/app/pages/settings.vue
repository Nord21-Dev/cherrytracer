<template>
    <UContainer class="py-8 space-y-6">
        <div class="max-w-2xl mx-auto">
            <h1 class="text-2xl font-bold mb-6">Project Settings</h1>

            <UCard class="bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800">
                <form @submit.prevent="onSave" class="space-y-6">

                    <div class="flex items-start gap-6">
                        <!-- Icon Preview/Edit -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-gray-700 dark:text-neutral-400">Icon</label>
                            <UPopover>
                                <button type="button"
                                    class="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-all flex items-center justify-center text-3xl">
                                    {{ form.icon }}
                                </button>
                                <template #content>
                                    <div
                                        class="p-2 grid grid-cols-5 gap-2 w-64 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
                                        <button v-for="icon in icons" :key="icon" type="button"
                                            @click="form.icon = icon"
                                            class="h-10 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-xl">{{
                                                icon }}</button>
                                    </div>
                                </template>
                            </UPopover>
                        </div>

                        <!-- Name Edit -->
                        <div class="flex-1 space-y-2">
                            <UFormField label="Project Name">
                                <UInput v-model="form.name" icon="i-lucide-box" />
                            </UFormField>
                        </div>
                    </div>

                    <div
                        class="p-4 bg-gray-50 dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 font-mono text-xs text-gray-600 dark:text-neutral-400 flex items-center justify-between">
                        <div>
                            <div class="uppercase tracking-wider text-[10px] mb-1 text-gray-500 dark:text-neutral-500">
                                Project ID</div>
                            {{ selectedProject?.id }}
                        </div>
                        <UIcon name="i-lucide-copy" class="hover:text-gray-900 dark:hover:text-white cursor-pointer"
                            @click="copyToClipboard(selectedProject?.id, 'Project ID')" />
                    </div>

                    <div
                        class="p-4 bg-gray-50 dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 font-mono text-xs text-gray-600 dark:text-neutral-400">
                        <div class="uppercase tracking-wider text-[10px] mb-1 text-gray-500 dark:text-neutral-500">API
                            Key</div>
                        <div class="flex items-center justify-between">
                            <span>{{ selectedProject?.apiKey }}</span>
                            <div class="flex items-center gap-2">
                                <UBadge color="neutral" variant="outline">Keep Secret</UBadge>
                                <UIcon name="i-lucide-copy"
                                    class="hover:text-gray-900 dark:hover:text-white cursor-pointer"
                                    @click="copyToClipboard(selectedProject?.apiKey, 'API Key')" />
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-4 border-t border-gray-200 dark:border-neutral-800">
                        <UButton type="submit" :loading="saving" color="primary">Save Changes</UButton>
                    </div>
                </form>
            </UCard>

            <!-- Storage Settings Section -->
            <div class="my-8">
                <h2 class="text-lg font-semibold mb-4">Storage & Retention</h2>
                <UCard class="bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-800">
                    <form @submit.prevent="saveStorage" class="space-y-6 p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div class="space-y-1">
                                <UFormField label="Soft Limit (Auto-Prune)">
                                    <UInput v-model.number="storageForm.softLimitMb" type="number" suffix="MB" />
                                </UFormField>
                                <p class="text-xs text-gray-500">
                                    Logs will be aggressively pruned when DB size exceeds this value.
                                </p>
                            </div>

                            <div class="space-y-1">
                                <UFormField label="Total Capacity (Reference)">
                                    <UInput v-model.number="storageForm.hardLimitMb" type="number" suffix="MB" />
                                </UFormField>
                                <p class="text-xs text-gray-500">
                                    Used to calculate the progress bar in the sidebar. (1GB = 1024MB)
                                </p>
                            </div>
                        </div>

                        <div class="flex justify-end">
                            <UButton type="submit" :loading="savingStorage" color="neutral" variant="solid">
                                Update Limits
                            </UButton>
                        </div>
                    </form>
                </UCard>
            </div>
        </div>
    </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
  ssr: false
})

const { selectedProject, updateProject } = useProject()
const toast = useToast()

const icons = ['🚀', '⚡️', '🔮', '🪐', '💎', '🍒', '🏰', '🐳', '👻', '🤖']
const saving = ref(false)

const form = reactive({
    name: '',
    icon: ''
})

// Sync form with current project
watch(selectedProject, (p) => {
    if (p) {
        form.name = p.name
        form.icon = p.icon || '🍒'
    }
}, { immediate: true })

const onSave = async () => {
    if (!selectedProject.value) return
    saving.value = true
    await updateProject(selectedProject.value.id, {
        name: form.name,
        icon: form.icon
    })
    saving.value = false
}

const copyToClipboard = async (text: string | undefined, label: string) => {
    if (!text) return
    try {
        await navigator.clipboard.writeText(text)
        toast.add({
            title: 'Copied to clipboard',
            description: `${label} has been copied successfully.`,
            icon: 'i-lucide-check',
            color: 'success'
        })
    } catch (err) {
        toast.add({
            title: 'Failed to copy',
            description: 'Could not copy to clipboard.',
            icon: 'i-lucide-x',
            color: 'error'
        })
    }
}

// Storage Logic
const storageForm = reactive({
    softLimitMb: 1024,
    hardLimitMb: 5120
})
const savingStorage = ref(false)
const { fetchApi } = useCherryApi()

// Load initial data
const loadStorage = async () => {
    try {
        const data = await fetchApi<any>('/api/system/storage', { skipProject: true })
        storageForm.softLimitMb = Math.round(data.soft_limit_bytes / 1024 / 1024)
        storageForm.hardLimitMb = Math.round(data.hard_limit_bytes / 1024 / 1024)
    } catch (e) { }
}

const saveStorage = async () => {
    savingStorage.value = true
    try {
        await fetchApi('/api/system/storage', {
            method: 'POST',
            body: storageForm,
            skipProject: true
        })
        toast.add({ title: 'Success', description: 'Storage limits updated', color: 'success' })
        // Refresh page data or force widget refresh if using global state
    } catch (e) {
        toast.add({ title: 'Error', description: 'Failed to update limits', color: 'error' })
    } finally {
        savingStorage.value = false
    }
}

onMounted(() => {
    loadStorage()
})
</script>