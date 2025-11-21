<template>
  <div class="relative h-full w-full font-sans">
    <svg class="absolute h-0 w-0" aria-hidden="true">
      <defs>
        <linearGradient id="glass-success" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#4ade80" stop-opacity="0.3" />
        </linearGradient>
        <linearGradient id="glass-error" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fb7185" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#fb7185" stop-opacity="0.3" />
        </linearGradient>
        <pattern id="pattern-success" patternUnits="userSpaceOnUse" width="8" height="8">
          <rect width="8" height="8" fill="#4ade80" opacity="0.9"/>
          <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#22c55e" stroke-width="1" opacity="0.7"/>
        </pattern>
        <pattern id="pattern-error" patternUnits="userSpaceOnUse" width="4" height="4">
          <rect width="4" height="4" fill="#fb7185" opacity="0.9"/>
          <circle cx="2" cy="2" r="1" fill="#ef4444" opacity="0.7"/>
        </pattern>
      </defs>
    </svg>

    <VisXYContainer 
      v-if="normalizedData.length > 0"
      :data="normalizedData" 
      :height="300" 
      :margin="{ left: 0, right: 0, top: 20, bottom: 20 }"
    >
      <VisStackedBar 
        :x="x" 
        :y="y" 
        :color="colors"
        :rounded-corners="4"
        :bar-padding="barPadding"
        :stroke="strokeColor"
        :stroke-width="1"
      />

      <VisAxis 
        type="x" 
        :tick-format="formatTick" 
        :grid-line="false" 
        :tick-line="false"
        tick-text-color="rgba(156, 163, 175, 0.8)"
        :num-ticks="axisTicks"
      />

      <VisCrosshair color="rgba(255,255,255,0.3)" />
      <VisTooltip :triggers="triggers" />
    </VisXYContainer>
    
    <div v-else class="h-full flex items-center justify-center text-neutral-500 text-sm">
      Waiting for data...
    </div>
  </div>
</template>

<script setup lang="ts">
import { StackedBar } from '@unovis/ts'
import { VisXYContainer, VisStackedBar, VisAxis, VisTooltip, VisCrosshair } from '@unovis/vue'
import { 
  format, 
  subMinutes, 
  subHours, 
  subDays, 
  startOfMinute, 
  startOfDay, 
  addMinutes, 
  addDays, 
  areIntervalsOverlapping,
  isSameMinute,
  isSameDay,
  roundToNearestMinutes
} from 'date-fns'

type DataPoint = { date: string | Date; success: number; errors: number }
type Period = '1h' | '24h' | '7d'

const props = withDefaults(defineProps<{
    data: DataPoint[]
    period?: string // 1h, 24h, 7d
}>(), {
    period: '24h',
    data: () => []
})

const normalizedData = computed(() => {
  const now = new Date()
  const rawData = props.data.map(d => ({ ...d, dateObj: new Date(d.date) }))
  const buckets: { date: Date; success: number; errors: number }[] = []

  if (props.period === '1h') {
    // Strategy: 60 bars, 1 minute interval
    // Start from 59 minutes ago up to now
    const start = subMinutes(startOfMinute(now), 59)
    
    for (let i = 0; i < 60; i++) {
      const timeSlot = addMinutes(start, i)
      
      // Find data points that match this minute
      const match = rawData.find(d => isSameMinute(d.dateObj, timeSlot))
      
      buckets.push({
        date: timeSlot,
        success: match?.success || 0,
        errors: match?.errors || 0
      })
    }

  } else if (props.period === '24h') {
    // Strategy: 96 bars, 15 minute interval
    // Round current time down to nearest 15m to set the anchor
    const anchor = roundToNearestMinutes(now, { nearestTo: 15, roundingMethod: 'floor' })
    // Start 95 intervals (of 15m) ago
    const start = subMinutes(anchor, 15 * 95)

    for (let i = 0; i < 96; i++) {
      const timeSlot = addMinutes(start, i * 15)
      const nextSlot = addMinutes(timeSlot, 15)

      // Find data points that fall within this 15m window
      const matches = rawData.filter(d => 
        d.dateObj >= timeSlot && d.dateObj < nextSlot
      )
      
      const success = matches.reduce((acc, curr) => acc + curr.success, 0)
      const errors = matches.reduce((acc, curr) => acc + curr.errors, 0)

      buckets.push({ date: timeSlot, success, errors })
    }

  } else if (props.period === '7d') {
    // Strategy: 7 bars, 1 day interval
    const start = subDays(startOfDay(now), 6)

    for (let i = 0; i < 7; i++) {
      const timeSlot = addDays(start, i)
      const matches = rawData.filter(d => isSameDay(d.dateObj, timeSlot))

      const success = matches.reduce((acc, curr) => acc + curr.success, 0)
      const errors = matches.reduce((acc, curr) => acc + curr.errors, 0)

      buckets.push({ date: timeSlot, success, errors })
    }
  }

  return buckets
})

// Adjust visual density based on bar count
const barPadding = computed(() => {
  if (props.period === '7d') return 0.5 // Fat bars for days
  if (props.period === '24h') return 0.1 // Thinner gaps for 96 bars
  return 0.2 // Standard for 60 bars
})

// Adjust Axis Tick Density
const axisTicks = computed(() => {
  if (props.period === '7d') return 7
  if (props.period === '24h') return 6 // Show label every ~4 hours
  return 6 // Show label every ~10 mins
})

const x = (d: any, i: number) => i

const y = [
    (d: any) => d.success,
    (d: any) => d.errors
]

const formatTick = (i: number) => {
    const item = normalizedData.value[i]
    if (!item || !Number.isInteger(i)) return ''
    
    if (props.period === '7d') {
        return format(item.date, 'EEE') // Mon, Tue...
    }
    return format(item.date, 'HH:mm')
}

const colors = (d: number, i: number) => i === 0 ? 'url(#pattern-success)' : 'url(#pattern-error)'
const strokeColor = 'rgba(255, 255, 255, 0.2)'

const formatTooltip = (d: any) => {
    const total = d.success + d.errors
    const rate = total ? Math.round((d.success / total) * 100) : 0
    const dateFmt = props.period === '7d' ? 'EEE, MMM do' : 'HH:mm'
    
    return `
        <div class="min-w-[160px] overflow-hidden rounded-xl dark:bg-slate-900/90 bg-white/95 dark:border-0 border border-gray-200/20 p-3 text-xs shadow-2xl backdrop-blur-xl dark:text-gray-300 text-gray-700 ring-1 ring-black/5">
            <div class="mb-2 flex items-center justify-between dark:border-b dark:border-white/10 border-b border-gray-200 pb-2 font-mono dark:text-gray-400 text-gray-600">
                <span>${format(d.date, dateFmt)}</span>
                <span class="${rate >= 98 ? 'text-green-500' : 'text-orange-400'} font-bold">${rate}%</span>
            </div>
            <div class="flex justify-between text-green-500 mb-1">
                <span>Success</span>
                <span class="font-bold font-mono">${d.success}</span>
            </div>
            <div class="flex justify-between text-rose-400">
                <span>Error</span>
                <span class="font-bold font-mono">${d.errors}</span>
            </div>
        </div>
    `
}

const triggers = {
  [StackedBar.selectors.bar]: formatTooltip
}
</script>

<style>
.css-135213i-tooltip, .unovis-tooltip {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
}
</style>