<template>
    <div class="relative h-full w-full">
        <VisXYContainer :data="data" :margin="{ left: 0, right: 0, top: 0, bottom: 0 }" height="60">
            <VisLine 
                :x="x" 
                :y="y" 
                :color="color" 
                :stroke-width="2"
            />
            <VisArea 
                :x="x" 
                :y="y" 
                :color="color" 
                :opacity="0.1" 
            />
            <VisCrosshair :template="tooltipTemplate" color="rgba(0,0,0,0.1)" />
            <VisTooltip />
        </VisXYContainer>
    </div>
</template>

<script setup lang="ts">
import { VisXYContainer, VisLine, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import { format } from 'date-fns'

export type EventSparkPoint = {
    timestamp: number
    count: number
}

const props = withDefaults(defineProps<{
    data: EventSparkPoint[]
    color?: string
}>(), {
    color: '#3b82f6'
})

const x = (d: EventSparkPoint) => d.timestamp
const y = (d: EventSparkPoint) => d.count

const tooltipTemplate = (d: EventSparkPoint) => {
    return `
        <div class="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded shadow-lg text-xs">
            <div class="font-mono text-neutral-500 mb-1">${format(d.timestamp, 'HH:mm')}</div>
            <div class="flex items-center gap-2">
                <span style="color: ${props.color}" class="font-bold">${d.count} events</span>
            </div>
        </div>
    `
}
</script>
