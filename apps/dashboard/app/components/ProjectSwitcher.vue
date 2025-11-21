<template>
    <div class="px-2 mb-2">
        <UPopover :popper="{ placement: 'bottom-start', offsetDistance: 0 }" class="w-full">
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

                    <button @click="navigateTo('/onboarding')"
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
    </div>
</template>

<script setup lang="ts">
const { projects, selectedProjectId, selectedProject } = useProject()

const selectProject = (id: string) => {
    selectedProjectId.value = id
}
</script>