<template>
    <div class="w-full flex items-center flex-wrap gap-2 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <!-- Active Filters (Chips) -->
        <UInputTags
            v-model="tags"
            icon="i-lucide-search"
            variant="none"
            :ui="{ root: 'flex-1 min-w-0', input: 'min-w-[100px] max-w-[200px] !pl-0' }"
            placeholder="Add filter..."
        />
        <div class="flex justify-end items-center gap-2">
        <!-- Main Search Input -->
        <input 
            :value="search"
            @input="updateSearch"
            @keydown.enter="$emit('refresh')"
            type="text"
            placeholder="Search messages..."
            class="flex-1 bg-transparent border-none focus:ring-0 text-sm p-1 min-w-[150px] text-neutral-900 dark:text-white placeholder-neutral-400"
        />

        <!-- Add Filter Popover -->
        <!-- <UPopover :content="{ side: 'bottom', align: 'end' }">
            <UButton icon="i-lucide-plus" size="xs" color="neutral" variant="ghost" label="Filter" />
            
            <template #content>
                <div class="p-3 w-64 space-y-3">
                    <UInput v-model="newFilterKey" placeholder="Key (e.g. data.customerId)" size="sm" autofocus />
                    <UInput v-model="newFilterValue" placeholder="Value" size="sm" @keydown.enter="addFilter" />
                    <UButton block size="sm" @click="addFilter" :disabled="!newFilterKey || !newFilterValue">
                        Apply Filter
                    </UButton>
                </div>
            </template>
        </UPopover> -->

        <div class="flex-1" />

        <slot />
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps<{
    search: string
    filters: Record<string, string>
}>()

const emit = defineEmits<{
    (e: 'update:search', value: string): void
    (e: 'update:filters', value: Record<string, string>): void
    (e: 'refresh'): void
}>()

const newFilterKey = ref('')
const newFilterValue = ref('')

const tags = computed({
    get: () => Object.entries(props.filters).map(([key, value]) => `${key}:${value}`),
    set: (newTags) => {
        const newFilters: Record<string, string> = {}
        newTags.forEach(tag => {
            const parts = tag.split(':')
            if (parts.length >= 2) {
                const key = parts[0]?.trim()
                const value = parts.slice(1).join(':').trim()
                if (key && value) {
                    newFilters[key] = value
                }
            }
        })
        emit('update:filters', newFilters)
        emit('refresh')
    }
})

const updateSearch = (e: Event) => {
    emit('update:search', (e.target as HTMLInputElement).value)
}

const addFilter = () => {
    if (!newFilterKey.value || !newFilterValue.value) return

    const newFilters = { ...props.filters, [newFilterKey.value]: newFilterValue.value }
    emit('update:filters', newFilters)
    emit('refresh')
    
    newFilterKey.value = ''
    newFilterValue.value = ''
}
</script>
