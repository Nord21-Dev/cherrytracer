<template>
    <UContainer class="py-8 space-y-6">
        <div class="max-w-2xl mx-auto">
            <h1 class="text-2xl font-bold mb-6">Project Settings</h1>

            <UCard class="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                <form @submit.prevent="onSave" class="space-y-6">

                    <div class="flex items-start gap-6">
                        <!-- Icon Preview/Edit -->
                        <div class="space-y-2">
                            <label class="text-sm font-medium text-neutral-700 dark:text-neutral-400">Icon</label>
                            <UPopover>
                                <button type="button"
                                    class="w-16 h-16 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center justify-center text-3xl">
                                    {{ form.icon }}
                                </button>
                                <template #content>
                                    <div
                                        class="p-2 grid grid-cols-5 gap-2 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                                        <button v-for="icon in icons" :key="icon" type="button"
                                            @click="form.icon = icon"
                                            class="h-10 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xl">{{
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
                        class="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                        <div>
                            <div
                                class="uppercase tracking-wider text-[10px] mb-1 text-neutral-500 dark:text-neutral-500">
                                Project ID</div>
                            {{ selectedProject?.id }}
                        </div>
                        <UIcon name="i-lucide-copy" class="hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                            @click="copyToClipboard(selectedProject?.id, 'Project ID')" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            class="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-600 dark:text-neutral-400 space-y-2">

                            <div class="flex items-center justify-between gap-2">
                                <UBadge color="error" variant="outline">Server</UBadge>
                                <UButton type="button" size="xs" variant="ghost" icon="i-lucide-refresh-ccw"
                                    :loading="rotating.server" @click="openRotateConfirm('server')">
                                    Rotate
                                </UButton>
                            </div>

                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate">{{ selectedProject?.apiKey || '—' }}</span>
                                <UIcon name="i-lucide-copy"
                                    class="hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                                    @click="copyToClipboard(selectedProject?.apiKey, 'Server API Key')" />
                            </div>
                        </div>

                        <div
                            class="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-600 dark:text-neutral-400 space-y-2">

                            <div class="flex items-center justify-between gap-2">
                                <UBadge color="neutral" variant="outline">Browser</UBadge>
                                <UButton type="button" size="xs" variant="ghost" icon="i-lucide-refresh-ccw"
                                    :loading="rotating.browser" @click="openRotateConfirm('browser')">
                                    Rotate
                                </UButton>
                            </div>
                            <div class="flex items-center justify-between gap-2">
                                <span class="truncate">{{ selectedProject?.browserApiKey || '—' }}</span>
                                <UIcon name="i-lucide-copy"
                                    class="hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                                    @click="copyToClipboard(selectedProject?.browserApiKey, 'Browser API Key')" />
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2">
                        <UFormField label="Allowed Referrers" description="Full URLs with optional wildcards">
                            <UInputTags v-model="referrers" placeholder="https://app.example.com/*" add-on-paste
                                add-on-tab add-on-blur :duplicate="false" :convert-value="(v) => v.trim()"
                                :max-length="256" :delimiter="/[\s,;]+/" :max="20" :disabled="!selectedProject" />
                        </UFormField>
                        <p class="text-xs text-neutral-500 dark:text-neutral-500">
                            Examples: https://*.example.com/*, https://example.com/app/*, http://localhost:3000/*.
                            Requests with a browser key will be blocked if the Referer is not on this list.
                        </p>
                    </div>

                    <div class="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <UButton type="submit" :loading="saving" color="primary">Save Changes</UButton>
                    </div>
                </form>
            </UCard>

            <!-- 🔄 AUTO UPDATE SECTION -->
            <div class="my-8" id="system-updates">
                <div class="flex items-center justify-between mb-4">
                    <h2 class="text-lg font-semibold">System Updates</h2>
                    <UBadge v-if="versionInfo.update_available" color="success" variant="solid" size="md"
                        class="animate-pulse">
                        New Version: v{{ versionInfo.latest }}
                    </UBadge>
                </div>

                <UCard class="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                    <div class="p-4 space-y-6">
                        <!-- Version Comparison -->
                        <div class="grid grid-cols-2 gap-4">
                            <div
                                class="p-3 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-200 dark:border-neutral-800">
                                <div class="text-[10px] uppercase text-neutral-500 font-bold tracking-wider">Current
                                    Version</div>
                                <div class="font-mono text-sm mt-1">v{{ versionInfo.current }}</div>
                            </div>
                            <div
                                class="p-3 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-200 dark:border-neutral-800">
                                <div class="text-[10px] uppercase text-neutral-500 font-bold tracking-wider">Latest
                                    Available</div>
                                <div class="font-mono text-sm mt-1 text-primary-500">v{{ versionInfo.latest }}</div>
                            </div>
                        </div>

                        <!-- Changelog Preview (Only if update available) -->
                        <div v-if="versionInfo.update_available && versionInfo.release_notes"
                            class="text-sm bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-blue-800 dark:text-blue-200">
                            <div class="font-bold mb-1">What's New:</div>
                            <div class="whitespace-pre-wrap line-clamp-4 text-xs font-mono opacity-80">{{
                                versionInfo.release_notes
                                }}</div>
                            <a :href="versionInfo.release_url" target="_blank"
                                class="block mt-2 underline opacity-70 hover:opacity-100">Read full changelog on
                                GitHub</a>
                        </div>

                        <!-- Webhook Form -->
                        <form @submit.prevent="saveStorage"
                            class="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                            <div class="flex gap-4 flex-row items-center">
                                <UFormField label="Deploy Webhook" required>
                                    <UInput v-model="storageForm.updateWebhook" icon="i-lucide-webhook" type="password"
                                        placeholder="https://coolify.io/api/v1/deploy?..." />
                                </UFormField>
                                <UFormField label="API Token">
                                    <UInput v-model="storageForm.deployToken" icon="i-lucide-key" type="password"
                                        placeholder="Bearer Token..." />
                                </UFormField>
                            </div>
                            <p class="text-xs text-neutral-500">
                                For Coolify users: Locate your webhook URL in Coolify by navigating to <b>Project →
                                    Resources →
                                    Webhooks</b>. Paste it here to enable seamless one-click updates.
                                The API token is only required for Coolify.
                            </p>

                            <div class="flex justify-between items-center pt-2">
                                <div class="flex gap-2">
                                    <UButton type="submit" :loading="savingStorage" color="neutral" variant="soft"
                                        size="xs">
                                        Save Webhook
                                    </UButton>
                                    <UButton @click="helpModalOpen = true" color="neutral" variant="ghost" size="xs"
                                        icon="i-lucide-badge-info">
                                        Help
                                    </UButton>
                                </div>

                                <UButton v-if="versionInfo.update_available" @click="triggerUpdate" color="neutral"
                                    variant="subtle" icon="i-lucide-sparkles" :disabled="!storageForm.updateWebhook">
                                    Install Update Now
                                </UButton>
                                <UButton v-else disabled color="neutral" variant="soft" icon="i-lucide-check">
                                    System Up to Date
                                </UButton>
                            </div>
                        </form>
                    </div>
                </UCard>
            </div>

            <!-- Storage Settings Section -->
            <div class="my-8">
                <h2 class="text-lg font-semibold mb-4">Storage & Retention</h2>
                <UCard class="bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                    <form @submit.prevent="saveStorage" class="space-y-6 p-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div class="space-y-1">
                                <UFormField label="Soft Limit (Auto-Prune)">
                                    <UInput v-model.number="storageForm.softLimitMb" type="number" suffix="MB" />
                                </UFormField>
                                <p class="text-xs text-neutral-500">
                                    Logs will be aggressively pruned when DB size exceeds this value.
                                </p>
                            </div>

                            <div class="space-y-1">
                                <UFormField label="Total Capacity (Reference)">
                                    <UInput v-model.number="storageForm.hardLimitMb" type="number" suffix="MB" />
                                </UFormField>
                                <p class="text-xs text-neutral-500">
                                    Used to calculate the progress bar in the sidebar. (1GB = 1024MB)
                                </p>
                            </div>
                        </div>

                        <div class="flex justify-end">
                            <UButton type="submit" :loading="savingStorage" color="neutral" variant="subtle">
                                Update Limits
                            </UButton>
                        </div>
                    </form>
                </UCard>
            </div>
        </div>

        <!-- Help Modal -->
        <UModal v-model:open="helpModalOpen" title="Update Process">
            <template #body>
                <div class="space-y-4">
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                        Updating CherryTracer on PaaS platforms like Coolify, Railway, or any other service supporting
                        Docker Compose is straightforward and safe.
                    </p>
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 class="font-semibold text-blue-900 dark:text-blue-100 mb-2">Simple Re-deployment</h4>
                        <p class="text-sm text-blue-800 dark:text-blue-200">
                            Simply trigger a re-deployment through your platform's interface. This automatically pulls
                            the latest Docker image with all updates applied.
                        </p>
                    </div>
                    <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <h4 class="font-semibold text-green-900 dark:text-green-100 mb-2">Data Safety Guaranteed</h4>
                        <p class="text-sm text-green-800 dark:text-green-200">
                            Your database is stored in persistent volumes, ensuring zero data loss during updates. No
                            manual backups or migrations required.
                        </p>
                    </div>
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                        The process is designed to be seamless - just redeploy and your instance will be updated
                        automatically.
                    </p>
                </div>
            </template>
            <template #footer>
                <UButton @click="helpModalOpen = false" color="primary">Got it</UButton>
            </template>
        </UModal>

        <!-- Rotate Key Confirmation Modal -->
        <UModal v-model:open="confirmRotateModalOpen" title="Confirm API Key Rotation" :ui="{ footer: 'justify-end' }">
            <template #body>
                <div class="space-y-4">
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                        Are you sure you want to rotate the <strong>{{ rotateType === 'server' ? 'Server' : 'Browser' }} API Key</strong>?
                    </p>
                    <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div class="flex items-start gap-3">
                            <UIcon name="i-lucide-alert-triangle" class="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <h4 class="font-semibold text-amber-900 dark:text-amber-100 mb-1">Warning</h4>
                                <p class="text-sm text-amber-800 dark:text-amber-200">
                                    Rotating this key will immediately invalidate the current key. Any integrations or applications using this key will stop working until updated with the new key.
                                </p>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm text-neutral-600 dark:text-neutral-400">
                        Make sure to update your applications with the new key before proceeding.
                    </p>
                </div>
            </template>
            <template #footer>
                <UButton @click="confirmRotateModalOpen = false" color="neutral" variant="outline">
                    Cancel
                </UButton>
                <UButton @click="confirmRotate" color="error" variant="solid" :loading="rotating[rotateType || 'server']">
                    Rotate Key
                </UButton>
            </template>
        </UModal>
    </UContainer>
</template>

<script setup lang="ts">
definePageMeta({
    ssr: false
})

const { selectedProject, updateProject } = useProject()
const { startPolling } = useMaintenance() // Import the maintenance logic
const toast = useToast()

const versionInfo = ref({
    current: '...',
    latest: '...',
    update_available: false,
    release_notes: '',
    release_url: ''
})

const icons = ['🚀', '⚡️', '🔮', '🪐', '💎', '🍒', '🏰', '🐳', '👻', '🤖']
const saving = ref(false)
const helpModalOpen = ref(false)
const referrers = ref<string[]>([])
const rotating = reactive({ server: false, browser: false })
const confirmRotateModalOpen = ref(false)
const rotateType = ref<'server' | 'browser' | null>(null)

const form = reactive({
    name: '',
    icon: ''
})

// Sync form with current project
watch(selectedProject, (p) => {
    if (p) {
        form.name = p.name
        form.icon = p.icon || '🍒'
        referrers.value = Array.isArray((p as any).allowedReferrers) ? [...(p as any).allowedReferrers] : []
    } else {
        referrers.value = []
    }
}, { immediate: true })

const onSave = async () => {
    if (!selectedProject.value) return
    saving.value = true
    const cleanedReferrers = Array.from(new Set(referrers.value.map((r) => r.trim()).filter((r) => r.length > 0)))
    await updateProject(selectedProject.value.id, {
        name: form.name,
        icon: form.icon,
        allowedReferrers: cleanedReferrers
    })
    saving.value = false
}

const regenerateKey = async (type: "server" | "browser") => {
    if (!selectedProject.value) return
    rotating[type] = true
    try {
        await updateProject(selectedProject.value.id, type === 'server'
            ? { regenerateServerKey: true }
            : { regenerateBrowserKey: true }
        )
    } finally {
        rotating[type] = false
    }
}

const openRotateConfirm = (type: "server" | "browser") => {
    rotateType.value = type
    confirmRotateModalOpen.value = true
}

const confirmRotate = async () => {
    if (!rotateType.value) return
    confirmRotateModalOpen.value = false
    await regenerateKey(rotateType.value)
    rotateType.value = null
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
    hardLimitMb: 5120,
    updateWebhook: '',
    deployToken: ''
})
const savingStorage = ref(false)
const { fetchApi } = useCherryApi()

// Load initial data
const loadStorage = async () => {
    try {
        const data = await fetchApi<any>('/api/system/storage', { skipProject: true })
        storageForm.softLimitMb = Math.round(data.soft_limit_bytes / 1024 / 1024)
        storageForm.hardLimitMb = Math.round(data.hard_limit_bytes / 1024 / 1024)
        if (data.config?.updateWebhook) {
            storageForm.updateWebhook = data.config.updateWebhook
        }
        if (data.config?.deployToken) {
            storageForm.deployToken = data.config.deployToken
        }

        // 2. Get Version Info
        const v = await fetchApi<any>('/api/system/version', { skipProject: true })
        versionInfo.value = v
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
        toast.add({ title: 'Success', description: 'System settings updated', color: 'success' })
        // Refresh page data or force widget refresh if using global state
    } catch (e) {
        toast.add({ title: 'Error', description: 'Failed to update system settings', color: 'error' })
    } finally {
        savingStorage.value = false
    }
}

const triggerUpdate = async () => {
    if (!confirm("This will restart the server to install the update. The dashboard will reconnect automatically. Continue?")) return;

    try {
        await fetchApi('/api/system/update', { method: 'POST', skipProject: true })
        // Start the UI overlay immediately
        startPolling()
    } catch (e) {
        toast.add({ title: 'Update Failed', description: 'Check console for details.', color: 'error' })
    }
}

onMounted(() => {
    loadStorage()
})
</script>
