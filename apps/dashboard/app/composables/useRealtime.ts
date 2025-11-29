import { useWebSocket } from '@vueuse/core'

type WebSocketMessage = {
    type: 'new_logs' | 'stats_update' | 'connected' | 'pong'
    count?: number
    criticalCount?: number
    projectId?: string
}

export const useRealtime = () => {
    const { selectedProjectId } = useProject()
    const config = useRuntimeConfig()
    
    const getWsUrl = () => {
        if (import.meta.server) return ''

        const publicApiBase = config.public.apiBase
        if (publicApiBase && /^https?:\/\//i.test(publicApiBase)) {
            const url = new URL(publicApiBase)
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
            return `${protocol}//${url.host}/ws`
        }
        
        if (window.location.hostname === 'localhost' && window.location.port === '3001') {
             return 'ws://localhost:3000/ws'
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${protocol}//${window.location.host}/ws`
    }

    const isConnected = ref(false)
    const newLogsCount = ref(0)
    const newCriticalCount = ref(0)
    const lastUpdate = ref<Date | null>(null)

    const { status, send } = useWebSocket(getWsUrl(), {
        autoReconnect: true,
        heartbeat: {
            message: JSON.stringify({ type: 'ping' }),
            interval: 30000,
        },
        onConnected: (ws) => {
            isConnected.value = true
            if (selectedProjectId.value) {
                send(JSON.stringify({ type: 'subscribe', projectId: selectedProjectId.value }))
            }
        },
        onDisconnected: () => {
            isConnected.value = false
        },
        onMessage: (ws, event) => {
            try {
                const data = JSON.parse(event.data) as WebSocketMessage
                
                if (data.type === 'pong') return

                if (data.type === 'new_logs') {
                    newLogsCount.value += (data.count || 1)
                    newCriticalCount.value += (data.criticalCount || 0)
                    lastUpdate.value = new Date()
                }
            } catch (e) {
                // ignore
            }
        }
    })

    watch(selectedProjectId, (newId) => {
        if (newId && status.value === 'OPEN') {
            newLogsCount.value = 0
            newCriticalCount.value = 0
            send(JSON.stringify({ type: 'subscribe', projectId: newId }))
        }
    })

    const resetCount = () => {
        newLogsCount.value = 0
    }

    const resetCriticalCount = () => {
        newCriticalCount.value = 0
    }

    return {
        isConnected,
        newLogsCount,
        newCriticalCount,
        lastUpdate,
        resetCount,
        resetCriticalCount,
    }
}