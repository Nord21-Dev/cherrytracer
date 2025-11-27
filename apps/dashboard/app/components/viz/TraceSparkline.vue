<template>
    <div class="relative h-full w-full">
        <VisXYContainer :data="data" :height="60" :margin="{ left: 0, right: 0, top: 5, bottom: 5 }">
            <VisLine 
                :x="x" 
                :y="y" 
                color="#3b82f6" 
                :stroke-width="2"
            />
            <VisArea 
                :x="x" 
                :y="y" 
                color="#3b82f6" 
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

type SparkPoint = {
    timestamp: number
    avgLatency: number
    throughput: number
}

const props = defineProps<{
    data: SparkPoint[]
}>()

const x = (d: SparkPoint) => d.timestamp
const y = (d: SparkPoint) => d.avgLatency

const tooltipTemplate = (d: SparkPoint) => {
    return `
        <div class="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded shadow-lg text-xs">
            <div class="font-mono text-neutral-500 mb-1">${format(d.timestamp, 'HH:mm')}</div>
            <div class="flex items-center gap-2">
                <span class="text-blue-500 font-bold">${d.avgLatency}ms</span>
                <span class="text-neutral-400">|</span>
                <span class="text-neutral-600 dark:text-neutral-400">${d.throughput} reqs</span>
            </div>
        </div>
    `
}
</script>
