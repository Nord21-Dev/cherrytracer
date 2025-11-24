<template>
    <div class="w-full flex items-center flex-wrap gap-2 bg-neutral-50 dark:bg-neutral-900/50 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <!-- Active Filters (Chips) -->
        <UInputTags
            v-model="tags"
            icon="i-lucide-search"
            variant="subtle"
            :ui="{ root: 'flex-1 min-w-0', input: 'min-w-[100px] !pl-0' }"
            placeholder="Search messages or add filter (e.g. level:error)..."
        />
        
        <div class="flex justify-end items-center gap-2">
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

const tags = computed({
    get: () => {
        const filterTags = Object.entries(props.filters).map(([key, value]) => `${key}:${value}`)
        const searchTags = props.search ? props.search.split(' ').filter(Boolean) : []
        return [...filterTags, ...searchTags]
    },
    set: (newTags) => {
        const newFilters: Record<string, string> = {}
        const newSearchParts: string[] = []

        newTags.forEach(tag => {
            // Check if tag is a filter (contains :)
            if (tag.includes(':')) {
                const parts = tag.split(':')
                if (parts.length >= 2) {
                    const key = parts[0]?.trim()
                    const value = parts.slice(1).join(':').trim()
                    if (key && value) {
                        newFilters[key] = value
                    } else {
                        // If parsing fails, treat as search
                        newSearchParts.push(tag)
                    }
                } else {
                    newSearchParts.push(tag)
                }
            } else {
                // No colon, treat as search term
                newSearchParts.push(tag)
            }
        })

        emit('update:filters', newFilters)
        emit('update:search', newSearchParts.join(' '))
        emit('refresh')
    }
})
</script>
