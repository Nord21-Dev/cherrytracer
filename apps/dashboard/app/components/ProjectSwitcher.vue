<template>
    <div class="px-2 mb-2">
        <UPopover v-model:open="projectPopoverOpen" :popper="{ placement: 'bottom-start', offsetDistance: 0 }" class="w-full">
            <!-- Trigger Button -->
            <button
                class="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 text-left">
                <div
                    class="w-6 h-6 rounded-lg flex items-center justify-center text-sm shadow-inner">
                    {{ selectedProject?.icon || '?' }}
                </div>
                <div class="flex-1 truncate font-medium text-sm">{{ selectedProject?.name }}</div>
                <UIcon name="i-lucide-chevrons-up-down" class="text-neutral-600 dark:text-neutral-500 w-4 h-4" />
            </button>

            <!-- Dropdown Content -->
            <template #content>
                <div class="w-60 p-1 bg-white dark:bg-neutral-900 rounded-lg shadow-xl">
                    <div
                        class="text-xs font-bold text-neutral-700 dark:text-neutral-500 px-2 py-1.5 uppercase tracking-wider">
                        Projects</div>

                    <button v-for="p in projects" :key="p.id" @click="selectProject(p.id)"
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm transition-colors"
                        :class="selectedProjectId === p.id ? 'text-black bg-neutral-200 dark:text-white dark:bg-neutral-800' : 'text-neutral-600 dark:text-neutral-400'">
                        <span>{{ p.icon }}</span>
                        <span class="truncate">{{ p.name }}</span>
                        <UIcon v-if="selectedProjectId === p.id" name="i-lucide-check"
                            class="ml-auto w-3 h-3 text-primary-500" />
                    </button>

                    <div class="h-px bg-neutral-300 dark:bg-neutral-800 my-1" />

                    <button @click="openCreateModal"
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary-500/10 hover:text-primary-400 text-neutral-600 dark:text-neutral-400 text-sm transition-colors group">
                        <div
                            class="w-4 h-4 rounded border border-neutral-400 dark:border-neutral-600 border-dashed group-hover:border-primary-500 flex items-center justify-center">
                            <UIcon name="i-lucide-plus" class="w-3 h-3" />
                        </div>
                        Create Project
                    </button>
                </div>
            </template>
        </UPopover>

        <UModal v-model:open="createModalOpen" title="Create Project">
            <template #body>
                <div class="space-y-4">
                    <div class="space-y-2">
                        <p class="text-sm text-neutral-600 dark:text-neutral-400">Choose an emoji and give your project a name.</p>
                        <div class="grid grid-cols-6 gap-2">
                            <button v-for="icon in icons" :key="icon" type="button" @click="form.icon = icon"
                                class="h-11 rounded-xl text-xl flex items-center justify-center transition-all border"
                                :class="form.icon === icon
                                    ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-white scale-[1.05] shadow-sm'
                                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'">
                                {{ icon }}
                            </button>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <UFormField label="Project Name">
                            <UInput v-model="form.name" icon="i-lucide-box" placeholder="e.g. Observability"
                                @update:modelValue="onNameInput" />
                        </UFormField>
                        <div v-if="nameErrors.length" class="space-y-1">
                            <p v-for="err in nameErrors" :key="err" class="text-xs text-red-500 flex items-center gap-1">
                                <UIcon name="i-lucide-alert-circle" class="w-3 h-3" />
                                {{ err }}
                            </p>
                        </div>
                    </div>
                </div>
            </template>
            <template #footer>
                <div class="flex justify-end gap-2">
                    <UButton color="neutral" variant="ghost" @click="closeCreateModal">Cancel</UButton>
                    <UButton color="primary" :loading="creating" :disabled="!canSave" @click="saveProject">Save</UButton>
                </div>
            </template>
        </UModal>
    </div>
</template>

<script setup lang="ts">
const { projects, selectedProjectId, selectedProject, createProject } = useProject()

const projectPopoverOpen = ref(false)
const createModalOpen = ref(false)
const creating = ref(false)

const icons: string[] = ['🚀', '⚡️', '🔮', '🪐', '💎', '🍒', '🏰', '🐳', '👻', '🤖', '🛰️', '🧭']

const form = reactive<{ name: string; icon: string }>({
    name: '',
    icon: icons[0] ?? '🚀'
})

const nameErrors = ref<string[]>([])
const nameTouched = ref(false)

const NAME_MIN_LENGTH = 3
const NAME_MAX_LENGTH = 40
const allowedNameRegex = /^[a-zA-Z0-9\s-]+$/

const validateName = (value: string) => {
    const normalized = value.trim()
    const errors: string[] = []

    if (!normalized) {
        errors.push('Name is required.')
    }
    if (normalized.length > 0 && normalized.length < NAME_MIN_LENGTH) {
        errors.push('Name too short (min 3 characters).')
    }
    if (normalized.length > NAME_MAX_LENGTH) {
        errors.push('Name too long (max 40 characters).')
    }
    if (normalized && !allowedNameRegex.test(normalized)) {
        errors.push('No special characters. Use letters, numbers, spaces, or hyphens.')
    }
    if (normalized && projects.value.some((p: any) => p.name?.toLowerCase() === normalized.toLowerCase())) {
        errors.push('Name already taken.')
    }

    return Array.from(new Set(errors))
}

const runValidation = () => {
    const errors = nameTouched.value ? validateName(form.name) : []
    nameErrors.value = errors
    return errors
}

watch(() => form.name, () => {
    if (nameTouched.value) {
        nameErrors.value = validateName(form.name)
    }
})

const canSave = computed(() => {
    const normalized = form.name.trim()
    const clientErrors = validateName(form.name)
    const activeErrors = nameErrors.value.length > 0 ? nameErrors.value : clientErrors

    return !creating.value && normalized.length > 0 && activeErrors.length === 0
})

const selectProject = (id: string) => {
    selectedProjectId.value = id
    projectPopoverOpen.value = false
}

const openCreateModal = () => {
    projectPopoverOpen.value = false
    createModalOpen.value = true
    nameTouched.value = false
    nameErrors.value = []
}

const closeCreateModal = () => {
    createModalOpen.value = false
    form.name = ''
    form.icon = icons[0] ?? '🚀'
    nameTouched.value = false
    nameErrors.value = []
}

const onNameInput = () => {
    if (!nameTouched.value) nameTouched.value = true
    runValidation()
}

const parseApiError = (err: any): string => {
    const message = err?.data?.message || err?.message || ''
    const lower = (message as string).toLowerCase()

    if (lower.includes('taken') || lower.includes('exists')) {
        return 'Name already taken.'
    }
    if (lower.includes('short')) {
        return 'Name too short (min 3 characters).'
    }
    if (lower.includes('long') || lower.includes('length')) {
        return 'Name too long (max 40 characters).'
    }
    if (lower.includes('character')) {
        return 'No special characters. Use letters, numbers, spaces, or hyphens.'
    }

    return 'Could not create project. Please try again.'
}

const saveProject = async () => {
    nameTouched.value = true
    const errors = validateName(form.name)
    nameErrors.value = errors

    if (errors.length > 0) return

    creating.value = true
    try {
        await createProject(form.name.trim(), form.icon)
        closeCreateModal()
        projectPopoverOpen.value = false
    } catch (err: any) {
        nameErrors.value = [parseApiError(err)]
    } finally {
        creating.value = false
    }
}
</script>
